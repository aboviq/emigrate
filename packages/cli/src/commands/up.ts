import path from 'node:path';
import process from 'node:process';
import { getOrLoadPlugins, getOrLoadReporter, getOrLoadStorage, serializeError } from '@emigrate/plugin-tools';
import {
  type LoaderPlugin,
  type MigrationFunction,
  type MigrationMetadata,
  type MigrationMetadataFinished,
} from '@emigrate/plugin-tools/types';
import {
  BadOptionError,
  EmigrateError,
  MigrationHistoryError,
  MigrationLoadError,
  MigrationRunError,
  MissingOptionError,
  StorageInitError,
} from '../errors.js';
import { type Config } from '../types.js';
import { withLeadingPeriod } from '../with-leading-period.js';
import { getMigrations as getMigrationsOriginal, type GetMigrationsFunction } from '../get-migrations.js';
import { getDuration } from '../get-duration.js';

type ExtraFlags = {
  cwd?: string;
  dry?: boolean;
  getMigrations?: GetMigrationsFunction;
};

const lazyDefaultReporter = async () => import('../reporters/default.js');
const lazyPluginLoaderJs = async () => import('../plugin-loader-js.js');

const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

type Fn<Args extends any[], Result> = (...args: Args) => Result;
type Result<T> = [value: T, error: undefined] | [value: undefined, error: Error];

/**
 * Execute a function and return a result tuple
 *
 * This is a helper function to make it easier to handle errors without the extra nesting of try/catch
 */
const exec = async <Args extends any[], Return extends Promise<any>>(
  fn: Fn<Args, Return>,
  ...args: Args
): Promise<Result<Awaited<Return>>> => {
  try {
    const result = await fn(...args);

    return [result, undefined];
  } catch (error) {
    return [undefined, toError(error)];
  }
};

export default async function upCommand({
  storage: storageConfig,
  reporter: reporterConfig,
  directory,
  dry = false,
  plugins = [],
  cwd = process.cwd(),
  getMigrations = getMigrationsOriginal,
}: Config & ExtraFlags): Promise<number> {
  if (!directory) {
    throw new MissingOptionError('directory');
  }

  const storagePlugin = await getOrLoadStorage([storageConfig]);

  if (!storagePlugin) {
    throw new BadOptionError('storage', 'No storage found, please specify a storage using the storage option');
  }

  const reporter = await getOrLoadReporter([reporterConfig ?? lazyDefaultReporter]);

  if (!reporter) {
    throw new BadOptionError(
      'reporter',
      'No reporter found, please specify an existing reporter using the reporter option',
    );
  }

  await reporter.onInit?.({ command: 'up', cwd, dry, directory });

  const [storage, storageError] = await exec(async () => storagePlugin.initializeStorage());

  if (storageError) {
    await reporter.onFinished?.([], new StorageInitError('Could not initialize storage', { cause: storageError }));

    return 1;
  }

  const migrationFiles = await getMigrations(cwd, directory);
  const failedEntries: MigrationMetadataFinished[] = [];

  for await (const migrationHistoryEntry of storage.getHistory()) {
    const index = migrationFiles.findIndex((migrationFile) => migrationFile.name === migrationHistoryEntry.name);

    if (index === -1) {
      // Only care about entries that exists in the current migration directory
      continue;
    }

    if (migrationHistoryEntry.status === 'failed') {
      const filePath = path.resolve(cwd, directory, migrationHistoryEntry.name);
      const finishedMigration: MigrationMetadataFinished = {
        name: migrationHistoryEntry.name,
        status: migrationHistoryEntry.status,
        filePath,
        relativeFilePath: path.relative(cwd, filePath),
        extension: withLeadingPeriod(path.extname(migrationHistoryEntry.name)),
        error: new MigrationHistoryError(
          `Migration ${migrationHistoryEntry.name} is in a failed state, please fix and remove it first`,
          migrationHistoryEntry,
        ),
        directory,
        cwd,
        duration: 0,
      };
      failedEntries.push(finishedMigration);
    }

    migrationFiles.splice(index, 1);
  }

  const migrationFileExtensions = new Set(migrationFiles.map((migration) => migration.extension));
  const loaderPlugins = await getOrLoadPlugins('loader', [lazyPluginLoaderJs, ...plugins]);

  const loaderByExtension = new Map<string, LoaderPlugin | undefined>(
    [...migrationFileExtensions].map(
      (extension) =>
        [
          extension,
          loaderPlugins.find((plugin) =>
            plugin.loadableExtensions.some((loadableExtension) => withLeadingPeriod(loadableExtension) === extension),
          ),
        ] as const,
    ),
  );

  for await (const [extension, loader] of loaderByExtension) {
    if (!loader) {
      const finishedMigrations: MigrationMetadataFinished[] = [...failedEntries];

      for await (const failedEntry of failedEntries) {
        await reporter.onMigrationError?.(failedEntry, failedEntry.error!);
      }

      for await (const migration of migrationFiles) {
        if (migration.extension === extension) {
          const error = new BadOptionError('plugin', `No loader plugin found for file extension: ${extension}`);
          const finishedMigration: MigrationMetadataFinished = { ...migration, duration: 0, status: 'failed', error };
          await reporter.onMigrationError?.(finishedMigration, error);
          finishedMigrations.push(finishedMigration);
        } else {
          const finishedMigration: MigrationMetadataFinished = { ...migration, duration: 0, status: 'skipped' };
          await reporter.onMigrationSkip?.(finishedMigration);
          finishedMigrations.push(finishedMigration);
        }
      }

      await reporter.onFinished?.(
        finishedMigrations,
        new BadOptionError('plugin', `No loader plugin found for file extension: ${extension}`),
      );

      return 1;
    }
  }

  await reporter.onCollectedMigrations?.([...failedEntries, ...migrationFiles]);

  if (migrationFiles.length === 0 || dry || failedEntries.length > 0) {
    const error = failedEntries.find((migration) => migration.status === 'failed')?.error;
    await reporter.onLockedMigrations?.(migrationFiles);

    const finishedMigrations: MigrationMetadataFinished[] = migrationFiles.map((migration) => ({
      ...migration,
      duration: 0,
      status: 'pending',
    }));

    for await (const failedMigration of failedEntries) {
      await reporter.onMigrationError?.(failedMigration, failedMigration.error!);
    }

    for await (const migration of finishedMigrations) {
      await reporter.onMigrationSkip?.(migration);
    }

    await reporter.onFinished?.([...failedEntries, ...finishedMigrations], error);

    return failedEntries.length > 0 ? 1 : 0;
  }

  let lockedMigrationFiles: MigrationMetadata[] = [];

  try {
    lockedMigrationFiles = (await storage.lock(migrationFiles)) ?? [];

    await reporter.onLockedMigrations?.(lockedMigrationFiles);
  } catch (error) {
    for await (const migration of migrationFiles) {
      await reporter.onMigrationSkip?.({ ...migration, duration: 0, status: 'skipped' });
    }

    await reporter.onFinished?.([], toError(error));

    return 1;
  }

  const nonLockedMigrations = migrationFiles.filter((migration) => !lockedMigrationFiles.includes(migration));

  for await (const migration of nonLockedMigrations) {
    await reporter.onMigrationSkip?.({ ...migration, duration: 0, status: 'skipped' });
  }

  let cleaningUp: Promise<void> | undefined;

  const cleanup = async () => {
    if (cleaningUp) {
      return cleaningUp;
    }

    process.off('SIGINT', cleanup);
    process.off('SIGTERM', cleanup);

    cleaningUp = storage.unlock(lockedMigrationFiles);

    return cleaningUp;
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const finishedMigrations: MigrationMetadataFinished[] = [];

  try {
    for await (const migration of lockedMigrationFiles) {
      const lastMigrationStatus = finishedMigrations.at(-1)?.status;

      if (lastMigrationStatus === 'failed' || lastMigrationStatus === 'skipped') {
        const finishedMigration: MigrationMetadataFinished = { ...migration, status: 'skipped', duration: 0 };
        await reporter.onMigrationSkip?.(finishedMigration);
        finishedMigrations.push(finishedMigration);
        continue;
      }

      await reporter.onMigrationStart?.(migration);

      const loader = loaderByExtension.get(migration.extension)!;
      const start = process.hrtime();

      let migrationFunction: MigrationFunction;

      try {
        try {
          migrationFunction = await loader.loadMigration(migration);
        } catch (error) {
          throw new MigrationLoadError(`Failed to load migration file: ${migration.relativeFilePath}`, migration, {
            cause: error,
          });
        }

        await migrationFunction();

        const duration = getDuration(start);
        const finishedMigration: MigrationMetadataFinished = { ...migration, status: 'done', duration };

        await storage.onSuccess(finishedMigration);
        await reporter.onMigrationSuccess?.(finishedMigration);

        finishedMigrations.push(finishedMigration);
      } catch (error) {
        const errorInstance = toError(error);
        const serializedError = serializeError(errorInstance);
        const duration = getDuration(start);
        const finishedMigration: MigrationMetadataFinished = {
          ...migration,
          status: 'failed',
          duration,
          error: serializedError,
        };

        await storage.onError(finishedMigration, serializedError);
        await reporter.onMigrationError?.(finishedMigration, errorInstance);

        finishedMigrations.push(finishedMigration);
      }
    }

    const firstFailed = finishedMigrations.find((migration) => migration.status === 'failed');

    return firstFailed ? 1 : 0;
  } finally {
    const firstFailed = finishedMigrations.find((migration) => migration.status === 'failed');
    const firstError =
      firstFailed?.error instanceof EmigrateError
        ? firstFailed.error
        : firstFailed
          ? new MigrationRunError(`Failed to run migration: ${firstFailed.relativeFilePath}`, firstFailed, {
              cause: firstFailed?.error,
            })
          : undefined;

    await cleanup();
    await reporter.onFinished?.(finishedMigrations, firstError);
  }
}

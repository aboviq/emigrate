import process from 'node:process';
import { getOrLoadPlugins, getOrLoadReporter, getOrLoadStorage } from '@emigrate/plugin-tools';
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
} from './errors.js';
import { type Config } from './types.js';
import { withLeadingPeriod } from './with-leading-period.js';
import pluginLoaderJs from './plugin-loader-js.js';

type ExtraFlags = {
  dry?: boolean;
};

const getDuration = (start: [number, number]) => {
  const [seconds, nanoseconds] = process.hrtime(start);
  return seconds * 1000 + nanoseconds / 1_000_000;
};

const lazyDefaultReporter = async () => import('./plugin-reporter-default.js');

export default async function upCommand({
  storage: storageConfig,
  reporter: reporterConfig,
  directory,
  dry = false,
  plugins = [],
}: Config & ExtraFlags) {
  if (!directory) {
    throw new MissingOptionError('directory');
  }

  const cwd = process.cwd();
  const storagePlugin = await getOrLoadStorage([storageConfig]);

  if (!storagePlugin) {
    throw new BadOptionError('storage', 'No storage found, please specify a storage using the storage option');
  }

  const storage = await storagePlugin.initializeStorage();
  const reporter = await getOrLoadReporter([lazyDefaultReporter, reporterConfig]);

  if (!reporter) {
    throw new BadOptionError('reporter', 'No reporter found, please specify a reporter using the reporter option');
  }

  await reporter.onInit?.({ cwd, dry, directory });

  const path = await import('node:path');
  const fs = await import('node:fs/promises');

  const allFilesInMigrationDirectory = await fs.readdir(path.resolve(process.cwd(), directory), {
    withFileTypes: true,
  });

  const migrationFiles: MigrationMetadata[] = allFilesInMigrationDirectory
    .filter((file) => file.isFile() && !file.name.startsWith('.') && !file.name.startsWith('_'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name }) => {
      const filePath = path.resolve(process.cwd(), directory, name);

      return {
        name,
        filePath,
        relativeFilePath: path.relative(cwd, filePath),
        extension: withLeadingPeriod(path.extname(name)),
        directory,
        cwd,
      };
    });

  let migrationHistoryError: MigrationHistoryError | undefined;

  for await (const migrationHistoryEntry of storage.getHistory()) {
    if (migrationHistoryEntry.status === 'failed') {
      migrationHistoryError = new MigrationHistoryError(
        `Migration ${migrationHistoryEntry.name} is in a failed state, please fix it first`,
        migrationHistoryEntry,
      );
    }

    const index = migrationFiles.findIndex((migrationFile) => migrationFile.name === migrationHistoryEntry.name);

    if (index !== -1) {
      migrationFiles.splice(index, 1);
    }
  }

  const migrationFileExtensions = new Set(migrationFiles.map((migration) => migration.extension));
  const loaderPlugins = await getOrLoadPlugins('loader', [pluginLoaderJs, ...plugins]);

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

  for (const [extension, loader] of loaderByExtension) {
    if (!loader) {
      throw new BadOptionError('plugin', `No loader plugin found for file extension: ${extension}`);
    }
  }

  await reporter.onCollectedMigrations?.(migrationFiles);

  if (migrationFiles.length === 0 || dry || migrationHistoryError) {
    await reporter.onLockedMigrations?.(migrationFiles);

    const finishedMigrations: MigrationMetadataFinished[] = migrationFiles.map((migration) => ({
      ...migration,
      duration: 0,
      status: 'skipped',
    }));

    for await (const migration of finishedMigrations) {
      await reporter.onMigrationSkip?.(migration);
    }

    await reporter.onFinished?.(finishedMigrations, migrationHistoryError);
    return;
  }

  let lockedMigrationFiles: MigrationMetadata[] = [];

  try {
    lockedMigrationFiles = await storage.lock(migrationFiles);

    await reporter.onLockedMigrations?.(lockedMigrationFiles);
  } catch (error) {
    for await (const migration of migrationFiles) {
      await reporter.onMigrationSkip?.({ ...migration, duration: 0, status: 'skipped' });
    }

    await reporter.onFinished?.([], error instanceof Error ? error : new Error(String(error)));
    return;
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
        let errorInstance = error instanceof Error ? error : new Error(String(error));

        if (!(errorInstance instanceof EmigrateError)) {
          errorInstance = new MigrationRunError(`Failed to run migration: ${migration.relativeFilePath}`, migration, {
            cause: error,
          });
        }

        const duration = getDuration(start);
        const finishedMigration: MigrationMetadataFinished = {
          ...migration,
          status: 'failed',
          duration,
          error: errorInstance,
        };

        await storage.onError(finishedMigration, errorInstance);
        await reporter.onMigrationError?.(finishedMigration, errorInstance);

        finishedMigrations.push(finishedMigration);
      }
    }
  } finally {
    const firstError = finishedMigrations.find((migration) => migration.status === 'failed')?.error;

    await cleanup();
    await reporter.onFinished?.(finishedMigrations, firstError);
  }
}

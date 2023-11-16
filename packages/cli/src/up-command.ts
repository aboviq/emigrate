import process from 'node:process';
import { getOrLoadPlugin, getOrLoadPlugins } from '@emigrate/plugin-tools';
import {
  type LoaderPlugin,
  type MigrationFunction,
  type Plugin,
  type PluginType,
  type PluginFromType,
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
import { stripLeadingPeriod } from './strip-leading-period.js';
import pluginLoaderJs from './plugin-loader-js.js';
import pluginReporterDefault from './plugin-reporter-default.js';

type ExtraFlags = {
  dry?: boolean;
};

const requirePlugin = async <T extends PluginType>(
  type: T,
  plugins: Array<Plugin | string>,
): Promise<PluginFromType<T>> => {
  const plugin = await getOrLoadPlugin(type, plugins);

  if (!plugin) {
    throw new BadOptionError(
      'plugin',
      `No ${type} plugin found, please specify a ${type} plugin using the plugin option`,
    );
  }

  return plugin;
};

const getDuration = (start: [number, number]) => {
  const [seconds, nanoseconds] = process.hrtime(start);
  return seconds * 1000 + nanoseconds / 1_000_000;
};

export default async function upCommand({ directory, dry = false, plugins = [] }: Config & ExtraFlags) {
  if (!directory) {
    throw new MissingOptionError('directory');
  }

  const cwd = process.cwd();
  const storagePlugin = await requirePlugin('storage', plugins);
  const storage = await storagePlugin.initializeStorage();
  const reporter = await requirePlugin('reporter', [pluginReporterDefault, ...plugins]);

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
        extension: stripLeadingPeriod(path.extname(name)),
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
            plugin.loadableExtensions.some((loadableExtension) => stripLeadingPeriod(loadableExtension) === extension),
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
    await reporter.onLockedMigrations?.([]);

    for await (const migration of migrationFiles) {
      await reporter.onMigrationSkip?.(migration);
    }

    await reporter.onFinished?.(
      migrationFiles.map((migration) => ({ ...migration, status: 'skipped', duration: 0 })),
      migrationHistoryError,
    );
    return;
  }

  const lockedMigrationFiles = await storage.lock(migrationFiles);

  let cleaningUp = false;

  const cleanup = async () => {
    if (cleaningUp) {
      return;
    }

    process.off('SIGINT', cleanup);
    process.off('SIGTERM', cleanup);

    cleaningUp = true;
    await storage.unlock(lockedMigrationFiles);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const finishedMigrations: MigrationMetadataFinished[] = [];

  try {
    for await (const migration of lockedMigrationFiles) {
      const lastMigrationStatus = finishedMigrations.at(-1)?.status;

      if (lastMigrationStatus === 'failed' || lastMigrationStatus === 'skipped') {
        await reporter.onMigrationSkip?.(migration);
        finishedMigrations.push({ ...migration, status: 'skipped', duration: 0 });
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
          status: 'done',
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

    await reporter.onFinished?.(finishedMigrations, firstError);
    await cleanup();
  }
}

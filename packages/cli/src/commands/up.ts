import process from 'node:process';
import { getOrLoadPlugins, getOrLoadReporter, getOrLoadStorage } from '@emigrate/plugin-tools';
import { isFinishedMigration, type LoaderPlugin } from '@emigrate/plugin-tools/types';
import { BadOptionError, MigrationLoadError, MissingOptionError, StorageInitError } from '../errors.js';
import { type Config } from '../types.js';
import { withLeadingPeriod } from '../with-leading-period.js';
import { type GetMigrationsFunction } from '../get-migrations.js';
import { exec } from '../exec.js';
import { migrationRunner } from '../migration-runner.js';
import { filterAsync } from '../filter-async.js';
import { collectMigrations } from '../collect-migrations.js';
import { arrayFromAsync } from '../array-from-async.js';

type ExtraFlags = {
  cwd?: string;
  dry?: boolean;
  getMigrations?: GetMigrationsFunction;
};

const lazyDefaultReporter = async () => import('../reporters/default.js');
const lazyPluginLoaderJs = async () => import('../plugin-loader-js.js');

export default async function upCommand({
  storage: storageConfig,
  reporter: reporterConfig,
  directory,
  dry = false,
  plugins = [],
  cwd = process.cwd(),
  getMigrations,
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

  const collectedMigrations = filterAsync(
    collectMigrations(cwd, directory, storage.getHistory(), getMigrations),
    (migration) => !isFinishedMigration(migration) || migration.status === 'failed',
  );

  const loaderPlugins = await getOrLoadPlugins('loader', [lazyPluginLoaderJs, ...plugins]);

  const loaderByExtension = new Map<string, LoaderPlugin | undefined>();

  const getLoaderByExtension = (extension: string) => {
    if (!loaderByExtension.has(extension)) {
      const loader = loaderPlugins.find((plugin) =>
        plugin.loadableExtensions.some((loadableExtension) => withLeadingPeriod(loadableExtension) === extension),
      );

      loaderByExtension.set(extension, loader);
    }

    return loaderByExtension.get(extension);
  };

  const error = await migrationRunner({
    dry,
    reporter,
    storage,
    migrations: await arrayFromAsync(collectedMigrations),
    async validate(migration) {
      const loader = getLoaderByExtension(migration.extension);

      if (!loader) {
        throw new BadOptionError('plugin', `No loader plugin found for file extension: ${migration.extension}`);
      }
    },
    async execute(migration) {
      const loader = getLoaderByExtension(migration.extension)!;
      const [migrationFunction, loadError] = await exec(async () => loader.loadMigration(migration));

      if (loadError) {
        throw new MigrationLoadError(`Failed to load migration file: ${migration.relativeFilePath}`, migration, {
          cause: loadError,
        });
      }

      await migrationFunction();
    },
  });

  return error ? 1 : 0;
}

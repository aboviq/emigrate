import path from 'node:path';
import { getOrLoadPlugins, getOrLoadReporter, getOrLoadStorage } from '@emigrate/plugin-tools';
import { isFinishedMigration, type LoaderPlugin } from '@emigrate/types';
import {
  BadOptionError,
  MigrationLoadError,
  MissingOptionError,
  StorageInitError,
  toError,
  toSerializedError,
} from '../errors.js';
import { type Config } from '../types.js';
import { withLeadingPeriod } from '../with-leading-period.js';
import { type GetMigrationsFunction } from '../get-migrations.js';
import { exec } from '../exec.js';
import { migrationRunner } from '../migration-runner.js';
import { collectMigrations } from '../collect-migrations.js';
import { version } from '../get-package-info.js';
import { getStandardReporter } from '../reporters/get.js';

type ExtraFlags = {
  cwd: string;
  dry?: boolean;
  limit?: number;
  from?: string;
  to?: string;
  noExecution?: boolean;
  getMigrations?: GetMigrationsFunction;
  abortSignal?: AbortSignal;
  abortRespite?: number;
};

const lazyPluginLoaderJs = async () => import('../plugin-loader-js.js');

export default async function upCommand({
  storage: storageConfig,
  reporter: reporterConfig,
  directory,
  color,
  limit,
  from,
  to,
  noExecution,
  abortSignal,
  abortRespite,
  dry = false,
  plugins = [],
  cwd,
  getMigrations,
}: Config & ExtraFlags): Promise<number> {
  if (!directory) {
    throw MissingOptionError.fromOption('directory');
  }

  const storagePlugin = await getOrLoadStorage([storageConfig]);

  if (!storagePlugin) {
    throw BadOptionError.fromOption('storage', 'No storage found, please specify a storage using the storage option');
  }

  const reporter = getStandardReporter(reporterConfig) ?? (await getOrLoadReporter([reporterConfig]));

  if (!reporter) {
    throw BadOptionError.fromOption(
      'reporter',
      'No reporter found, please specify an existing reporter using the reporter option',
    );
  }

  await reporter.onInit?.({ command: 'up', version, cwd, dry, directory, color });

  const [storage, storageError] = await exec(async () => storagePlugin.initializeStorage());

  if (storageError) {
    await reporter.onFinished?.([], StorageInitError.fromError(storageError));

    return 1;
  }

  try {
    const collectedMigrations = collectMigrations(cwd, directory, storage.getHistory(), getMigrations);

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

    if (from && !from.includes(path.sep)) {
      from = path.join(directory, from);
    }

    if (to && !to.includes(path.sep)) {
      to = path.join(directory, to);
    }

    const error = await migrationRunner({
      dry,
      limit,
      from,
      to,
      abortSignal,
      abortRespite,
      reporter,
      storage,
      migrations: collectedMigrations,
      migrationFilter(migration) {
        return !isFinishedMigration(migration) || migration.status === 'failed';
      },
      async validate(migration) {
        if (noExecution) {
          return;
        }

        const loader = getLoaderByExtension(migration.extension);

        if (!loader) {
          throw BadOptionError.fromOption(
            'plugin',
            `No loader plugin found for file extension: ${migration.extension}`,
          );
        }
      },
      async execute(migration) {
        if (noExecution) {
          return;
        }

        const loader = getLoaderByExtension(migration.extension)!;
        const [migrationFunction, loadError] = await exec(async () => loader.loadMigration(migration));

        if (loadError) {
          throw MigrationLoadError.fromMetadata(migration, loadError);
        }

        await migrationFunction();
      },
      async onSuccess(migration) {
        await storage.onSuccess(migration);
      },
      async onError(migration, error) {
        await storage.onError(migration, toSerializedError(error));
      },
    });

    return error ? 1 : 0;
  } catch (error) {
    await reporter.onFinished?.([], toError(error));

    return 1;
  } finally {
    await storage.end();
  }
}

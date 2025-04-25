import path from 'node:path';
import { getOrLoadPlugins, getOrLoadReporter, getOrLoadStorage } from '@emigrate/plugin-tools';
import { isFinishedMigration, type MigrationFunction } from '@emigrate/types';
import {
  BadOptionError,
  EmigrateError,
  MigrationLoadError,
  MissingOptionError,
  StorageInitError,
  toError,
  toSerializedError,
  UnexpectedError,
} from '../errors.js';
import { type DefaultConfig } from '../types.js';
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
}: DefaultConfig & ExtraFlags): Promise<number> {
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

    const loaderPlugins = await getOrLoadPlugins('loader', [...plugins, lazyPluginLoaderJs]);

    const migrationFunctions = new Map<string, MigrationFunction | undefined>();

    const getLoadersByExtension = (extension: string) => {
      return loaderPlugins.filter((plugin) =>
        plugin.loadableExtensions.some((loadableExtension) => withLeadingPeriod(loadableExtension) === extension),
      );
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

        const loaders = getLoadersByExtension(migration.extension);

        if (loaders.length === 0) {
          throw BadOptionError.fromOption(
            'plugin',
            `No loader plugin found for file extension: ${migration.extension}`,
          );
        }

        const [migrationFunction, loadError] = await exec(async () => {
          for await (const loader of loaders) {
            const migrationFunction = await loader.loadMigration(migration);

            if (migrationFunction) {
              return migrationFunction;
            }
          }

          if (noExecution) {
            // It doesn't matter if the migration can't be loaded if we're not going to execute it
            return;
          }

          throw BadOptionError.fromOption('plugin', `No loader plugin could load: ${migration.relativeFilePath}`);
        });

        if (loadError instanceof EmigrateError) {
          throw loadError;
        } else if (loadError) {
          throw MigrationLoadError.fromMetadata(migration, loadError);
        }

        migrationFunctions.set(migration.filePath, migrationFunction);
      },
      async execute(migration) {
        if (noExecution) {
          return;
        }

        const migrationFunction = migrationFunctions.get(migration.filePath);

        if (!migrationFunction) {
          throw new UnexpectedError(`No migration function loaded for: ${migration.relativeFilePath}`);
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

    migrationFunctions.clear();

    return error ? 1 : 0;
  } catch (error) {
    await reporter.onFinished?.([], toError(error));

    return 1;
  } finally {
    await storage.end();
  }
}

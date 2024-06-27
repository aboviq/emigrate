import path from 'node:path';
import { getOrLoadReporter, getOrLoadStorage } from '@emigrate/plugin-tools';
import { type MigrationMetadata, isFinishedMigration } from '@emigrate/types';
import {
  BadOptionError,
  MigrationNotRunError,
  MigrationRemovalError,
  MissingArgumentsError,
  MissingOptionError,
  OptionNeededError,
  StorageInitError,
  toError,
} from '../errors.js';
import { type Config } from '../types.js';
import { exec } from '../exec.js';
import { version } from '../get-package-info.js';
import { collectMigrations } from '../collect-migrations.js';
import { migrationRunner } from '../migration-runner.js';
import { arrayMapAsync } from '../array-map-async.js';
import { type GetMigrationsFunction } from '../get-migrations.js';
import { getStandardReporter } from '../reporters/get.js';

type ExtraFlags = {
  cwd: string;
  force?: boolean;
  getMigrations?: GetMigrationsFunction;
};

type RemovableMigrationMetadata = MigrationMetadata & { originalStatus?: 'done' | 'failed' };

export default async function removeCommand(
  {
    directory,
    reporter: reporterConfig,
    storage: storageConfig,
    color,
    cwd,
    force = false,
    getMigrations,
  }: Config & ExtraFlags,
  name: string,
): Promise<number> {
  if (!directory) {
    throw MissingOptionError.fromOption('directory');
  }

  if (!name) {
    throw MissingArgumentsError.fromArgument('name');
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

  await reporter.onInit?.({ command: 'remove', version, cwd, dry: false, directory, color });

  const [storage, storageError] = await exec(async () => storagePlugin.initializeStorage());

  if (storageError) {
    await reporter.onFinished?.([], StorageInitError.fromError(storageError));

    return 1;
  }

  try {
    const collectedMigrations = arrayMapAsync(
      collectMigrations(cwd, directory, storage.getHistory(), getMigrations),
      (migration) => {
        if (isFinishedMigration(migration)) {
          if (migration.status === 'failed') {
            const { status, duration, error, ...pendingMigration } = migration;
            const removableMigration: RemovableMigrationMetadata = { ...pendingMigration, originalStatus: status };

            return removableMigration;
          }

          if (migration.status === 'done') {
            const { status, duration, ...pendingMigration } = migration;
            const removableMigration: RemovableMigrationMetadata = { ...pendingMigration, originalStatus: status };

            return removableMigration;
          }

          throw new Error(`Unexpected migration status: ${migration.status}`);
        }

        return migration as RemovableMigrationMetadata;
      },
    );

    if (!name.includes(path.sep)) {
      name = path.join(directory, name);
    }

    const error = await migrationRunner({
      dry: false,
      lock: false,
      name,
      reporter,
      storage,
      migrations: collectedMigrations,
      migrationFilter(migration) {
        return migration.relativeFilePath === name;
      },
      async validate(migration) {
        if (migration.originalStatus === 'done' && !force) {
          throw OptionNeededError.fromOption(
            'force',
            `The migration "${migration.name}" is not in a failed state. Use the "force" option to force its removal`,
          );
        }

        if (!migration.originalStatus) {
          throw MigrationNotRunError.fromMetadata(migration);
        }
      },
      async execute(migration) {
        try {
          await storage.remove(migration);
        } catch (error) {
          throw MigrationRemovalError.fromMetadata(migration, toError(error));
        }
      },
      async onSuccess() {
        // No-op
      },
      async onError() {
        // No-op
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

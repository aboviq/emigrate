import process from 'node:process';
import { getOrLoadReporter, getOrLoadStorage } from '@emigrate/plugin-tools';
import { type MigrationHistoryEntry, type MigrationMetadataFinished } from '@emigrate/types';
import {
  BadOptionError,
  MigrationNotRunError,
  MissingArgumentsError,
  MissingOptionError,
  OptionNeededError,
  StorageInitError,
} from '../errors.js';
import { type Config } from '../types.js';
import { getMigration } from '../get-migration.js';
import { getDuration } from '../get-duration.js';
import { exec } from '../exec.js';
import { version } from '../get-package-info.js';

type ExtraFlags = {
  force?: boolean;
};

const lazyDefaultReporter = async () => import('../reporters/default.js');

export default async function removeCommand(
  { directory, reporter: reporterConfig, storage: storageConfig, force }: Config & ExtraFlags,
  name: string,
) {
  if (!directory) {
    throw MissingOptionError.fromOption('directory');
  }

  if (!name) {
    throw MissingArgumentsError.fromArgument('name');
  }

  const cwd = process.cwd();
  const storagePlugin = await getOrLoadStorage([storageConfig]);

  if (!storagePlugin) {
    throw BadOptionError.fromOption('storage', 'No storage found, please specify a storage using the storage option');
  }

  const reporter = await getOrLoadReporter([reporterConfig ?? lazyDefaultReporter]);

  if (!reporter) {
    throw BadOptionError.fromOption(
      'reporter',
      'No reporter found, please specify an existing reporter using the reporter option',
    );
  }

  const [storage, storageError] = await exec(async () => storagePlugin.initializeStorage());

  if (storageError) {
    await reporter.onFinished?.([], StorageInitError.fromError(storageError));

    return 1;
  }

  await reporter.onInit?.({ command: 'remove', version, cwd, dry: false, directory });

  const [migrationFile, fileError] = await exec(async () => getMigration(cwd, directory, name, !force));

  if (fileError) {
    await reporter.onFinished?.([], fileError);

    await storage.end();

    return 1;
  }

  const finishedMigrations: MigrationMetadataFinished[] = [];
  let historyEntry: MigrationHistoryEntry | undefined;
  let removalError: Error | undefined;

  for await (const migrationHistoryEntry of storage.getHistory()) {
    if (migrationHistoryEntry.name !== migrationFile.name) {
      continue;
    }

    if (migrationHistoryEntry.status === 'done' && !force) {
      removalError = OptionNeededError.fromOption(
        'force',
        `The migration "${migrationFile.name}" is not in a failed state. Use the "force" option to force its removal`,
      );
    } else {
      historyEntry = migrationHistoryEntry;
    }
  }

  await reporter.onMigrationRemoveStart?.(migrationFile);

  const start = process.hrtime();

  if (historyEntry) {
    try {
      await storage.remove(migrationFile);

      const duration = getDuration(start);
      const finishedMigration: MigrationMetadataFinished = { ...migrationFile, status: 'done', duration };

      await reporter.onMigrationRemoveSuccess?.(finishedMigration);

      finishedMigrations.push(finishedMigration);
    } catch (error) {
      removalError = error instanceof Error ? error : new Error(String(error));
    }
  } else if (!removalError) {
    removalError = MigrationNotRunError.fromMetadata(migrationFile);
  }

  if (removalError) {
    const duration = getDuration(start);
    const finishedMigration: MigrationMetadataFinished = {
      ...migrationFile,
      status: 'failed',
      error: removalError,
      duration,
    };
    await reporter.onMigrationRemoveError?.(finishedMigration, removalError);
    finishedMigrations.push(finishedMigration);
  }

  await reporter.onFinished?.(finishedMigrations, removalError);

  await storage.end();

  return removalError ? 1 : 0;
}

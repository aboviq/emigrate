import process from 'node:process';
import path from 'node:path';
import { getOrLoadReporter, getOrLoadStorage } from '@emigrate/plugin-tools';
import { type MigrationMetadataFinished } from '@emigrate/plugin-tools/types';
import { BadOptionError, MigrationHistoryError, MissingOptionError, StorageInitError } from '../errors.js';
import { type Config } from '../types.js';
import { withLeadingPeriod } from '../with-leading-period.js';
import { getMigrations } from '../get-migrations.js';
import { exec } from '../exec.js';

const lazyDefaultReporter = async () => import('../reporters/default.js');

export default async function listCommand({ directory, reporter: reporterConfig, storage: storageConfig }: Config) {
  if (!directory) {
    throw new MissingOptionError('directory');
  }

  const cwd = process.cwd();
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

  await reporter.onInit?.({ command: 'list', cwd, dry: false, directory });

  const [storage, storageError] = await exec(async () => storagePlugin.initializeStorage());

  if (storageError) {
    await reporter.onFinished?.([], new StorageInitError('Could not initialize storage', { cause: storageError }));

    return 1;
  }

  const migrationFiles = await getMigrations(cwd, directory);

  let migrationHistoryError: MigrationHistoryError | undefined;

  const finishedMigrations: MigrationMetadataFinished[] = [];

  for await (const migrationHistoryEntry of storage.getHistory()) {
    const index = migrationFiles.findIndex((migrationFile) => migrationFile.name === migrationHistoryEntry.name);

    if (index === -1) {
      // Only care about entries that exists in the current migration directory
      continue;
    }

    const filePath = path.resolve(cwd, directory, migrationHistoryEntry.name);
    const finishedMigration: MigrationMetadataFinished = {
      name: migrationHistoryEntry.name,
      status: migrationHistoryEntry.status,
      filePath,
      relativeFilePath: path.relative(cwd, filePath),
      extension: withLeadingPeriod(path.extname(migrationHistoryEntry.name)),
      directory,
      cwd,
      duration: 0,
    };

    if (migrationHistoryEntry.status === 'failed') {
      migrationHistoryError = new MigrationHistoryError(
        `Migration ${migrationHistoryEntry.name} is in a failed state`,
        migrationHistoryEntry,
      );

      await reporter.onMigrationError?.(finishedMigration, migrationHistoryError);
    } else {
      await reporter.onMigrationSuccess?.(finishedMigration);
    }

    finishedMigrations.push(finishedMigration);

    migrationFiles.splice(index, 1);
  }

  for await (const migration of migrationFiles) {
    const finishedMigration: MigrationMetadataFinished = { ...migration, status: 'pending', duration: 0 };
    await reporter.onMigrationSkip?.(finishedMigration);
    finishedMigrations.push(finishedMigration);
  }

  await reporter.onFinished?.(finishedMigrations, migrationHistoryError);

  await storage.end();

  return migrationHistoryError ? 1 : 0;
}

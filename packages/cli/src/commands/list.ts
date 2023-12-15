import process from 'node:process';
import { getOrLoadReporter, getOrLoadStorage } from '@emigrate/plugin-tools';
import { BadOptionError, MissingOptionError, StorageInitError, toError } from '../errors.js';
import { type Config } from '../types.js';
import { exec } from '../exec.js';
import { migrationRunner } from '../migration-runner.js';
import { arrayFromAsync } from '../array-from-async.js';
import { collectMigrations } from '../collect-migrations.js';
import { version } from '../get-package-info.js';

const lazyDefaultReporter = async () => import('../reporters/default.js');

export default async function listCommand({ directory, reporter: reporterConfig, storage: storageConfig }: Config) {
  if (!directory) {
    throw MissingOptionError.fromOption('directory');
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

  await reporter.onInit?.({ command: 'list', version, cwd, dry: false, directory });

  const [storage, storageError] = await exec(async () => storagePlugin.initializeStorage());

  if (storageError) {
    await reporter.onFinished?.([], StorageInitError.fromError(storageError));

    return 1;
  }

  try {
    const collectedMigrations = collectMigrations(cwd, directory, storage.getHistory());

    const error = await migrationRunner({
      dry: true,
      reporter,
      storage,
      migrations: await arrayFromAsync(collectedMigrations),
      async validate() {
        // No-op
      },
      async execute() {
        throw new Error('Unexpected execute call');
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

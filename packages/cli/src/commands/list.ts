import { getOrLoadReporter, getOrLoadStorage } from '@emigrate/plugin-tools';
import { BadOptionError, MissingOptionError, StorageInitError, toError } from '../errors.js';
import { type DefaultConfig } from '../types.js';
import { exec } from '../exec.js';
import { migrationRunner } from '../migration-runner.js';
import { collectMigrations } from '../collect-migrations.js';
import { version } from '../get-package-info.js';
import { getStandardReporter } from '../reporters/get.js';

type ExtraFlags = {
  cwd: string;
};

export default async function listCommand({
  directory,
  reporter: reporterConfig,
  storage: storageConfig,
  color,
  cwd,
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

  await reporter.onInit?.({ command: 'list', version, cwd, dry: false, directory, color });

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
      migrations: collectedMigrations,
      async validate() {
        // No-op
      },
      async execute() {
        throw new Error('Unexpected execute call');
      },
      async onSuccess() {
        throw new Error('Unexpected onSuccess call');
      },
      async onError() {
        throw new Error('Unexpected onError call');
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

import process from 'node:process';
import { getOrLoadPlugin, getOrLoadPlugins } from '@emigrate/plugin-tools';
import { type LoaderPlugin } from '@emigrate/plugin-tools/types';
import { ShowUsageError } from './show-usage-error.js';
import { type Config } from './types.js';
import { stripLeadingPeriod } from './strip-leading-period.js';
import pluginLoaderJs from './plugin-loader-js.js';

type ExtraFlags = {
  dry?: boolean;
};

export default async function upCommand({ directory, dry, plugins = [] }: Config & ExtraFlags) {
  if (!directory) {
    throw new ShowUsageError('Missing required option: directory');
  }

  const storagePlugin = await getOrLoadPlugin('storage', plugins);

  if (!storagePlugin) {
    throw new Error('No storage plugin found, please specify a storage plugin using the plugin option');
  }

  const storage = await storagePlugin.initializeStorage();
  const path = await import('node:path');
  const fs = await import('node:fs/promises');

  const allFilesInMigrationDirectory = await fs.readdir(path.resolve(process.cwd(), directory), {
    withFileTypes: true,
  });

  const migrationFiles = allFilesInMigrationDirectory
    .filter((file) => file.isFile() && !file.name.startsWith('.') && !file.name.startsWith('_'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((file) => file.name);

  for await (const migrationHistoryEntry of storage.getHistory()) {
    if (migrationHistoryEntry.status === 'failed') {
      throw new Error(`Migration ${migrationHistoryEntry.name} is in a failed state, please fix it first`);
    }

    if (migrationFiles.includes(migrationHistoryEntry.name)) {
      migrationFiles.splice(migrationFiles.indexOf(migrationHistoryEntry.name), 1);
    }
  }

  const migrationFileExtensions = new Set(migrationFiles.map((file) => stripLeadingPeriod(path.extname(file))));
  const loaderPlugins = await getOrLoadPlugins('loader', [...plugins, pluginLoaderJs]);

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
      throw new Error(`No loader plugin found for file extension: ${extension}`);
    }
  }

  if (dry) {
    console.log('Pending migrations:');
    console.log(migrationFiles.map((file) => ` - ${file}`).join('\n'));
    console.log('\nDry run, exiting...');
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

  try {
    for await (const name of lockedMigrationFiles) {
      console.log(' -', name, '...');

      const extension = stripLeadingPeriod(path.extname(name));
      const cwd = process.cwd();
      const filePath = path.resolve(cwd, directory, name);
      const relativeFilePath = path.relative(cwd, filePath);
      const loader = loaderByExtension.get(extension)!;

      const migration = await loader.loadMigration({ name, filePath, relativeFilePath, cwd, directory, extension });

      try {
        await migration();

        console.log(' -', name, 'done');

        await storage.onSuccess(name);
      } catch (error) {
        const errorInstance = error instanceof Error ? error : new Error(String(error));

        console.error(' -', name, 'failed:', errorInstance.message);

        await storage.onError(name, errorInstance);
        throw error;
      }
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

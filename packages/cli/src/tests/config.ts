import { defineConfig } from '../config/index.js';
import inline from '../plugins/inline.js';
import type { EmigrateConfig } from '../types/config.js';
import type { MigrationFunction } from '../types/migrations.js';
import type { EmigratePlugin } from '../types/plugins.js';
import { getMockedPlugin, type MockedPlugin } from './plugin.js';
import { getMockedStorage, type MockedStorage } from './storage.js';

export const getMockedConfig = (
  migrations: Array<[MigrationFunction, 'pending' | 'done'] | [MigrationFunction, 'failed', Error]>,
  options: { history?: Array<[string] | [string, Error]> } = {},
): { config: EmigrateConfig; storage: MockedStorage; plugin: MockedPlugin } => {
  const historyEntries =
    options.history ??
    migrations
      .filter(([_, status]) => status !== 'pending')
      .map((entry) => {
        if (entry[1] === 'failed') {
          return [entry[0].name, entry[2]];
        }

        return [entry[0].name];
      });

  const storage = getMockedStorage(historyEntries);

  const plugin = getMockedPlugin();

  const debugPlugin: EmigratePlugin = {
    name: 'emigrate-plugin-debug',
    hooks: {
      'emigrate:migrations:collected': ({ migrations, logger }) => {
        if (migrations.size === 0) {
          logger.debug('No migrations collected');
          return;
        }

        logger.debug('Collected migrations', {
          migrations: [...migrations.keys()],
        });
      },
      'emigrate:migrations:loaded': ({ migrations, logger }) => {
        if (migrations.size === 0) {
          logger.debug('No migrations loaded');
          return;
        }

        logger.debug('Loaded migrations', {
          migrations: [...migrations.keys()],
        });
      },
      'emigrate:migration:execute': ({ migration, logger }) => {
        logger.debug(`Executing migration: ${migration.identifier}`, { migration });
      },
      'emigrate:migration:wait': ({ migration, logger }) => {
        logger.debug(`Waiting for migration: ${migration.identifier}`, { migration });
      },
      'emigrate:migration:done': ({ migration, logger }) => {
        logger.debug(`Migration done: ${migration.identifier}`, { migration });
      },
      'emigrate:command:done': ({ error, logger }) => {
        if (error) {
          logger.debug(`Command failed with error: ${error.message}`, { error });
        } else {
          logger.debug('Command completed successfully');
        }
      },
    },
  };

  return {
    storage,
    plugin,
    config: defineConfig({
      storage,
      plugins: [inline(migrations.map((entry) => entry[0])), plugin, debugPlugin],
    }),
  };
};

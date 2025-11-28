import { promisify } from 'node:util';

import type { EmigratePlugin } from '../types/plugins.js';
import type { CollectedMigration, MigrationFunction } from '../types/migrations.js';

declare global {
  namespace Emigrate {
    export interface MigrationMetadata {
      'directory-plugin'?: DirectoryPluginMigrationMetadata;
    }
  }
}

interface DirectoryPluginMigrationMetadata {
  /**
   * The name of the migration file
   *
   * @example 20210901123456000_create_users_table.js
   */
  name: string;
  /**
   * The directory where the migration file is located, relative to the current working directory
   *
   * @example migrations
   */
  directory: string;
  /**
   * The full absolute path to the migration file
   *
   * @example /home/user/project/migrations/20210901123456000_create_users_table.js
   */
  filePath: string;
  /**
   * The relative path to the migration file, relative to the current working directory
   *
   * @example migrations/20210901123456000_create_users_table.js
   */
  relativeFilePath: string;
  /**
   * The current working directory
   *
   * @default process.cwd()
   */
  cwd: string;
  /**
   * The extension of the migration file, with a leading period
   *
   * @example .js
   */
  extension: string;
}

// eslint-disable-next-line @typescript-eslint/ban-types
const promisifyIfNeeded = <T extends Function>(fn: T) => {
  if (fn.length === 0) {
    return fn as unknown as MigrationFunction;
  }

  if (fn.length === 1) {
    return promisify(fn) as MigrationFunction;
  }

  throw new Error(
    `Unexpected arguments length of migration function, expected 0 or 1 argument but got: ${fn.length} arguments`,
  );
};

const loadableExtensions = ['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts'];

const getMigrationFunction = async (migration: CollectedMigration): Promise<MigrationFunction> => {
  const meta = migration.meta['directory-plugin'];

  if (!meta) {
    throw new Error(`Missing directory-plugin metadata for migration: ${migration.identifier}`);
  }

  const migrationModule: unknown = await import(meta.filePath);

  if (typeof migrationModule === 'function') {
    return promisifyIfNeeded(migrationModule);
  }

  if (
    migrationModule &&
    typeof migrationModule === 'object' &&
    'default' in migrationModule &&
    typeof migrationModule.default === 'function'
  ) {
    return promisifyIfNeeded(migrationModule.default);
  }

  if (
    migrationModule &&
    typeof migrationModule === 'object' &&
    'up' in migrationModule &&
    typeof migrationModule.up === 'function'
  ) {
    return promisifyIfNeeded(migrationModule.up);
  }

  throw new Error(`Migration file does not export a migration function: ${meta.relativeFilePath}`);
};

const createDirectoryPlugin = (directory: string): EmigratePlugin => {
  const directoryLoadPlugin: EmigratePlugin = {
    name: 'emigrate-plugin-directory/load',
    hooks: {
      'emigrate:migrations:load': async ({ migration, loadedMigrations, setMigrationFunction }) => {
        // Skip if already loaded or not a directory migration
        if (
          loadedMigrations.has(migration.identifier) ||
          !migration.meta['directory-plugin'] ||
          !loadableExtensions.includes(migration.meta['directory-plugin'].extension)
        ) {
          return;
        }

        const migrationFunction = await getMigrationFunction(migration);

        setMigrationFunction(migrationFunction);
      },
    },
  };

  return {
    name: 'emigrate-plugin-directory',
    hooks: {
      'emigrate:config:setup': ({ updateConfig }) => {
        // Add the directory load plugin to the config plugins
        // this way it's run after user-defined plugins, so any custom loaders have priority
        updateConfig({ plugins: [directoryLoadPlugin] });
      },
      'emigrate:migrations:collect': async ({ collectMigration }) => {
        const { getMigrations } = await import('../get-migrations.js');

        const migrations = await getMigrations(process.cwd(), directory);

        for (const migration of migrations) {
          collectMigration({
            identifier: migration.name,
            meta: {
              'directory-plugin': migration,
            },
          });
        }
      },
    },
  };
};

export default createDirectoryPlugin;

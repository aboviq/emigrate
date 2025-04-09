import { promisify } from 'node:util';
import { type LoaderPlugin, type MigrationFunction } from '@emigrate/types';

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

const loaderJs: LoaderPlugin = {
  loadableExtensions: ['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts'],
  async loadMigration(migration) {
    const migrationModule: unknown = await import(migration.filePath);

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

    throw new Error(`Migration file does not export a migration function: ${migration.relativeFilePath}`);
  },
};

export default loaderJs;

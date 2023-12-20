import { promisify } from 'node:util';
import { type LoaderPlugin } from '@emigrate/types';

// eslint-disable-next-line @typescript-eslint/ban-types
const promisifyIfNeeded = <T extends Function>(fn: T) => {
  if (fn.length === 0) {
    return fn;
  }

  if (fn.length === 1) {
    return promisify(fn);
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
      return async () => {
        await promisifyIfNeeded(migrationModule)();
      };
    }

    if (
      migrationModule &&
      typeof migrationModule === 'object' &&
      'default' in migrationModule &&
      typeof migrationModule.default === 'function'
    ) {
      const migrationFunction = migrationModule.default;
      return async () => {
        await promisifyIfNeeded(migrationFunction)();
      };
    }

    if (
      migrationModule &&
      typeof migrationModule === 'object' &&
      'up' in migrationModule &&
      typeof migrationModule.up === 'function'
    ) {
      const migrationFunction = migrationModule.up;
      return async () => {
        await promisifyIfNeeded(migrationFunction)();
      };
    }

    return async () => {
      throw new Error(`Migration file does not export a function: ${migration.relativeFilePath}`);
    };
  },
};

export default loaderJs;

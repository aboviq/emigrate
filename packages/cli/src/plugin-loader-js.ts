import { type LoaderPlugin } from '@emigrate/plugin-tools/types';

const loaderJs: LoaderPlugin = {
  loadableExtensions: ['.js', '.cjs', '.mjs'],
  async loadMigration(migration) {
    const migrationModule: unknown = await import(migration.filePath);

    if (typeof migrationModule === 'function') {
      return async () => {
        await migrationModule();
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
        await migrationFunction();
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
        await migrationFunction();
      };
    }

    return async () => {
      throw new Error(`Migration file does not export a function: ${migration.relativeFilePath}`);
    };
  },
};

export default loaderJs;

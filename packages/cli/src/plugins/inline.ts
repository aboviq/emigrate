/* eslint-disable @typescript-eslint/naming-convention */
import type { EmigratePlugin } from '../types/plugins.js';
import type { Awaitable } from '../types/utils.js';

const createInlinePlugin = (migrations: Array<() => Awaitable<void>>): EmigratePlugin => {
  return {
    name: 'emigrate-plugin-inline',
    hooks: {
      'emigrate:migrations:collect'({ collectMigration }) {
        for (const migrationFunction of migrations) {
          if (!migrationFunction.name) {
            throw new Error('Inline migration functions must have a name');
          }

          collectMigration({
            identifier: migrationFunction.name,
            meta: {},
          });
        }
      },
      'emigrate:migrations:load'({ migration, setMigrationFunction }) {
        const migrationFunction = migrations.find((m) => m.name === migration.identifier);

        if (migrationFunction) {
          setMigrationFunction(migrationFunction);
        }
      },
    },
  };
};

export default createInlinePlugin;

import process from 'node:process';
import postgres, { type Options, type PostgresType, type Sql } from 'postgres';
import { getTimestampPrefix, sanitizeMigrationName } from '@emigrate/plugin-tools';
import {
  type MigrationMetadata,
  type EmigrateStorage,
  type LoaderPlugin,
  type Storage,
  type MigrationMetadataFinished,
  type GenerateMigrationFunction,
  type GeneratorPlugin,
  type SerializedError,
  type MigrationHistoryEntry,
} from '@emigrate/types';

const defaultTable = 'migrations';

type ConnectionOptions = Options<Record<string, PostgresType>>;

export type PostgresStorageOptions = {
  table?: string;
  /**
   * @see https://github.com/porsager/postgres#connection
   */
  connection: ConnectionOptions | string;
};

export type PostgresLoaderOptions = {
  /**
   * @see https://github.com/porsager/postgres#connection
   */
  connection: ConnectionOptions | string;
};

const getPool = (connection: ConnectionOptions | string) => {
  if (typeof connection === 'string') {
    return postgres(connection);
  }

  return postgres(connection);
};

const lockMigration = async (sql: Sql, table: string, migration: MigrationMetadata) => {
  const result = await sql`
    INSERT INTO ${sql(table)} (name, status, date)
    VALUES (${migration.name}, ${'locked'}, NOW())
    ON CONFLICT (name) DO NOTHING
  `;

  return result.count === 1;
};

const unlockMigration = async (sql: Sql, table: string, migration: MigrationMetadata) => {
  const result = await sql`
    DELETE FROM ${sql(table)}
    WHERE
      name = ${migration.name}
      AND status = ${'locked'}
  `;

  return result.count === 1;
};

const finishMigration = async (
  sql: Sql,
  table: string,
  migration: MigrationMetadataFinished,
  _error?: SerializedError,
) => {
  const result = await sql`
    UPDATE
      ${sql(table)}
    SET
      status = ${migration.status},
      date = NOW()
    WHERE
      name = ${migration.name}
      AND status = ${'locked'}
  `;

  return result.count === 1;
};

const deleteMigration = async (sql: Sql, table: string, migration: MigrationMetadata) => {
  const result = await sql`
    DELETE FROM ${sql(table)}
    WHERE
      name = ${migration.name}
      AND status <> ${'locked'}
  `;

  return result.count === 1;
};

const initializeTable = async (sql: Sql, table: string) => {
  const [row] = await sql<Array<{ exists: 1 }>>`
    SELECT 1 as exists
    FROM
      information_schema.tables
    WHERE
      table_schema = 'public'
      AND table_name = ${table}
  `;

  if (row?.exists) {
    return;
  }

  // This table definition is compatible with the one used by the immigration-postgres package
  await sql`
    CREATE TABLE ${sql(table)} (
      name varchar(255) not null primary key,
      status varchar(32),
      date timestamptz not null
    );
  `;
};

export const createPostgresStorage = ({
  table = defaultTable,
  connection,
}: PostgresStorageOptions): EmigrateStorage => {
  return {
    async initializeStorage() {
      const sql = getPool(connection);

      try {
        await initializeTable(sql, table);
      } catch (error) {
        await sql.end();
        throw error;
      }

      const storage: Storage = {
        async lock(migrations) {
          const lockedMigrations: MigrationMetadata[] = [];

          for await (const migration of migrations) {
            if (await lockMigration(sql, table, migration)) {
              lockedMigrations.push(migration);
            }
          }

          return lockedMigrations;
        },
        async unlock(migrations) {
          for await (const migration of migrations) {
            await unlockMigration(sql, table, migration);
          }
        },
        async remove(migration) {
          await deleteMigration(sql, table, migration);
        },
        async *getHistory() {
          const query = sql<Array<Exclude<MigrationHistoryEntry, 'error'>>>`
            SELECT
              *
            FROM
              ${sql(table)}
            WHERE
              status <> ${'locked'}
            ORDER BY
              date ASC
          `.cursor();

          for await (const [row] of query) {
            if (!row) {
              continue;
            }

            if (row.status === 'failed') {
              yield {
                ...row,
                error: { name: 'Error', message: 'Unknown error' },
              };
              continue;
            }

            yield row;
          }
        },
        async onSuccess(migration) {
          await finishMigration(sql, table, migration);
        },
        async onError(migration, error) {
          await finishMigration(sql, table, migration, error);
        },
        async end() {
          await sql.end();
        },
      };

      return storage;
    },
  };
};

export const { initializeStorage } = createPostgresStorage({
  table: process.env['POSTGRES_TABLE'],
  connection: process.env['POSTGRES_URL'] ?? {
    host: process.env['POSTGRES_HOST'],
    port: process.env['POSTGRES_PORT'] ? Number.parseInt(process.env['POSTGRES_PORT'], 10) : undefined,
    user: process.env['POSTGRES_USER'],
    password: process.env['POSTGRES_PASSWORD'],
    database: process.env['POSTGRES_DB'],
  },
});

export const createPostgresLoader = ({ connection }: PostgresLoaderOptions): LoaderPlugin => {
  return {
    loadableExtensions: ['.sql'],
    async loadMigration(migration) {
      return async () => {
        const sql = getPool(connection);

        try {
          // @ts-expect-error The "simple" option is not documented, but it exists
          await sql.file(migration.filePath, { simple: true });
        } finally {
          await sql.end();
        }
      };
    },
  };
};

export const { loadableExtensions, loadMigration } = createPostgresLoader({
  connection: process.env['POSTGRES_URL'] ?? {
    host: process.env['POSTGRES_HOST'],
    port: process.env['POSTGRES_PORT'] ? Number.parseInt(process.env['POSTGRES_PORT'], 10) : undefined,
    user: process.env['POSTGRES_USER'],
    password: process.env['POSTGRES_PASSWORD'],
    database: process.env['POSTGRES_DB'],
  },
});

export const generateMigration: GenerateMigrationFunction = async (name) => {
  return {
    filename: `${getTimestampPrefix()}_${sanitizeMigrationName(name)}.sql`,
    content: `-- Migration: ${name}
`,
  };
};

const defaultExport: EmigrateStorage & LoaderPlugin & GeneratorPlugin = {
  initializeStorage,
  loadableExtensions,
  loadMigration,
  generateMigration,
};

export default defaultExport;

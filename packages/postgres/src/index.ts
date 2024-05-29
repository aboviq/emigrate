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

const getPool = async (connection: ConnectionOptions | string): Promise<Sql> => {
  const sql = typeof connection === 'string' ? postgres(connection) : postgres(connection);

  await sql`SELECT 1`;

  return sql;
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

const getDatabaseName = (config: ConnectionOptions | string) => {
  if (typeof config === 'string') {
    const uri = new URL(config);

    return uri.pathname.replace(/^\//u, '');
  }

  return config.database ?? '';
};

const setDatabaseName = <T extends ConnectionOptions | string>(config: T, databaseName: string): T => {
  if (typeof config === 'string') {
    const uri = new URL(config);

    uri.pathname = `/${databaseName}`;

    return uri.toString() as T;
  }

  if (typeof config === 'object') {
    return {
      ...config,
      database: databaseName,
    };
  }

  throw new Error('Invalid connection config');
};

const initializeDatabase = async (config: ConnectionOptions | string) => {
  let sql: Sql | undefined;

  try {
    sql = await getPool(config);
    await sql.end();
  } catch (error) {
    await sql?.end();

    // The error code 3D000 means that the database does not exist, but the user might have the permissions to create it
    if (error && typeof error === 'object' && 'code' in error && error.code === '3D000') {
      const databaseName = getDatabaseName(config);

      const postgresConfig = setDatabaseName(config, 'postgres');

      const postgresSql = await getPool(postgresConfig);
      try {
        await postgresSql`CREATE DATABASE ${postgresSql(databaseName)}`;
        // Any database creation error here will be propagated
      } finally {
        await postgresSql.end();
      }
    } else {
      // In this case we don't know how to handle the error, so we rethrow it
      throw error;
    }
  }
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
      await initializeDatabase(connection);

      const sql = await getPool(connection);

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
        const sql = await getPool(connection);

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

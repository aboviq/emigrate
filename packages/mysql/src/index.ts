import process from 'node:process';
import fs from 'node:fs/promises';
import {
  createConnection,
  createPool,
  escapeId,
  type ConnectionOptions,
  type PoolOptions,
  type Pool,
  type ResultSetHeader,
  type RowDataPacket,
  type Connection,
} from 'mysql2/promise';
import { getTimestampPrefix, sanitizeMigrationName } from '@emigrate/plugin-tools';
import {
  type MigrationMetadata,
  type EmigrateStorage,
  type LoaderPlugin,
  type Storage,
  type MigrationStatus,
  type MigrationMetadataFinished,
  type GenerateMigrationFunction,
  type GeneratorPlugin,
  type SerializedError,
} from '@emigrate/types';

const defaultTable = 'migrations';

export type MysqlStorageOptions = {
  table?: string;
  /**
   * @see https://github.com/mysqljs/mysql#connection-options
   */
  connection: PoolOptions | string;
};

export type MysqlLoaderOptions = {
  /**
   * @see https://github.com/mysqljs/mysql#connection-options
   */
  connection: ConnectionOptions | string;
};

const getConnection = async (options: ConnectionOptions | string) => {
  let connection: Connection;

  if (typeof options === 'string') {
    const uri = new URL(options);

    // client side connectTimeout is unstable in mysql2 library
    // it throws an error you can't catch and crashes node
    // best to leave this at 0 (disabled)
    uri.searchParams.set('connectTimeout', '0');
    uri.searchParams.set('multipleStatements', 'true');

    connection = await createConnection(uri.toString());
  } else {
    connection = await createConnection({
      ...options,
      // client side connectTimeout is unstable in mysql2 library
      // it throws an error you can't catch and crashes node
      // best to leave this at 0 (disabled)
      connectTimeout: 0,
      multipleStatements: true,
    });
  }

  if (process.isBun) {
    // @ts-expect-error the connection is not in the types but it's there
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    connection.connection.stream.unref();
  }

  return connection;
};

const getPool = (connection: PoolOptions | string) => {
  if (typeof connection === 'string') {
    const uri = new URL(connection);

    // client side connectTimeout is unstable in mysql2 library
    // it throws an error you can't catch and crashes node
    // best to leave this at 0 (disabled)
    uri.searchParams.set('connectTimeout', '0');

    return createPool(uri.toString());
  }

  return createPool({
    ...connection,
    // client side connectTimeout is unstable in mysql2 library
    // it throws an error you can't catch and crashes node
    // best to leave this at 0 (disabled)
    connectTimeout: 0,
  });
};

type HistoryEntry = {
  name: string;
  status: MigrationStatus;
  date: Date;
  error?: SerializedError;
};

const lockMigration = async (pool: Pool, table: string, migration: MigrationMetadata) => {
  const [result] = await pool.execute<ResultSetHeader>({
    sql: `
      INSERT INTO ${escapeId(table)} (name, status, date)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE name = name
    `,
    values: [migration.name, 'locked'],
  });

  return result.affectedRows === 1;
};

const unlockMigration = async (pool: Pool, table: string, migration: MigrationMetadata) => {
  const [result] = await pool.execute<ResultSetHeader>({
    sql: `
      DELETE FROM ${escapeId(table)}
      WHERE
        name = ?
        AND status = ?
    `,
    values: [migration.name, 'locked'],
  });

  return result.affectedRows === 1;
};

const finishMigration = async (
  pool: Pool,
  table: string,
  migration: MigrationMetadataFinished,
  _error?: SerializedError,
) => {
  const [result] = await pool.execute<ResultSetHeader>({
    sql: `
      UPDATE
        ${escapeId(table)}
      SET
        status = ?,
        date = NOW()
      WHERE
        name = ?
        AND status = ?
    `,
    values: [migration.status, migration.name, 'locked'],
  });

  return result.affectedRows === 1;
};

const deleteMigration = async (pool: Pool, table: string, migration: MigrationMetadata) => {
  const [result] = await pool.execute<ResultSetHeader>({
    sql: `
      DELETE FROM ${escapeId(table)}
      WHERE
        name = ?
        AND status <> ?
    `,
    values: [migration.name, 'locked'],
  });

  return result.affectedRows === 1;
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
  let connection: Connection | undefined;

  try {
    connection = await getConnection(config);
    await connection.query('SELECT 1');
    await connection.end();
  } catch (error) {
    await connection?.end();

    // The ER_BAD_DB_ERROR error code is thrown when the database does not exist but the user might have the permissions to create it
    // Otherwise the error code is ER_DBACCESS_DENIED_ERROR
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_BAD_DB_ERROR') {
      const databaseName = getDatabaseName(config);

      const informationSchemaConfig = setDatabaseName(config, 'information_schema');

      const informationSchemaConnection = await getConnection(informationSchemaConfig);
      try {
        await informationSchemaConnection.query(`CREATE DATABASE ${escapeId(databaseName)}`);
        // Any database creation error here will be propagated
      } finally {
        await informationSchemaConnection.end();
      }
    } else {
      // In this case we don't know how to handle the error, so we rethrow it
      throw error;
    }
  }
};

const initializeTable = async (pool: Pool, table: string) => {
  const [result] = await pool.execute<RowDataPacket[]>({
    sql: `
      SELECT
        1 as table_exists
      FROM
        information_schema.tables
      WHERE
        table_schema = DATABASE()
        AND table_name = ?
    `,
    values: [table],
  });

  if (result[0]?.['table_exists']) {
    return;
  }

  // This table definition is compatible with the one used by the immigration-mysql package
  await pool.execute(`
    CREATE TABLE ${escapeId(table)} (
      name varchar(255) not null primary key,
      status varchar(32),
      date datetime not null
    ) Engine=InnoDB;
  `);
};

export const createMysqlStorage = ({ table = defaultTable, connection }: MysqlStorageOptions): EmigrateStorage => {
  return {
    async initializeStorage() {
      await initializeDatabase(connection);

      const pool = getPool(connection);

      if (process.isBun) {
        pool.on('connection', (connection) => {
          // @ts-expect-error stream is not in the types but it's there
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          connection.stream.unref();
        });
      }

      try {
        await initializeTable(pool, table);
      } catch (error) {
        await pool.end();
        throw error;
      }

      const storage: Storage = {
        async lock(migrations) {
          const lockedMigrations: MigrationMetadata[] = [];

          for await (const migration of migrations) {
            if (await lockMigration(pool, table, migration)) {
              lockedMigrations.push(migration);
            }
          }

          return lockedMigrations;
        },
        async unlock(migrations) {
          for await (const migration of migrations) {
            await unlockMigration(pool, table, migration);
          }
        },
        async remove(migration) {
          await deleteMigration(pool, table, migration);
        },
        async *getHistory() {
          const [rows] = await pool.execute<Array<RowDataPacket & HistoryEntry>>({
            sql: `
                SELECT
                  *
                FROM
                  ${escapeId(table)}
                WHERE
                  status <> ?
                ORDER BY
                  date ASC
              `,
            values: ['locked'],
          });

          for (const row of rows) {
            if (row.status === 'failed') {
              yield {
                name: row.name,
                status: row.status,
                date: new Date(row.date),
                error: row.error ?? { name: 'Error', message: 'Unknown error' },
              };
              continue;
            }

            yield {
              name: row.name,
              status: row.status,
              date: new Date(row.date),
            };
          }
        },
        async onSuccess(migration) {
          await finishMigration(pool, table, migration);
        },
        async onError(migration, error) {
          await finishMigration(pool, table, migration, error);
        },
        async end() {
          await pool.end();
        },
      };

      return storage;
    },
  };
};

export const { initializeStorage } = createMysqlStorage({
  table: process.env['MYSQL_TABLE'],
  connection: process.env['MYSQL_URL'] ?? {
    host: process.env['MYSQL_HOST'],
    port: process.env['MYSQL_PORT'] ? Number.parseInt(process.env['MYSQL_PORT'], 10) : undefined,
    user: process.env['MYSQL_USER'],
    password: process.env['MYSQL_PASSWORD'],
    database: process.env['MYSQL_DATABASE'],
  },
});

export const createMysqlLoader = ({ connection }: MysqlLoaderOptions): LoaderPlugin => {
  return {
    loadableExtensions: ['.sql'],
    async loadMigration(migration) {
      return async () => {
        const contents = await fs.readFile(migration.filePath, 'utf8');
        const conn = await getConnection(connection);

        try {
          await conn.query(contents);
        } finally {
          await conn.end();
        }
      };
    },
  };
};

export const { loadableExtensions, loadMigration } = createMysqlLoader({
  connection: process.env['MYSQL_URL'] ?? {
    host: process.env['MYSQL_HOST'],
    port: process.env['MYSQL_PORT'] ? Number.parseInt(process.env['MYSQL_PORT'], 10) : undefined,
    user: process.env['MYSQL_USER'],
    password: process.env['MYSQL_PASSWORD'],
    database: process.env['MYSQL_DATABASE'],
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

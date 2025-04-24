import assert from 'node:assert';
import path from 'node:path';
import { before, after, describe, it } from 'node:test';
import type { MigrationMetadata } from '@emigrate/types';
import { startDatabase, stopDatabase } from './tests/database.js';
import { createMysqlStorage } from './index.js';

let db: { port: number; host: string };

describe('emigrate-mysql', async () => {
  before(
    async () => {
      db = await startDatabase();
    },
    { timeout: 60_000 },
  );

  after(
    async () => {
      await stopDatabase();
    },
    { timeout: 10_000 },
  );

  describe('migration locks', async () => {
    it('either locks none or all of the given migrations', async () => {
      const { initializeStorage } = createMysqlStorage({
        table: 'migrations',
        connection: {
          host: db.host,
          user: 'emigrate',
          password: 'emigrate',
          database: 'emigrate',
          port: db.port,
        },
      });

      const [storage1, storage2] = await Promise.all([initializeStorage(), initializeStorage()]);

      const migrations = toMigrations('/emigrate', 'migrations', [
        '2023-10-01-01-test.js',
        '2023-10-01-02-test.js',
        '2023-10-01-03-test.js',
        '2023-10-01-04-test.js',
        '2023-10-01-05-test.js',
        '2023-10-01-06-test.js',
        '2023-10-01-07-test.js',
        '2023-10-01-08-test.js',
        '2023-10-01-09-test.js',
        '2023-10-01-10-test.js',
        '2023-10-01-11-test.js',
        '2023-10-01-12-test.js',
        '2023-10-01-13-test.js',
        '2023-10-01-14-test.js',
        '2023-10-01-15-test.js',
        '2023-10-01-16-test.js',
        '2023-10-01-17-test.js',
        '2023-10-01-18-test.js',
        '2023-10-01-19-test.js',
        '2023-10-01-20-test.js',
      ]);

      const [locked1, locked2] = await Promise.all([storage1.lock(migrations), storage2.lock(migrations)]);

      assert.strictEqual(
        locked1.length === 0 || locked2.length === 0,
        true,
        'One of the processes should have no locks',
      );
      assert.strictEqual(
        locked1.length === 20 || locked2.length === 20,
        true,
        'One of the processes should have all locks',
      );
    });
  });
});

function toMigration(cwd: string, directory: string, name: string): MigrationMetadata {
  return {
    name,
    filePath: `${cwd}/${directory}/${name}`,
    relativeFilePath: `${directory}/${name}`,
    extension: path.extname(name),
    directory,
    cwd,
  };
}

function toMigrations(cwd: string, directory: string, names: string[]): MigrationMetadata[] {
  return names.map((name) => toMigration(cwd, directory, name));
}

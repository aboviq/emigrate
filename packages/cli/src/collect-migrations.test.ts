import { describe, it } from 'node:test';
import assert from 'node:assert';
import { collectMigrations } from './collect-migrations.js';
import { toEntries, toEntry, toMigration, toMigrations } from './test-utils.js';
import { arrayFromAsync } from './array-from-async.js';
import { MigrationHistoryError } from './errors.js';

describe('collect-migrations', () => {
  it('returns all migrations from the history and all pending migrations', async () => {
    const cwd = '/cwd';
    const directory = 'directory';
    const history = {
      async *[Symbol.asyncIterator]() {
        yield* toEntries(['migration1.js', 'migration2.js']);
      },
    };
    const getMigrations = async () => toMigrations(cwd, directory, ['migration1.js', 'migration2.js', 'migration3.js']);

    const result = await arrayFromAsync(collectMigrations(cwd, directory, history, getMigrations));

    assert.deepStrictEqual(result, [
      {
        ...toMigration(cwd, directory, 'migration1.js'),
        duration: 0,
        status: 'done',
      },
      {
        ...toMigration(cwd, directory, 'migration2.js'),
        duration: 0,
        status: 'done',
      },
      toMigration(cwd, directory, 'migration3.js'),
    ]);
  });

  it('includes any errors from the history', async () => {
    const entry = toEntry('migration1.js', 'failed');
    const cwd = '/cwd';
    const directory = 'directory';
    const history = {
      async *[Symbol.asyncIterator]() {
        yield* [entry];
      },
    };
    const getMigrations = async () => toMigrations(cwd, directory, ['migration1.js', 'migration2.js', 'migration3.js']);

    const result = await arrayFromAsync(collectMigrations(cwd, directory, history, getMigrations));

    assert.deepStrictEqual(result, [
      {
        ...toMigration(cwd, directory, 'migration1.js'),
        duration: 0,
        status: 'failed',
        error: MigrationHistoryError.fromHistoryEntry(entry),
      },
      toMigration(cwd, directory, 'migration2.js'),
      toMigration(cwd, directory, 'migration3.js'),
    ]);
  });

  it('can handle a migration history without file extensions', async () => {
    const cwd = '/cwd';
    const directory = 'directory';
    const history = {
      async *[Symbol.asyncIterator]() {
        yield* toEntries(['migration1']);
      },
    };
    const getMigrations = async () => toMigrations(cwd, directory, ['migration1.js', 'migration2.js', 'migration3.js']);

    const result = await arrayFromAsync(collectMigrations(cwd, directory, history, getMigrations));

    assert.deepStrictEqual(result, [
      { ...toMigration(cwd, directory, 'migration1.js'), duration: 0, status: 'done' },
      toMigration(cwd, directory, 'migration2.js'),
      toMigration(cwd, directory, 'migration3.js'),
    ]);
  });

  it('can handle a migration history without file extensions even if the migration name contains periods', async () => {
    const cwd = '/cwd';
    const directory = 'directory';
    const history = {
      async *[Symbol.asyncIterator]() {
        yield* toEntries(['mig.ration1']);
      },
    };
    const getMigrations = async () =>
      toMigrations(cwd, directory, ['mig.ration1.js', 'migration2.js', 'migration3.js']);

    const result = await arrayFromAsync(collectMigrations(cwd, directory, history, getMigrations));

    assert.deepStrictEqual(result, [
      { ...toMigration(cwd, directory, 'mig.ration1.js'), duration: 0, status: 'done' },
      toMigration(cwd, directory, 'migration2.js'),
      toMigration(cwd, directory, 'migration3.js'),
    ]);
  });
});

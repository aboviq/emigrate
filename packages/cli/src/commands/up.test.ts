import { describe, it, mock, type Mock } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import {
  type EmigrateReporter,
  type MigrationHistoryEntry,
  type MigrationMetadata,
  type Storage,
  type Plugin,
  type SerializedError,
  type FailedMigrationHistoryEntry,
  type NonFailedMigrationHistoryEntry,
} from '@emigrate/types';
import { deserializeError } from 'serialize-error';
import { version } from '../get-package-info.js';
import upCommand from './up.js';

type Mocked<T> = {
  // @ts-expect-error - This is a mock
  [K in keyof T]: Mock<T[K]>;
};

describe('up', () => {
  it('returns 0 and finishes without an error when there are no migrations to run', async () => {
    const { reporter, run } = getUpCommand([], getStorage([]));

    const exitCode = await run();

    assert.strictEqual(exitCode, 0);
    assert.strictEqual(reporter.onInit.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
      {
        command: 'up',
        cwd: '/emigrate',
        dry: false,
        color: undefined,
        version,
        directory: 'migrations',
      },
    ]);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 0);
    assert.strictEqual(reporter.onFinished.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onFinished.mock.calls[0]?.arguments, [[], undefined]);
  });

  it('returns 0 and finishes without an error when all migrations have already been run', async () => {
    const { reporter, run } = getUpCommand(['my_migration.js'], getStorage(['my_migration.js']));

    const exitCode = await run();

    assert.strictEqual(exitCode, 0);
    assert.strictEqual(reporter.onInit.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
      {
        command: 'up',
        cwd: '/emigrate',
        dry: false,
        color: undefined,
        version,
        directory: 'migrations',
      },
    ]);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 0);
    assert.strictEqual(reporter.onFinished.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onFinished.mock.calls[0]?.arguments, [[], undefined]);
  });

  it('returns 0 and finishes without an error when all migrations have already been run even when the history responds without file extensions', async () => {
    const { reporter, run } = getUpCommand(['my_migration.js'], getStorage(['my_migration']));

    const exitCode = await run();

    assert.strictEqual(exitCode, 0);
    assert.strictEqual(reporter.onInit.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
      {
        command: 'up',
        cwd: '/emigrate',
        dry: false,
        color: undefined,
        version,
        directory: 'migrations',
      },
    ]);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 0);
    assert.strictEqual(reporter.onFinished.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onFinished.mock.calls[0]?.arguments, [[], undefined]);
  });

  it('returns 1 and finishes with an error when there are migration file extensions without a corresponding loader plugin', async () => {
    const { reporter, run } = getUpCommand(['some_other.js', 'some_file.sql'], getStorage([]));

    const exitCode = await run();

    assert.strictEqual(exitCode, 1);
    assert.strictEqual(reporter.onInit.mock.calls.length, 1);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 1);
    const args = reporter.onFinished.mock.calls[0]?.arguments;
    assert.strictEqual(args?.length, 2);
    const entries = args[0];
    const error = args[1];
    assert.deepStrictEqual(
      entries.map((entry) => `${entry.name} (${entry.status})`),
      ['some_other.js (skipped)', 'some_file.sql (failed)'],
    );
    assert.strictEqual(entries.length, 2);
    assert.strictEqual(error?.message, 'No loader plugin found for file extension: .sql');
  });

  it('returns 1 and finishes with an error when there are migration file extensions without a corresponding loader plugin in dry-run mode as well', async () => {
    const { reporter, run } = getUpCommand(['some_other.js', 'some_file.sql'], getStorage([]));

    const exitCode = await run();

    assert.strictEqual(exitCode, 1);
    assert.strictEqual(reporter.onInit.mock.calls.length, 1);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 1);
    const args = reporter.onFinished.mock.calls[0]?.arguments;
    assert.strictEqual(args?.length, 2);
    const entries = args[0];
    const error = args[1];
    assert.strictEqual(entries.length, 2);
    assert.deepStrictEqual(
      entries.map((entry) => `${entry.name} (${entry.status})`),
      ['some_other.js (skipped)', 'some_file.sql (failed)'],
    );
    assert.strictEqual(error?.message, 'No loader plugin found for file extension: .sql');
  });

  it('returns 1 and finishes with an error when there are failed migrations in the history', async () => {
    const failedEntry = toEntry('some_failed_migration.js', 'failed');
    const { reporter, run } = getUpCommand([failedEntry.name, 'some_file.js'], getStorage([failedEntry]));

    const exitCode = await run();

    assert.strictEqual(exitCode, 1);
    assert.strictEqual(reporter.onInit.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
      {
        command: 'up',
        cwd: '/emigrate',
        version,
        dry: false,
        color: undefined,
        directory: 'migrations',
      },
    ]);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 1);
    assert.deepStrictEqual(
      getErrorCause(reporter.onMigrationError.mock.calls[0]?.arguments[1]),
      deserializeError(failedEntry.error),
    );
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 1);
    assert.strictEqual(reporter.onFinished.mock.calls.length, 1);
    const [entries, error] = reporter.onFinished.mock.calls[0]?.arguments ?? [];
    assert.strictEqual(
      error?.message,
      `Migration ${failedEntry.name} is in a failed state, it should be fixed and removed`,
    );
    assert.deepStrictEqual(getErrorCause(error), deserializeError(failedEntry.error));
    assert.strictEqual(entries?.length, 2);
    assert.deepStrictEqual(
      entries.map((entry) => `${entry.name} (${entry.status})`),
      ['some_failed_migration.js (failed)', 'some_file.js (skipped)'],
    );
  });

  it('returns 1 and finishes with an error when there are failed migrations in the history in dry-run mode as well', async () => {
    const failedEntry = toEntry('some_failed_migration.js', 'failed');
    const { reporter, run } = getUpCommand([failedEntry.name, 'some_file.js'], getStorage([failedEntry]));

    const exitCode = await run(true);

    assert.strictEqual(exitCode, 1);
    assert.strictEqual(reporter.onInit.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
      {
        command: 'up',
        cwd: '/emigrate',
        version,
        dry: true,
        color: undefined,
        directory: 'migrations',
      },
    ]);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 1);
    assert.deepStrictEqual(
      getErrorCause(reporter.onMigrationError.mock.calls[0]?.arguments[1]),
      deserializeError(failedEntry.error),
    );
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 1);
    assert.strictEqual(reporter.onFinished.mock.calls.length, 1);
    const [entries, error] = reporter.onFinished.mock.calls[0]?.arguments ?? [];
    assert.strictEqual(
      error?.message,
      `Migration ${failedEntry.name} is in a failed state, it should be fixed and removed`,
    );
    assert.deepStrictEqual(getErrorCause(error), deserializeError(failedEntry.error));
    assert.strictEqual(entries?.length, 2);
    assert.deepStrictEqual(
      entries.map((entry) => `${entry.name} (${entry.status})`),
      ['some_failed_migration.js (failed)', 'some_file.js (pending)'],
    );
  });

  it('returns 0 and finishes without an error when the failed migrations in the history are not part of the current set of migrations', async () => {
    const failedEntry = toEntry('some_failed_migration.js', 'failed');
    const { reporter, run } = getUpCommand([], getStorage([failedEntry]));

    const exitCode = await run();

    assert.strictEqual(exitCode, 0);
    assert.strictEqual(reporter.onInit.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
      {
        command: 'up',
        cwd: '/emigrate',
        version,
        dry: false,
        color: undefined,
        directory: 'migrations',
      },
    ]);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 0);
    assert.strictEqual(reporter.onFinished.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onFinished.mock.calls[0]?.arguments, [[], undefined]);
  });

  it("returns 1 and finishes with an error when the storage couldn't be initialized", async () => {
    const { reporter, run } = getUpCommand(['some_migration.js']);

    const exitCode = await run();

    assert.strictEqual(exitCode, 1);
    assert.strictEqual(reporter.onInit.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
      {
        command: 'up',
        cwd: '/emigrate',
        version,
        dry: false,
        color: undefined,
        directory: 'migrations',
      },
    ]);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 0);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 0);
    assert.strictEqual(reporter.onFinished.mock.calls.length, 1);
    const args = reporter.onFinished.mock.calls[0]?.arguments;
    assert.strictEqual(args?.length, 2);
    const entries = args[0];
    const error = args[1];
    const cause = getErrorCause(error);
    assert.deepStrictEqual(entries, []);
    assert.strictEqual(error?.message, 'Could not initialize storage');
    assert.strictEqual(cause?.message, 'No storage configured');
  });

  it('returns 0 and finishes without an error when all pending migrations are run successfully', async () => {
    const { reporter, run } = getUpCommand(
      ['some_already_run_migration.js', 'some_migration.js', 'some_other_migration.js'],
      getStorage(['some_already_run_migration.js']),
      [
        {
          loadableExtensions: ['.js'],
          async loadMigration() {
            return async () => {
              // Success
            };
          },
        },
      ],
    );

    const exitCode = await run();

    assert.strictEqual(exitCode, 0);
    assert.strictEqual(reporter.onInit.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
      {
        command: 'up',
        cwd: '/emigrate',
        version,
        dry: false,
        color: undefined,
        directory: 'migrations',
      },
    ]);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 2);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 2);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 0);
    assert.strictEqual(reporter.onFinished.mock.calls.length, 1);
    const [entries, error] = reporter.onFinished.mock.calls[0]?.arguments ?? [];
    assert.strictEqual(error, undefined);
    assert.strictEqual(entries?.length, 2);
    assert.deepStrictEqual(
      entries.map((entry) => `${entry.name} (${entry.status})`),
      ['some_migration.js (done)', 'some_other_migration.js (done)'],
    );
  });

  it('returns 1 and finishes with an error when a pending migration throw when run', async () => {
    const { reporter, run } = getUpCommand(
      ['some_already_run_migration.js', 'some_migration.js', 'fail.js', 'some_other_migration.js'],
      getStorage(['some_already_run_migration.js']),
      [
        {
          loadableExtensions: ['.js'],
          async loadMigration(migration) {
            return async () => {
              if (migration.name === 'fail.js') {
                throw new Error('Oh noes!');
              }
            };
          },
        },
      ],
    );

    const exitCode = await run();

    assert.strictEqual(exitCode, 1);
    assert.strictEqual(reporter.onInit.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
      {
        command: 'up',
        cwd: '/emigrate',
        version,
        dry: false,
        color: undefined,
        directory: 'migrations',
      },
    ]);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 2);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationError.mock.calls[0]?.arguments[1]?.message, 'Oh noes!');
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 1);
    assert.strictEqual(reporter.onFinished.mock.calls.length, 1);
    const [entries, error] = reporter.onFinished.mock.calls[0]?.arguments ?? [];
    assert.strictEqual(error?.message, 'Failed to run migration: migrations/fail.js');
    const cause = getErrorCause(error);
    assert.strictEqual(cause?.message, 'Oh noes!');
    assert.strictEqual(entries?.length, 3);
    assert.deepStrictEqual(
      entries.map((entry) => `${entry.name} (${entry.status})`),
      ['some_migration.js (done)', 'fail.js (failed)', 'some_other_migration.js (skipped)'],
    );
  });
});

function getErrorCause(error: Error | undefined): Error | SerializedError | undefined {
  if (error?.cause instanceof Error) {
    return error.cause;
  }

  if (typeof error?.cause === 'object' && error.cause !== null) {
    return error.cause as unknown as SerializedError;
  }

  return undefined;
}

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

function toEntry(name: MigrationHistoryEntry): MigrationHistoryEntry;
function toEntry<S extends MigrationHistoryEntry['status']>(
  name: string,
  status?: S,
): S extends 'failed' ? FailedMigrationHistoryEntry : NonFailedMigrationHistoryEntry;

function toEntry(name: string | MigrationHistoryEntry, status?: 'done' | 'failed'): MigrationHistoryEntry {
  if (typeof name !== 'string') {
    return name.status === 'failed' ? name : name;
  }

  if (status === 'failed') {
    return {
      name,
      status,
      date: new Date(),
      error: { name: 'Error', message: 'Failed' },
    };
  }

  return {
    name,
    status: status ?? 'done',
    date: new Date(),
  };
}

function toEntries(
  names: Array<string | MigrationHistoryEntry>,
  status?: MigrationHistoryEntry['status'],
): MigrationHistoryEntry[] {
  return names.map((name) => (typeof name === 'string' ? toEntry(name, status) : name));
}

async function noop() {
  // noop
}

function getStorage(historyEntries: Array<string | MigrationHistoryEntry>) {
  const storage: Mocked<Storage> = {
    lock: mock.fn(async (migrations) => migrations),
    unlock: mock.fn(async () => {
      // void
    }),
    getHistory: mock.fn(async function* () {
      yield* toEntries(historyEntries);
    }),
    remove: mock.fn(),
    onSuccess: mock.fn(),
    onError: mock.fn(),
    end: mock.fn(),
  };

  return storage;
}

function getUpCommand(migrationFiles: string[], storage?: Mocked<Storage>, plugins?: Plugin[]) {
  const reporter: Mocked<Required<EmigrateReporter>> = {
    onFinished: mock.fn(noop),
    onInit: mock.fn(noop),
    onCollectedMigrations: mock.fn(noop),
    onLockedMigrations: mock.fn(noop),
    onNewMigration: mock.fn(noop),
    onMigrationRemoveStart: mock.fn(noop),
    onMigrationRemoveSuccess: mock.fn(noop),
    onMigrationRemoveError: mock.fn(noop),
    onMigrationStart: mock.fn(noop),
    onMigrationSuccess: mock.fn(noop),
    onMigrationError: mock.fn(noop),
    onMigrationSkip: mock.fn(noop),
  };

  const run = async (dry = false) => {
    return upCommand({
      cwd: '/emigrate',
      directory: 'migrations',
      storage: {
        async initializeStorage() {
          if (!storage) {
            throw new Error('No storage configured');
          }

          return storage;
        },
      },
      reporter,
      dry,
      plugins: plugins ?? [],
      async getMigrations(cwd, directory) {
        return toMigrations(cwd, directory, migrationFiles);
      },
    });
  };

  return {
    reporter,
    storage,
    run,
  };
}

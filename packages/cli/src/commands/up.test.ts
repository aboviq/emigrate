import { describe, it, mock, type Mock } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import {
  type EmigrateReporter,
  type MigrationHistoryEntry,
  type MigrationMetadata,
  type Storage,
  type Plugin,
} from '@emigrate/plugin-tools/types';
import upCommand from './up.js';

type Mocked<T> = {
  // @ts-expect-error - This is a mock
  [K in keyof T]: Mock<T[K]>;
};

describe('up', () => {
  it('returns 0 and finishes without an error when there are no migrations to run', async () => {
    const { reporter, run } = getUpCommand([], []);

    const exitCode = await run();

    assert.strictEqual(exitCode, 0);
    assert.strictEqual(reporter.onInit.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
      {
        command: 'up',
        cwd: '/emigrate',
        dry: false,
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

  it('throws when there are migration file extensions without a corresponding loader plugin', async () => {
    const { reporter, run } = getUpCommand(['some_file.sql'], []);

    await assert.rejects(
      async () => {
        return run();
      },
      {
        name: 'Error [ERR_BAD_OPT]',
        message: 'No loader plugin found for file extension: .sql',
      },
    );

    assert.strictEqual(reporter.onInit.mock.calls.length, 0);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 0);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 0);
    assert.strictEqual(reporter.onFinished.mock.calls.length, 0);
  });

  it('throws when there are migration file extensions without a corresponding loader plugin in dry-run mode as well', async () => {
    const { reporter, run } = getUpCommand(['some_file.sql'], []);

    await assert.rejects(
      async () => {
        return run(true);
      },
      {
        name: 'Error [ERR_BAD_OPT]',
        message: 'No loader plugin found for file extension: .sql',
      },
    );

    assert.strictEqual(reporter.onInit.mock.calls.length, 0);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 0);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 0);
    assert.strictEqual(reporter.onFinished.mock.calls.length, 0);
  });

  it('returns 1 and finishes with an error when there are failed migrations in the history', async () => {
    const failedEntry = toEntry('some_failed_migration.js', 'failed');
    const { reporter, run } = getUpCommand([failedEntry.name], [failedEntry]);

    const exitCode = await run();

    assert.strictEqual(exitCode, 1);
    assert.strictEqual(reporter.onInit.mock.calls.length, 1);
    assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
      {
        command: 'up',
        cwd: '/emigrate',
        dry: false,
        directory: 'migrations',
      },
    ]);
    assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 0);
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 1);
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 0);
    assert.strictEqual(reporter.onFinished.mock.calls.length, 1);
    const args = reporter.onFinished.mock.calls[0]?.arguments;
    assert.strictEqual(args?.length, 2);
    const finishedEntry = args[0]?.[0];
    const error = args[1];
    assert.strictEqual(finishedEntry?.name, failedEntry.name);
    assert.strictEqual(finishedEntry?.status, 'failed');
    assert.strictEqual(finishedEntry?.error?.cause, failedEntry.error);
    assert.strictEqual(finishedEntry.error, error);
    assert.strictEqual(error?.cause, failedEntry.error);
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

function toEntry(
  name: string | MigrationHistoryEntry,
  status: MigrationHistoryEntry['status'] = 'done',
): MigrationHistoryEntry {
  if (typeof name === 'string') {
    return {
      name,
      status,
      date: new Date(),
      error: status === 'failed' ? new Error('Failed') : undefined,
    };
  }

  return name;
}

function toEntries(
  names: Array<string | MigrationHistoryEntry>,
  status: MigrationHistoryEntry['status'] = 'done',
): MigrationHistoryEntry[] {
  return names.map((name) => toEntry(name, status));
}

async function noop() {
  // noop
}

function getUpCommand(
  migrationFiles: string[],
  historyEntries: Array<string | MigrationHistoryEntry>,
  plugins?: Plugin[],
) {
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

  const storage: Mocked<Storage> = {
    lock: mock.fn(),
    unlock: mock.fn(),
    getHistory: mock.fn(async function* () {
      yield* toEntries(historyEntries);
    }),
    remove: mock.fn(),
    onSuccess: mock.fn(),
    onError: mock.fn(),
  };

  const run = async (dry = false) => {
    return upCommand({
      cwd: '/emigrate',
      directory: 'migrations',
      storage: {
        async initializeStorage() {
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

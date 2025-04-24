import { describe, it } from 'node:test';
import assert from 'node:assert';
import { type EmigrateReporter, type Storage, type Plugin, type MigrationMetadataFinished } from '@emigrate/types';
import { deserializeError } from 'serialize-error';
import { version } from '../get-package-info.js';
import {
  BadOptionError,
  MigrationNotRunError,
  MigrationRemovalError,
  OptionNeededError,
  StorageInitError,
} from '../errors.js';
import {
  assertErrorEqualEnough,
  getErrorCause,
  getMockedReporter,
  getMockedStorage,
  toEntry,
  toMigrations,
  type Mocked,
} from '../test-utils.js';
import removeCommand from './remove.js';

describe('remove', () => {
  it("returns 1 and finishes with an error when the storage couldn't be initialized", async () => {
    const { reporter, run } = getRemoveCommand([]);

    const exitCode = await run('some_migration.js');

    assert.strictEqual(exitCode, 1, 'Exit code');
    assertPreconditionsFailed(reporter, StorageInitError.fromError(new Error('No storage configured')));
  });

  it('returns 1 and finishes with an error when the given migration has not been executed', async () => {
    const storage = getMockedStorage(['some_other_migration.js']);
    const { reporter, run } = getRemoveCommand(['some_migration.js'], storage);

    const exitCode = await run('some_migration.js');

    assert.strictEqual(exitCode, 1, 'Exit code');
    assertPreconditionsFulfilled(
      reporter,
      storage,
      [
        {
          name: 'some_migration.js',
          status: 'failed',
          error: new MigrationNotRunError('Migration "some_migration.js" is not in the migration history'),
        },
      ],
      new MigrationNotRunError('Migration "some_migration.js" is not in the migration history'),
    );
  });

  it('returns 1 and finishes with an error when the given migration is not in a failed state in the history', async () => {
    const storage = getMockedStorage(['1_old_migration.js', '2_some_migration.js', '3_new_migration.js']);
    const { reporter, run } = getRemoveCommand(['2_some_migration.js'], storage);

    const exitCode = await run('2_some_migration.js');

    assert.strictEqual(exitCode, 1, 'Exit code');
    assertPreconditionsFulfilled(
      reporter,
      storage,
      [
        {
          name: '2_some_migration.js',
          status: 'failed',
          error: OptionNeededError.fromOption(
            'force',
            'The migration "2_some_migration.js" is not in a failed state. Use the "force" option to force its removal',
          ),
        },
      ],
      OptionNeededError.fromOption(
        'force',
        'The migration "2_some_migration.js" is not in a failed state. Use the "force" option to force its removal',
      ),
    );
  });

  it('returns 1 and finishes with an error when the given migration does not exist at all', async () => {
    const storage = getMockedStorage(['some_migration.js']);
    const { reporter, run } = getRemoveCommand(['some_migration.js'], storage);

    const exitCode = await run('some_other_migration.js');

    assert.strictEqual(exitCode, 1, 'Exit code');
    assertPreconditionsFulfilled(
      reporter,
      storage,
      [],
      BadOptionError.fromOption('name', 'The migration: "migrations/some_other_migration.js" was not found'),
    );
  });

  it('returns 0, removes the migration from the history and finishes without an error when the given migration is in a failed state', async () => {
    const storage = getMockedStorage([toEntry('some_migration.js', 'failed')]);
    const { reporter, run } = getRemoveCommand(['some_migration.js'], storage);

    const exitCode = await run('some_migration.js');

    assert.strictEqual(exitCode, 0, 'Exit code');
    assertPreconditionsFulfilled(reporter, storage, [{ name: 'some_migration.js', status: 'done', started: true }]);
  });

  it('returns 0, removes the migration from the history and finishes without an error when the given migration is not in a failed state but "force" is true', async () => {
    const storage = getMockedStorage(['1_old_migration.js', '2_some_migration.js', '3_new_migration.js']);
    const { reporter, run } = getRemoveCommand(['2_some_migration.js'], storage);

    const exitCode = await run('2_some_migration.js', { force: true });

    assert.strictEqual(exitCode, 0, 'Exit code');
    assertPreconditionsFulfilled(reporter, storage, [{ name: '2_some_migration.js', status: 'done', started: true }]);
  });

  it('returns 1 and finishes with an error when the removal of the migration crashes', async () => {
    const storage = getMockedStorage([toEntry('some_migration.js', 'failed')]);
    storage.remove.mock.mockImplementation(async () => {
      throw new Error('Some error');
    });
    const { reporter, run } = getRemoveCommand(['some_migration.js'], storage);

    const exitCode = await run('some_migration.js');

    assert.strictEqual(exitCode, 1, 'Exit code');
    assertPreconditionsFulfilled(
      reporter,
      storage,
      [
        {
          name: 'some_migration.js',
          status: 'failed',
          error: new Error('Some error'),
          started: true,
        },
      ],
      new MigrationRemovalError('Failed to remove migration: migrations/some_migration.js', {
        cause: new Error('Some error'),
      }),
    );
  });
});

function getRemoveCommand(migrationFiles: string[], storage?: Mocked<Storage>, plugins?: Plugin[]) {
  const reporter = getMockedReporter();

  const run = async (
    name: string,
    options?: Omit<Parameters<typeof removeCommand>[0], 'cwd' | 'directory' | 'storage' | 'reporter' | 'plugins'>,
  ) => {
    return removeCommand(
      {
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
        plugins: plugins ?? [],
        async getMigrations(cwd, directory) {
          return toMigrations(cwd, directory, migrationFiles);
        },
        ...options,
      },
      name,
    );
  };

  return {
    reporter,
    storage,
    run,
  };
}

function assertPreconditionsFailed(reporter: Mocked<Required<EmigrateReporter>>, finishedError?: Error) {
  assert.strictEqual(reporter.onInit.mock.calls.length, 1);
  assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
    {
      command: 'remove',
      cwd: '/emigrate',
      version,
      dry: false,
      color: undefined,
      directory: 'migrations',
    },
  ]);
  assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 0, 'Collected call');
  assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 0, 'Locked call');
  assert.strictEqual(reporter.onMigrationStart.mock.calls.length, 0, 'Started migrations');
  assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 0, 'Successful migrations');
  assert.strictEqual(reporter.onMigrationError.mock.calls.length, 0, 'Failed migrations');
  assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 0, 'Total pending and skipped');
  assert.strictEqual(reporter.onFinished.mock.calls.length, 1, 'Finished called once');
  const [entries, error] = reporter.onFinished.mock.calls[0]?.arguments ?? [];
  // hackety hack:
  if (finishedError) {
    finishedError.stack = error?.stack;
  }

  assert.deepStrictEqual(error, finishedError, 'Finished error');
  const cause = getErrorCause(error);
  const expectedCause = finishedError?.cause;
  assert.deepStrictEqual(
    cause,
    expectedCause ? deserializeError(expectedCause) : expectedCause,
    'Finished error cause',
  );
  assert.strictEqual(entries?.length, 0, 'Finished entries length');
}

function assertPreconditionsFulfilled(
  reporter: Mocked<Required<EmigrateReporter>>,
  storage: Mocked<Storage>,
  expected: Array<{ name: string; status: MigrationMetadataFinished['status']; started?: boolean; error?: Error }>,
  finishedError?: Error,
) {
  assert.strictEqual(reporter.onInit.mock.calls.length, 1);
  assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
    {
      command: 'remove',
      cwd: '/emigrate',
      version,
      dry: false,
      color: undefined,
      directory: 'migrations',
    },
  ]);

  let started = 0;
  let done = 0;
  let failed = 0;
  let skipped = 0;
  let pending = 0;
  let failedAndStarted = 0;
  const failedEntries: typeof expected = [];
  const successfulEntries: typeof expected = [];

  for (const entry of expected) {
    if (entry.started) {
      started++;
    }

    // eslint-disable-next-line default-case
    switch (entry.status) {
      case 'done': {
        done++;

        if (entry.started) {
          successfulEntries.push(entry);
        }

        break;
      }

      case 'failed': {
        failed++;
        failedEntries.push(entry);

        if (entry.started) {
          failedAndStarted++;
        }

        break;
      }

      case 'skipped': {
        skipped++;
        break;
      }

      case 'pending': {
        pending++;
        break;
      }
    }
  }

  assert.strictEqual(reporter.onCollectedMigrations.mock.calls.length, 1, 'Collected call');
  assert.strictEqual(storage.lock.mock.calls.length, 0, 'Storage lock never called');
  assert.strictEqual(storage.unlock.mock.calls.length, 0, 'Storage unlock never called');
  assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 0, 'Locked call');
  assert.strictEqual(reporter.onMigrationStart.mock.calls.length, started, 'Started migrations');
  assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, successfulEntries.length, 'Successful migrations');
  assert.strictEqual(storage.remove.mock.calls.length, started, 'Storage remove called');
  assert.strictEqual(reporter.onMigrationError.mock.calls.length, failedEntries.length, 'Failed migrations');
  assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 0, 'Total pending and skipped');
  assert.strictEqual(reporter.onFinished.mock.calls.length, 1, 'Finished called once');
  const [entries, error] = reporter.onFinished.mock.calls[0]?.arguments ?? [];
  assertErrorEqualEnough(error, finishedError, 'Finished error');
  assert.strictEqual(entries?.length, expected.length, 'Finished entries length');
  assert.deepStrictEqual(
    entries.map((entry) => `${entry.name} (${entry.status})`),
    expected.map((entry) => `${entry.name} (${entry.status})`),
    'Finished entries',
  );
  assert.strictEqual(storage.end.mock.calls.length, 1, 'Storage end called once');
}

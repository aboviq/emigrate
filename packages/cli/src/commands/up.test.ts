import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import {
  type EmigrateReporter,
  type Storage,
  type Plugin,
  type SerializedError,
  type MigrationMetadataFinished,
} from '@emigrate/types';
import { deserializeError } from 'serialize-error';
import { version } from '../get-package-info.js';
import {
  BadOptionError,
  CommandAbortError,
  ExecutionDesertedError,
  MigrationHistoryError,
  MigrationRunError,
  StorageInitError,
  toSerializedError,
} from '../errors.js';
import {
  type Mocked,
  toEntry,
  toMigrations,
  getMockedReporter,
  getMockedStorage,
  getErrorCause,
} from '../test-utils.js';
import upCommand from './up.js';

describe('up', () => {
  it("returns 1 and finishes with an error when the storage couldn't be initialized", async () => {
    const { reporter, run } = getUpCommand(['some_migration.js']);

    const exitCode = await run();

    assert.strictEqual(exitCode, 1, 'Exit code');
    assertPreconditionsFailed({ dry: false }, reporter, StorageInitError.fromError(new Error('No storage configured')));
  });

  it('returns 0 and finishes without an error when there are no migrations to run', async () => {
    const storage = getMockedStorage([]);
    const { reporter, run } = getUpCommand([], storage);

    const exitCode = await run();

    assert.strictEqual(exitCode, 0, 'Exit code');
    assertPreconditionsFulfilled({ dry: false }, reporter, storage, []);
  });

  it('returns 0 and finishes without an error when all migrations have already been run', async () => {
    const storage = getMockedStorage(['my_migration.js']);
    const { reporter, run } = getUpCommand(['my_migration.js'], storage);

    const exitCode = await run();

    assert.strictEqual(exitCode, 0, 'Exit code');
    assertPreconditionsFulfilled({ dry: false }, reporter, storage, []);
  });

  it('returns 0 and finishes without an error when all migrations have already been run even when the history responds without file extensions', async () => {
    const storage = getMockedStorage(['my_migration']);
    const { reporter, run } = getUpCommand(['my_migration.js'], storage);

    const exitCode = await run();

    assert.strictEqual(exitCode, 0, 'Exit code');
    assertPreconditionsFulfilled({ dry: false }, reporter, storage, []);
  });

  it('returns 0 and finishes without an error when all pending migrations are run successfully', async () => {
    const migration = mock.fn(async () => {
      // Success
    });
    const storage = getMockedStorage(['some_already_run_migration.js']);
    const { reporter, run } = getUpCommand(
      ['some_already_run_migration.js', 'some_migration.js', 'some_other_migration.js'],
      storage,
      [
        {
          loadableExtensions: ['.js'],
          async loadMigration() {
            return migration;
          },
        },
      ],
    );

    const exitCode = await run();

    assert.strictEqual(exitCode, 0, 'Exit code');
    assertPreconditionsFulfilled({ dry: false }, reporter, storage, [
      { name: 'some_migration.js', status: 'done', started: true },
      { name: 'some_other_migration.js', status: 'done', started: true },
    ]);
    assert.strictEqual(migration.mock.calls.length, 2);
  });

  it('returns 1 and finishes with an error when a pending migration throw when run', async () => {
    const storage = getMockedStorage(['some_already_run_migration.js']);
    const { reporter, run } = getUpCommand(
      ['some_already_run_migration.js', 'some_migration.js', 'fail.js', 'some_other_migration.js'],
      storage,
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

    assert.strictEqual(exitCode, 1, 'Exit code');
    assertPreconditionsFulfilled(
      { dry: false },
      reporter,
      storage,
      [
        { name: 'some_migration.js', status: 'done', started: true },
        { name: 'fail.js', status: 'failed', started: true, error: new Error('Oh noes!') },
        { name: 'some_other_migration.js', status: 'skipped' },
      ],
      new MigrationRunError('Failed to run migration: migrations/fail.js', { cause: new Error('Oh noes!') }),
    );
  });

  describe('each migration file extension needs a corresponding loader plugin', () => {
    it('returns 1 and finishes with an error when there are migration file extensions without a corresponding loader plugin', async () => {
      const storage = getMockedStorage([]);
      const { reporter, run } = getUpCommand(['some_other.js', 'some_file.sql'], storage);

      const exitCode = await run();

      assert.strictEqual(exitCode, 1, 'Exit code');
      assertPreconditionsFulfilled(
        { dry: false },
        reporter,
        storage,
        [
          { name: 'some_other.js', status: 'skipped' },
          {
            name: 'some_file.sql',
            status: 'failed',
            error: BadOptionError.fromOption('plugin', 'No loader plugin found for file extension: .sql'),
          },
        ],
        BadOptionError.fromOption('plugin', 'No loader plugin found for file extension: .sql'),
      );
    });

    it('returns 1 and finishes with an error when there are migration file extensions without a corresponding loader plugin in dry-run mode as well', async () => {
      const storage = getMockedStorage([]);
      const { reporter, run } = getUpCommand(['some_other.js', 'some_file.sql'], storage);

      const exitCode = await run({ dry: true });

      assert.strictEqual(exitCode, 1, 'Exit code');
      assertPreconditionsFulfilled(
        { dry: true },
        reporter,
        storage,
        [
          { name: 'some_other.js', status: 'skipped' },
          {
            name: 'some_file.sql',
            status: 'failed',
            error: BadOptionError.fromOption('plugin', 'No loader plugin found for file extension: .sql'),
          },
        ],
        BadOptionError.fromOption('plugin', 'No loader plugin found for file extension: .sql'),
      );
    });
  });

  describe('failed migrations in the history are blocking', () => {
    it('returns 1 and finishes with an error when there are failed migrations in the history', async () => {
      const failedEntry = toEntry('some_failed_migration.js', 'failed');
      const storage = getMockedStorage([failedEntry]);
      const { reporter, run } = getUpCommand([failedEntry.name, 'some_file.js'], storage);

      const exitCode = await run();

      assert.strictEqual(exitCode, 1, 'Exit code');
      assertPreconditionsFulfilled(
        { dry: false },
        reporter,
        storage,
        [
          {
            name: 'some_failed_migration.js',
            status: 'failed',
            error: new MigrationHistoryError(
              'Migration some_failed_migration.js is in a failed state, it should be fixed and removed',
              { cause: failedEntry.error },
            ),
          },
          { name: 'some_file.js', status: 'skipped' },
        ],
        new MigrationHistoryError(
          'Migration some_failed_migration.js is in a failed state, it should be fixed and removed',
          { cause: failedEntry.error },
        ),
      );
    });

    it('returns 1 and finishes with an error when there are failed migrations in the history in dry-run mode as well', async () => {
      const failedEntry = toEntry('some_failed_migration.js', 'failed');
      const storage = getMockedStorage([failedEntry]);
      const { reporter, run } = getUpCommand([failedEntry.name, 'some_file.js'], storage);

      const exitCode = await run({ dry: true });

      assert.strictEqual(exitCode, 1, 'Exit code');
      assertPreconditionsFulfilled(
        { dry: true },
        reporter,
        storage,
        [
          {
            name: 'some_failed_migration.js',
            status: 'failed',
            error: new MigrationHistoryError(
              'Migration some_failed_migration.js is in a failed state, it should be fixed and removed',
              { cause: failedEntry.error },
            ),
          },
          { name: 'some_file.js', status: 'skipped' },
        ],
        new MigrationHistoryError(
          'Migration some_failed_migration.js is in a failed state, it should be fixed and removed',
          { cause: failedEntry.error },
        ),
      );
    });

    it('returns 0 and finishes without an error when the failed migrations in the history are not part of the current set of migrations', async () => {
      const failedEntry = toEntry('some_failed_migration.js', 'failed');
      const storage = getMockedStorage([failedEntry]);
      const { reporter, run } = getUpCommand([], storage);

      const exitCode = await run();

      assert.strictEqual(exitCode, 0, 'Exit code');
      assertPreconditionsFulfilled({ dry: false }, reporter, storage, []);
    });
  });

  it('returns 0 and finishes without an error when the given number of pending migrations are run successfully', async () => {
    const migration = mock.fn(async () => {
      // Success
    });
    const storage = getMockedStorage(['some_already_run_migration.js']);
    const { reporter, run } = getUpCommand(
      ['some_already_run_migration.js', 'some_migration.js', 'some_other_migration.js'],
      storage,
      [
        {
          loadableExtensions: ['.js'],
          async loadMigration() {
            return migration;
          },
        },
      ],
    );

    const exitCode = await run({ limit: 1 });

    assert.strictEqual(exitCode, 0, 'Exit code');
    assertPreconditionsFulfilled({ dry: false }, reporter, storage, [
      { name: 'some_migration.js', status: 'done', started: true },
      { name: 'some_other_migration.js', status: 'skipped' },
    ]);
    assert.strictEqual(migration.mock.calls.length, 1);
  });

  describe('limiting which pending migrations to run', () => {
    it('returns 0 and finishes without an error with the given number of pending migrations are validated and listed successfully in dry-mode', async () => {
      const storage = getMockedStorage(['some_already_run_migration.js']);
      const { reporter, run } = getUpCommand(
        ['some_already_run_migration.js', 'some_migration.js', 'some_other_migration.js'],
        storage,
      );

      const exitCode = await run({ dry: true, limit: 1 });

      assert.strictEqual(exitCode, 0, 'Exit code');
      assertPreconditionsFulfilled({ dry: true }, reporter, storage, [
        { name: 'some_migration.js', status: 'pending' },
        { name: 'some_other_migration.js', status: 'skipped' },
      ]);
    });

    it('returns 0 and finishes without an error when pending migrations after given "from" parameter are run successfully', async () => {
      const migration = mock.fn(async () => {
        // Success
      });
      const storage = getMockedStorage(['1_some_already_run_migration.js']);
      const { reporter, run } = getUpCommand(
        [
          '1_some_already_run_migration.js',
          '2_some_migration.js',
          '3_existing_migration.js',
          '4_some_other_migration.js',
        ],
        storage,
        [
          {
            loadableExtensions: ['.js'],
            async loadMigration() {
              return migration;
            },
          },
        ],
      );

      const exitCode = await run({ from: '3_existing_migration.js' });

      assert.strictEqual(exitCode, 0, 'Exit code');
      assertPreconditionsFulfilled({ dry: false }, reporter, storage, [
        { name: '2_some_migration.js', status: 'skipped' },
        { name: '3_existing_migration.js', status: 'done', started: true },
        { name: '4_some_other_migration.js', status: 'done', started: true },
      ]);
      assert.strictEqual(migration.mock.calls.length, 2);
    });

    it('returns 0 and finishes without an error when pending migrations after given "from" parameter are run successfully, when the "from" parameter is a relative path', async () => {
      const migration = mock.fn(async () => {
        // Success
      });
      const storage = getMockedStorage(['1_some_already_run_migration.js']);
      const { reporter, run } = getUpCommand(
        [
          '1_some_already_run_migration.js',
          '2_some_migration.js',
          '3_existing_migration.js',
          '4_some_other_migration.js',
        ],
        storage,
        [
          {
            loadableExtensions: ['.js'],
            async loadMigration() {
              return migration;
            },
          },
        ],
      );

      const exitCode = await run({ from: 'migrations/3_existing_migration.js' });

      assert.strictEqual(exitCode, 0, 'Exit code');
      assertPreconditionsFulfilled({ dry: false }, reporter, storage, [
        { name: '2_some_migration.js', status: 'skipped' },
        { name: '3_existing_migration.js', status: 'done', started: true },
        { name: '4_some_other_migration.js', status: 'done', started: true },
      ]);
      assert.strictEqual(migration.mock.calls.length, 2);
    });

    it('returns 0 and runs all pending migrations, if "from" is an already executed migration', async () => {
      const migration = mock.fn(async () => {
        // Success
      });
      const storage = getMockedStorage(['1_some_already_run_migration.js']);
      const { reporter, run } = getUpCommand(
        ['1_some_already_run_migration.js', '2_some_migration.js', '4_some_other_migration.js'],
        storage,
        [
          {
            loadableExtensions: ['.js'],
            async loadMigration() {
              return migration;
            },
          },
        ],
      );

      const exitCode = await run({ from: '1_some_already_run_migration.js' });

      assert.strictEqual(exitCode, 0, 'Exit code');
      assertPreconditionsFulfilled({ dry: false }, reporter, storage, [
        { name: '2_some_migration.js', status: 'done', started: true },
        { name: '4_some_other_migration.js', status: 'done', started: true },
      ]);
      assert.strictEqual(migration.mock.calls.length, 2);
    });

    it('returns 1 and finishes with an error when the given "from" migration name does not exist', async () => {
      const migration = mock.fn(async () => {
        // Success
      });
      const storage = getMockedStorage(['1_some_already_run_migration.js']);
      const { reporter, run } = getUpCommand(
        ['1_some_already_run_migration.js', '2_some_migration.js', '4_some_other_migration.js'],
        storage,
        [
          {
            loadableExtensions: ['.js'],
            async loadMigration() {
              return migration;
            },
          },
        ],
      );

      const exitCode = await run({ from: '3_non_existing_migration.js' });

      assert.strictEqual(exitCode, 1, 'Exit code');
      assertPreconditionsFulfilled(
        { dry: false },
        reporter,
        storage,
        [
          { name: '2_some_migration.js', status: 'skipped' },
          { name: '4_some_other_migration.js', status: 'skipped' },
        ],
        BadOptionError.fromOption(
          'from',
          'The "from" migration: "migrations/3_non_existing_migration.js" was not found',
        ),
      );
      assert.strictEqual(migration.mock.calls.length, 0);
    });

    it('returns 0 and finishes without an error when pending migrations after given "from" parameter are validated and listed successfully in dry-mode', async () => {
      const storage = getMockedStorage(['1_some_already_run_migration.js']);
      const { reporter, run } = getUpCommand(
        ['1_some_already_run_migration.js', '2_some_migration.js', '3_some_other_migration.js'],
        storage,
      );

      const exitCode = await run({ dry: true, from: '3_some_other_migration.js' });

      assert.strictEqual(exitCode, 0, 'Exit code');
      assertPreconditionsFulfilled({ dry: true }, reporter, storage, [
        { name: '2_some_migration.js', status: 'skipped' },
        { name: '3_some_other_migration.js', status: 'pending' },
      ]);
    });

    it('returns 0 and finishes without an error when pending migrations before given "to" parameter are run successfully', async () => {
      const migration = mock.fn(async () => {
        // Success
      });
      const storage = getMockedStorage(['1_some_already_run_migration.js']);
      const { reporter, run } = getUpCommand(
        [
          '1_some_already_run_migration.js',
          '2_some_migration.js',
          '3_existing_migration.js',
          '4_some_other_migration.js',
        ],
        storage,
        [
          {
            loadableExtensions: ['.js'],
            async loadMigration() {
              return migration;
            },
          },
        ],
      );

      const exitCode = await run({ to: '3_existing_migration.js' });

      assert.strictEqual(exitCode, 0, 'Exit code');
      assertPreconditionsFulfilled({ dry: false }, reporter, storage, [
        { name: '2_some_migration.js', status: 'done', started: true },
        { name: '3_existing_migration.js', status: 'done', started: true },
        { name: '4_some_other_migration.js', status: 'skipped' },
      ]);
      assert.strictEqual(migration.mock.calls.length, 2);
    });

    it('returns 1 and finishes with an error when the given "to" migration name does not exist', async () => {
      const migration = mock.fn(async () => {
        // Success
      });
      const storage = getMockedStorage(['1_some_already_run_migration.js']);
      const { reporter, run } = getUpCommand(
        ['1_some_already_run_migration.js', '2_some_migration.js', '4_some_other_migration.js'],
        storage,
        [
          {
            loadableExtensions: ['.js'],
            async loadMigration() {
              return migration;
            },
          },
        ],
      );

      const exitCode = await run({ to: '3_non_existing_migration.js' });

      assert.strictEqual(exitCode, 1, 'Exit code');
      assertPreconditionsFulfilled(
        { dry: false },
        reporter,
        storage,
        [
          { name: '2_some_migration.js', status: 'skipped' },
          { name: '4_some_other_migration.js', status: 'skipped' },
        ],
        BadOptionError.fromOption('to', 'The "to" migration: "migrations/3_non_existing_migration.js" was not found'),
      );
      assert.strictEqual(migration.mock.calls.length, 0);
    });

    it('returns 0 and runs no migrations, if "to" is an already executed migration', async () => {
      const migration = mock.fn(async () => {
        // Success
      });
      const storage = getMockedStorage(['1_some_already_run_migration.js']);
      const { reporter, run } = getUpCommand(
        ['1_some_already_run_migration.js', '2_some_migration.js', '4_some_other_migration.js'],
        storage,
        [
          {
            loadableExtensions: ['.js'],
            async loadMigration() {
              return migration;
            },
          },
        ],
      );

      const exitCode = await run({ to: '1_some_already_run_migration.js' });

      assert.strictEqual(exitCode, 0, 'Exit code');
      assertPreconditionsFulfilled({ dry: false }, reporter, storage, [
        { name: '2_some_migration.js', status: 'skipped' },
        { name: '4_some_other_migration.js', status: 'skipped' },
      ]);
      assert.strictEqual(migration.mock.calls.length, 0);
    });

    it('returns 0 and finishes without an error when pending migrations after given "to" parameter are validated and listed successfully in dry-mode', async () => {
      const storage = getMockedStorage(['1_some_already_run_migration.js']);
      const { reporter, run } = getUpCommand(
        [
          '1_some_already_run_migration.js',
          '2_some_migration.js',
          '3_existing_migration.js',
          '4_some_other_migration.js',
        ],
        storage,
      );

      const exitCode = await run({ dry: true, to: '3_existing_migration.js' });

      assert.strictEqual(exitCode, 0, 'Exit code');
      assertPreconditionsFulfilled({ dry: true }, reporter, storage, [
        { name: '2_some_migration.js', status: 'pending' },
        { name: '3_existing_migration.js', status: 'pending' },
        { name: '4_some_other_migration.js', status: 'skipped' },
      ]);
    });

    it('returns 0 and finishes without an error when the pending migrations fulfilling "from", "to" and "limit" are run successfully', async () => {
      const migration = mock.fn(async () => {
        // Success
      });
      const storage = getMockedStorage(['1_some_already_run_migration.js']);
      const { reporter, run } = getUpCommand(
        [
          '1_some_already_run_migration.js',
          '2_some_migration.js',
          '3_another_migration.js',
          '4_some_other_migration.js',
          '5_yet_another_migration.js',
          '6_some_more_migration.js',
        ],
        storage,
        [
          {
            loadableExtensions: ['.js'],
            async loadMigration() {
              return migration;
            },
          },
        ],
      );

      const exitCode = await run({ from: '3_another_migration.js', to: '5_yet_another_migration.js', limit: 2 });

      assert.strictEqual(exitCode, 0, 'Exit code');
      assertPreconditionsFulfilled({ dry: false }, reporter, storage, [
        { name: '2_some_migration.js', status: 'skipped' },
        { name: '3_another_migration.js', status: 'done', started: true },
        { name: '4_some_other_migration.js', status: 'done', started: true },
        { name: '5_yet_another_migration.js', status: 'skipped' },
        { name: '6_some_more_migration.js', status: 'skipped' },
      ]);
      assert.strictEqual(migration.mock.calls.length, 2);
    });
  });

  describe('marking migrations as successful without running them', () => {
    it('returns 0 and finishes without an error when the pending migrations have been marked as successful without executing them', async () => {
      const migration = mock.fn(async () => {
        // Success
      });
      const storage = getMockedStorage(['1_some_already_run_migration.js']);
      const { reporter, run } = getUpCommand(
        [
          '1_some_already_run_migration.js',
          '2_some_migration.js',
          '3_another_migration.js',
          '4_some_other_migration.js',
          '5_yet_another_migration.js',
          '6_some_more_migration.js',
        ],
        storage,
        [
          {
            loadableExtensions: ['.js'],
            async loadMigration() {
              return migration;
            },
          },
        ],
      );

      const exitCode = await run({
        from: '3_another_migration.js',
        to: '5_yet_another_migration.js',
        limit: 2,
        noExecution: true,
      });

      assert.strictEqual(exitCode, 0, 'Exit code');
      assertPreconditionsFulfilled({ dry: false }, reporter, storage, [
        { name: '2_some_migration.js', status: 'skipped' },
        { name: '3_another_migration.js', status: 'done', started: true },
        { name: '4_some_other_migration.js', status: 'done', started: true },
        { name: '5_yet_another_migration.js', status: 'skipped' },
        { name: '6_some_more_migration.js', status: 'skipped' },
      ]);
      assert.strictEqual(migration.mock.calls.length, 0);
    });
  });

  it('returns 0 and finishes without an error when the pending migrations have been marked as successful without executing them even though they have no corresponding loader', async () => {
    const migration = mock.fn(async () => {
      // Success
    });
    const storage = getMockedStorage(['1_some_already_run_migration.js']);
    const { reporter, run } = getUpCommand(
      [
        '1_some_already_run_migration.js',
        '2_some_migration.js',
        '3_another_migration.js',
        '4_some_other_migration.sql',
        '5_yet_another_migration.js',
        '6_some_more_migration.js',
      ],
      storage,
      [
        {
          loadableExtensions: ['.js'],
          async loadMigration() {
            return migration;
          },
        },
      ],
    );

    const exitCode = await run({
      from: '3_another_migration.js',
      to: '5_yet_another_migration.js',
      limit: 2,
      noExecution: true,
    });

    assert.strictEqual(exitCode, 0, 'Exit code');
    assertPreconditionsFulfilled({ dry: false }, reporter, storage, [
      { name: '2_some_migration.js', status: 'skipped' },
      { name: '3_another_migration.js', status: 'done', started: true },
      { name: '4_some_other_migration.sql', status: 'done', started: true },
      { name: '5_yet_another_migration.js', status: 'skipped' },
      { name: '6_some_more_migration.js', status: 'skipped' },
    ]);
    assert.strictEqual(migration.mock.calls.length, 0);
  });

  describe("aborting the migration process before it's finished", () => {
    it('returns 1 and finishes with a command abort error when the migration process is aborted prematurely', async () => {
      const controller = new AbortController();
      const migration = mock.fn(
        async () => {
          // Success on second call, and abort
          controller.abort(CommandAbortError.fromSignal('SIGINT'));
        },
        async () => {
          // Success on first call
        },
        { times: 1 },
      );
      const storage = getMockedStorage(['1_some_already_run_migration.js']);
      const { reporter, run } = getUpCommand(
        [
          '1_some_already_run_migration.js',
          '2_some_migration.js',
          '3_another_migration.js',
          '4_some_other_migration.js',
          '5_yet_another_migration.js',
          '6_some_more_migration.js',
        ],
        storage,
        [
          {
            loadableExtensions: ['.js'],
            async loadMigration() {
              return migration;
            },
          },
        ],
      );

      const exitCode = await run({
        abortSignal: controller.signal,
      });

      assert.strictEqual(exitCode, 1, 'Exit code');
      assertPreconditionsFulfilled(
        { dry: false },
        reporter,
        storage,
        [
          { name: '2_some_migration.js', status: 'done', started: true },
          { name: '3_another_migration.js', status: 'done', started: true },
          { name: '4_some_other_migration.js', status: 'skipped' },
          { name: '5_yet_another_migration.js', status: 'skipped' },
          { name: '6_some_more_migration.js', status: 'skipped' },
        ],
        CommandAbortError.fromSignal('SIGINT'),
      );
      assert.strictEqual(reporter.onAbort.mock.calls.length, 1);
      assert.strictEqual(migration.mock.calls.length, 2);
    });
  });

  it('returns 1 and finishes with a deserted error with a command abort error as cause when the migration process is aborted prematurely and stops waiting on migrations taking longer than the respite period after the abort', async () => {
    const controller = new AbortController();
    const migration = mock.fn(
      async () => {
        // Success on second call, and abort
        controller.abort(CommandAbortError.fromSignal('SIGINT'));
        return new Promise((resolve) => {
          setTimeout(resolve, 100); // Take longer than the respite period
        });
      },
      async () => {
        // Success on first call
      },
      { times: 1 },
    );
    const storage = getMockedStorage(['1_some_already_run_migration.js']);
    const { reporter, run } = getUpCommand(
      [
        '1_some_already_run_migration.js',
        '2_some_migration.js',
        '3_another_migration.js',
        '4_some_other_migration.js',
        '5_yet_another_migration.js',
        '6_some_more_migration.js',
      ],
      storage,
      [
        {
          loadableExtensions: ['.js'],
          async loadMigration() {
            return migration;
          },
        },
      ],
    );

    const exitCode = await run({
      abortSignal: controller.signal,
      abortRespite: 10,
    });

    assert.strictEqual(exitCode, 1, 'Exit code');
    assertPreconditionsFulfilled(
      { dry: false },
      reporter,
      storage,
      [
        { name: '2_some_migration.js', status: 'done', started: true },
        {
          name: '3_another_migration.js',
          status: 'failed',
          started: true,
          error: ExecutionDesertedError.fromReason('Deserted after 10ms', CommandAbortError.fromSignal('SIGINT')),
        },
        { name: '4_some_other_migration.js', status: 'skipped' },
        { name: '5_yet_another_migration.js', status: 'skipped' },
        { name: '6_some_more_migration.js', status: 'skipped' },
      ],
      ExecutionDesertedError.fromReason('Deserted after 10ms', CommandAbortError.fromSignal('SIGINT')),
    );
    assert.strictEqual(reporter.onAbort.mock.calls.length, 1);
    assert.strictEqual(migration.mock.calls.length, 2);
  });
});

function getUpCommand(migrationFiles: string[], storage?: Mocked<Storage>, plugins?: Plugin[]) {
  const reporter = getMockedReporter();

  const run = async (
    options?: Omit<
      Parameters<typeof upCommand>[0],
      'cwd' | 'directory' | 'storage' | 'reporter' | 'plugins' | 'getMigrations'
    >,
  ) => {
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
      plugins: plugins ?? [],
      async getMigrations(cwd, directory) {
        return toMigrations(cwd, directory, migrationFiles);
      },
      ...options,
    });
  };

  return {
    reporter,
    storage,
    run,
  };
}

function assertPreconditionsFulfilled(
  options: { dry: boolean },
  reporter: Mocked<Required<EmigrateReporter>>,
  storage: Mocked<Storage>,
  expected: Array<{ name: string; status: MigrationMetadataFinished['status']; started?: boolean; error?: Error }>,
  finishedError?: Error,
) {
  assert.strictEqual(reporter.onInit.mock.calls.length, 1);
  assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
    {
      command: 'up',
      cwd: '/emigrate',
      version,
      dry: options.dry,
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
  assert.strictEqual(reporter.onLockedMigrations.mock.calls.length, 1, 'Locked call');
  assert.strictEqual(reporter.onMigrationStart.mock.calls.length, started, 'Started migrations');
  assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, done, 'Successful migrations');
  assert.strictEqual(reporter.onMigrationError.mock.calls.length, failed, 'Failed migrations');

  assert.strictEqual(storage.onSuccess.mock.calls.length, successfulEntries.length, 'Storage onSuccess calls');
  assert.strictEqual(storage.onError.mock.calls.length, failedAndStarted, 'Storage onError calls');

  for (const [index, entry] of failedEntries.entries()) {
    if (entry.status === 'failed') {
      const error = reporter.onMigrationError.mock.calls[index]?.arguments[1];
      assert.deepStrictEqual(error, entry.error, 'Error');
      const cause = entry.error?.cause;
      assert.deepStrictEqual(error?.cause, cause ? deserializeError(cause) : cause, 'Error cause');

      if (entry.started) {
        const [finishedMigration, error] = storage.onError.mock.calls[index]?.arguments ?? [];
        assert.strictEqual(finishedMigration?.name, entry.name);
        assert.strictEqual(finishedMigration?.status, entry.status);
        assertErrorEqualEnough(error, entry.error);
      }
    }
  }

  assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, pending + skipped, 'Total pending and skipped');
  assert.strictEqual(reporter.onFinished.mock.calls.length, 1, 'Finished called once');
  const [entries, error] = reporter.onFinished.mock.calls[0]?.arguments ?? [];
  assertErrorEqualEnough(error, finishedError);

  const cause = getErrorCause(error);
  const expectedCause = finishedError?.cause;
  assert.deepStrictEqual(
    cause,
    expectedCause ? deserializeError(expectedCause) : expectedCause,
    'Finished error cause',
  );
  assert.strictEqual(entries?.length, expected.length, 'Finished entries length');
  assert.deepStrictEqual(
    entries.map((entry) => `${entry.name} (${entry.status})`),
    expected.map((entry) => `${entry.name} (${entry.status})`),
    'Finished entries',
  );

  for (const [index, entry] of successfulEntries.entries()) {
    const [finishedMigration] = storage.onSuccess.mock.calls[index]?.arguments ?? [];
    assert.strictEqual(finishedMigration?.name, entry.name);
    assert.strictEqual(finishedMigration?.status, entry.status);
  }

  assert.strictEqual(storage.end.mock.calls.length, 1, 'Storage end should always be called');
}

function assertPreconditionsFailed(
  options: { dry: boolean },
  reporter: Mocked<Required<EmigrateReporter>>,
  finishedError?: Error,
) {
  assert.strictEqual(reporter.onInit.mock.calls.length, 1);
  assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
    {
      command: 'up',
      cwd: '/emigrate',
      version,
      dry: options.dry,
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

function assertErrorEqualEnough(actual?: Error | SerializedError, expected?: Error) {
  if (expected === undefined) {
    assert.strictEqual(actual, undefined);
    return;
  }

  const {
    cause: actualCause,
    stack: actualStack,
    ...actualError
  } = actual instanceof Error ? toSerializedError(actual) : actual ?? {};
  const { cause: expectedCause, stack: expectedStack, ...expectedError } = toSerializedError(expected);
  // @ts-expect-error Ignore
  const { stack: actualCauseStack, ...actualCauseRest } = actualCause ?? {};
  // @ts-expect-error Ignore
  const { stack: expectedCauseStack, ...expectedCauseRest } = expectedCause ?? {};
  assert.deepStrictEqual(actualError, expectedError);
  assert.deepStrictEqual(actualCauseRest, expectedCauseRest);
}

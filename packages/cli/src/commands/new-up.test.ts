import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { getMockedConfig } from '../tests/config.js';
import {
  assertStorageLocked,
  assertStorageLogged,
  assertStorageUnlocked,
  assertStorageWaited,
} from '../tests/storage.js';
import { assertCommandDone, assertCommandFailed } from '../tests/plugin.js';
import { CommandAbortError, MigrationHistoryError, MigrationRunError, MigrationWaitError } from '../errors.js';
import { upCommand } from './new-up.js';

describe('new up command', () => {
  const doneMigration = mock.fn(async function doneMigration() {});
  const pendingMigration1 = mock.fn(async function pendingMigration1() {});
  const pendingMigration2 = mock.fn(async function pendingMigration2() {});
  const pendingMigration3 = mock.fn(async function pendingMigration3() {});
  const migrationError = new Error('Migration failed');
  const failedMigration = mock.fn(async function failedMigration() {});

  beforeEach(() => {
    doneMigration.mock.resetCalls();
    pendingMigration1.mock.resetCalls();
    pendingMigration2.mock.resetCalls();
    pendingMigration3.mock.resetCalls();
    failedMigration.mock.resetCalls();
  });

  /**
   * RUNNING MIGRATIONS
   */
  describe('running migrations', () => {
    it('only runs pending migrations', async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assert.strictEqual(doneMigration.mock.callCount(), 0);
      assert.strictEqual(pendingMigration1.mock.callCount(), 1);
      assert.strictEqual(pendingMigration2.mock.callCount(), 1);
    });

    it("does not run any migrations when it's a dry-run", async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand({ ...config, dry: true });

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 0);
      assert.strictEqual(pendingMigration2.mock.callCount(), 0);
    });

    it('does not run any migrations when noExecution is true', async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand({ ...config, noExecution: true });

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 0);
      assert.strictEqual(pendingMigration2.mock.callCount(), 0);
    });

    it("does not run pending migrations when they couldn't be locked", async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      storage.lock.mock.mockImplementationOnce(async () => []);

      // When
      await upCommand(config);

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 0);
    });

    it('runs pending migrations even if a following migration is done', async () => {
      // Given
      const { config } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [doneMigration, 'done'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assert.strictEqual(doneMigration.mock.callCount(), 0);
      assert.strictEqual(pendingMigration1.mock.callCount(), 1);
      assert.strictEqual(pendingMigration2.mock.callCount(), 1);
    });

    it('runs pending migrations in the registered order', async () => {
      // Given
      const callOrder: string[] = [];

      const pendingMigrationA = mock.fn(async function pendingMigrationA() {
        callOrder.push('A');
      });
      const pendingMigrationB = mock.fn(async function pendingMigrationB() {
        callOrder.push('B');
      });
      const pendingMigrationC = mock.fn(async function pendingMigrationC() {
        callOrder.push('C');
      });
      const { config } = getMockedConfig([
        [pendingMigrationA, 'pending'],
        [pendingMigrationB, 'pending'],
        [pendingMigrationC, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assert.deepStrictEqual(callOrder, ['A', 'B', 'C']);
    });

    it('only runs pending migrations within the given boundaries', async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // When
      await upCommand({ ...config, from: pendingMigration2.name, to: pendingMigration2.name });

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 0);
      assert.strictEqual(pendingMigration2.mock.callCount(), 1);
      assert.strictEqual(pendingMigration3.mock.callCount(), 0);
    });

    it('only runs as many pending migrations as the specified limit', async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // When
      await upCommand({ ...config, limit: 1 });

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 1);
      assert.strictEqual(pendingMigration2.mock.callCount(), 0);
      assert.strictEqual(pendingMigration3.mock.callCount(), 0);
    });

    it('only runs as many pending migrations as the specified limit taking given boundaries into account', async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // When
      await upCommand({ ...config, limit: 1, from: pendingMigration2.name });

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 0);
      assert.strictEqual(pendingMigration2.mock.callCount(), 1);
      assert.strictEqual(pendingMigration3.mock.callCount(), 0);
    });

    it("does not run pending migrations when there's a failed migration in the history", async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [failedMigration, 'failed', migrationError],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 0);
      assert.strictEqual(pendingMigration2.mock.callCount(), 0);
      assert.strictEqual(failedMigration.mock.callCount(), 0);
    });

    it("does not run pending migrations when there's a failed migration in the history that's outside the given boundaries", async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [failedMigration, 'failed', migrationError],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand({ ...config, from: pendingMigration2.name, to: pendingMigration2.name });

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 0);
      assert.strictEqual(pendingMigration2.mock.callCount(), 0);
      assert.strictEqual(failedMigration.mock.callCount(), 0);
    });

    it("does not run pending migrations when there's a failed migration in the history even if they are out of order", async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [failedMigration, 'failed', migrationError],
      ]);

      // When
      await upCommand(config);

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 0);
      assert.strictEqual(failedMigration.mock.callCount(), 0);
    });

    it('does not run any subsequent migrations after a failure', async () => {
      pendingMigration2.mock.mockImplementationOnce(async function pendingMigration2() {
        throw migrationError;
      });
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      await upCommand(config);

      assert.strictEqual(pendingMigration1.mock.callCount(), 1);
      assert.strictEqual(pendingMigration2.mock.callCount(), 1);
      assert.strictEqual(pendingMigration3.mock.callCount(), 0);
    });

    it('does not run any subsequent migrations after an abort', async () => {
      const abortController = new AbortController();
      const abortError = CommandAbortError.fromReason('Aborted during migration');
      pendingMigration2.mock.mockImplementationOnce(async function pendingMigration2() {
        abortController.abort(abortError);
      });
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      await upCommand({ ...config, abortSignal: abortController.signal });

      assert.strictEqual(pendingMigration1.mock.callCount(), 1);
      assert.strictEqual(pendingMigration2.mock.callCount(), 1);
      assert.strictEqual(pendingMigration3.mock.callCount(), 0);
    });

    it('runs pending migrations from the specified from boundary', async () => {
      // Given
      const { config } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // When
      await upCommand({ ...config, from: pendingMigration2.name });

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 0);
      assert.strictEqual(pendingMigration2.mock.callCount(), 1);
      assert.strictEqual(pendingMigration3.mock.callCount(), 1);
    });

    it('runs pending migrations up to the specified to boundary', async () => {
      // Given
      const { config } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // When
      await upCommand({ ...config, to: pendingMigration2.name });

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 1);
      assert.strictEqual(pendingMigration2.mock.callCount(), 1);
      assert.strictEqual(pendingMigration3.mock.callCount(), 0);
    });

    it('does not run any migrations when from is greater than all pending migrations', async () => {
      // Given
      const { config } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand({ ...config, from: 'zzz_future_migration' });

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 0);
      assert.strictEqual(pendingMigration2.mock.callCount(), 0);
    });

    it('does not run any migrations when to is less than all pending migrations', async () => {
      // Given
      const { config } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand({ ...config, to: '000_past_migration' });

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 0);
      assert.strictEqual(pendingMigration2.mock.callCount(), 0);
    });

    it('does not run any migrations when limit is 0', async () => {
      // Given
      const { config } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand({ ...config, limit: 0 });

      // Then
      assert.strictEqual(pendingMigration1.mock.callCount(), 0);
      assert.strictEqual(pendingMigration2.mock.callCount(), 0);
    });
  });

  /**
   * LOCKING MIGRATIONS
   */
  describe('locking and unlocking migrations', () => {
    it('locks all pending migrations', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assertStorageLocked(storage, [pendingMigration1.name, pendingMigration2.name]);
    });

    it("does not lock any pending migrations when it's a dry-run", async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand({ ...config, dry: true });

      // Then
      assertStorageLocked(storage, []);
    });

    it('locks all pending migrations when noExecution is true', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand({ ...config, noExecution: true });

      // Then
      assertStorageLocked(storage, [pendingMigration1.name, pendingMigration2.name]);
    });

    it('locks only pending migrations within the given boundaries', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // When
      await upCommand({ ...config, from: pendingMigration2.name, to: pendingMigration2.name });

      // Then
      assertStorageLocked(storage, [pendingMigration2.name]);
    });

    it('locks only as many pending migrations as the specified limit', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // When
      await upCommand({ ...config, limit: 2 });

      // Then
      assertStorageLocked(storage, [pendingMigration1.name, pendingMigration2.name]);
    });

    it('unlocks all pending migrations', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assertStorageUnlocked(storage, [pendingMigration1.name, pendingMigration2.name]);
    });

    it('unlocks all pending migrations when noExecution is true', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand({ ...config, noExecution: true });

      // Then
      assertStorageUnlocked(storage, [pendingMigration1.name, pendingMigration2.name]);
    });

    it('unlocks all pending migrations when a migration fails', async () => {
      // Given
      pendingMigration2.mock.mockImplementationOnce(async function pendingMigration2() {
        throw migrationError;
      });
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assertStorageUnlocked(storage, [pendingMigration1.name, pendingMigration2.name]);
    });

    it("does not unlock any pending migrations when it's a dry-run", async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand({ ...config, dry: true });

      // Then
      assertStorageUnlocked(storage, []);
    });

    it("does not unlock pending migrations when they couldn't be locked", async () => {
      const doneMigration = mock.fn(async function doneMigration() {});
      const pendingMigration = mock.fn(async function pendingMigration() {});
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration, 'pending'],
      ]);

      storage.lock.mock.mockImplementationOnce(async () => []);

      await upCommand(config);

      assertStorageUnlocked(storage, []);
    });

    it('unlocks only pending migrations within the given boundaries', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // When
      await upCommand({ ...config, from: pendingMigration2.name, to: pendingMigration2.name });

      // Then
      assertStorageUnlocked(storage, [pendingMigration2.name]);
    });

    it('unlocks only as many pending migrations as the specified limit', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // When
      await upCommand({ ...config, limit: 2 });

      // Then
      assertStorageUnlocked(storage, [pendingMigration1.name, pendingMigration2.name]);
    });

    it('unlocks all pending migrations when aborted', async () => {
      // Given
      const abortController = new AbortController();
      const abortError = CommandAbortError.fromReason('Aborted during migration');
      pendingMigration1.mock.mockImplementationOnce(async function pendingMigration1() {
        abortController.abort(abortError);
      });
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand({ ...config, abortSignal: abortController.signal });

      // Then
      assertStorageUnlocked(storage, [pendingMigration1.name, pendingMigration2.name]);
    });

    it('does not lock migrations when there is a failed migration in history', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [failedMigration, 'failed', migrationError],
        [pendingMigration1, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assertStorageLocked(storage, []);
    });

    it('does not unlock migrations when there is a failed migration in history', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [failedMigration, 'failed', migrationError],
        [pendingMigration1, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assertStorageUnlocked(storage, []);
    });
  });

  /**
   * WAITING FOR MIGRATIONS
   */
  describe('waiting for migrations', () => {
    it("waits for pending migrations, instead of executing them, when they couldn't be locked", async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      storage.lock.mock.mockImplementationOnce(async () => []);

      // When
      await upCommand(config);

      // Then
      assertStorageWaited(storage, [pendingMigration1.name]);
    });

    it('does not wait for subsequent migrations when a migration fails to be waited for', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      storage.lock.mock.mockImplementationOnce(async () => []);
      storage.wait.mock.mockImplementationOnce(async () => {
        throw new Error('Failed to wait for migration');
      });

      // When
      await upCommand(config);

      // Then
      assertStorageWaited(storage, [pendingMigration1.name]);
    });

    it("does not wait for any migrations when it's a dry-run", async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      storage.lock.mock.mockImplementationOnce(async () => []);

      // When
      await upCommand({ ...config, dry: true });

      // Then
      assertStorageWaited(storage, []);
    });

    it('waits for migrations when noExecution is true', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      storage.lock.mock.mockImplementationOnce(async () => []);

      // When
      await upCommand({ ...config, noExecution: true });

      // Then
      assertStorageWaited(storage, [pendingMigration1.name]);
    });

    it('waits for all unlocked migrations within the given boundaries', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      storage.lock.mock.mockImplementationOnce(async () => []);

      // When
      await upCommand({ ...config, from: pendingMigration2.name, to: pendingMigration2.name });

      // Then
      assertStorageWaited(storage, [pendingMigration2.name]);
    });

    it('waits for only as many migrations as specified by limit', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      storage.lock.mock.mockImplementationOnce(async () => []);

      // When
      await upCommand({ ...config, limit: 1 });

      // Then
      assertStorageWaited(storage, [pendingMigration1.name]);
    });
  });

  /**
   * LOGGING MIGRATIONS
   */
  describe('logging migrations', () => {
    it("does not log pending migrations when they couldn't be locked", async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      storage.lock.mock.mockImplementationOnce(async () => []);

      // When
      await upCommand(config);

      // Then
      assertStorageLogged(storage, []);
    });

    it("does not log pending migrations when it's a dry-run", async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      // When
      await upCommand({ ...config, dry: true });

      // Then
      assertStorageLogged(storage, []);
    });

    it('logs pending migrations when noExecution is true', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand({ ...config, noExecution: true });

      // Then
      assertStorageLogged(storage, [[pendingMigration1.name], [pendingMigration2.name]]);
    });

    it('logs migration failures', async () => {
      // Given
      pendingMigration1.mock.mockImplementationOnce(async function pendingMigration1() {
        throw migrationError;
      });
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assertStorageLogged(storage, [[pendingMigration1.name, migrationError]]);
    });

    it('logs successful migrations', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assertStorageLogged(storage, [[pendingMigration1.name], [pendingMigration2.name]]);
    });

    it('logs only successful migrations before a failure', async () => {
      // Given
      pendingMigration2.mock.mockImplementationOnce(async function pendingMigration2() {
        throw migrationError;
      });
      const { config, storage } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assertStorageLogged(storage, [[pendingMigration1.name], [pendingMigration2.name, migrationError]]);
    });
  });

  /**
   * COMMAND RESULT
   */
  describe('command result', () => {
    it('returns true when all migrations succeed', async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      const result = await upCommand(config);

      // Then
      assert.strictEqual(result, true);
    });

    it('returns true when there are no pending migrations', async () => {
      // Given
      const { config } = getMockedConfig([[doneMigration, 'done']]);

      // When
      const result = await upCommand(config);

      // Then
      assert.strictEqual(result, true);
    });

    it("returns true when it's a dry-run", async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      // When
      const result = await upCommand({ ...config, dry: true });

      // Then
      assert.strictEqual(result, true);
    });

    it('returns true when noExecution is true', async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      // When
      const result = await upCommand({ ...config, noExecution: true });

      // Then
      assert.strictEqual(result, true);
    });

    it('returns false when a migration fails', async () => {
      // Given
      pendingMigration1.mock.mockImplementationOnce(async function pendingMigration1() {
        throw migrationError;
      });
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      // When
      const result = await upCommand(config);

      // Then
      assert.strictEqual(result, false);
    });

    it("returns false when there's a failed migration in the history", async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [failedMigration, 'failed', migrationError],
        [pendingMigration1, 'pending'],
      ]);

      // When
      const result = await upCommand(config);

      // Then
      assert.strictEqual(result, false);
    });

    it('returns false when aborted', async () => {
      // Given
      const abortController = new AbortController();
      const abortError = CommandAbortError.fromReason('Aborted during migration');
      pendingMigration1.mock.mockImplementationOnce(async function pendingMigration1() {
        abortController.abort(abortError);
      });
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      // When
      const result = await upCommand({ ...config, abortSignal: abortController.signal });

      // Then
      assert.strictEqual(result, false);
    });

    it("returns true when pending migrations couldn't be locked", async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      storage.lock.mock.mockImplementationOnce(async () => []);

      // When
      const result = await upCommand(config);

      // Then
      assert.strictEqual(result, true);
    });

    it('returns false when waiting for migrations fails', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      storage.lock.mock.mockImplementationOnce(async () => []);
      storage.wait.mock.mockImplementationOnce(async () => {
        throw new Error('Failed to wait for migration');
      });

      // When
      const result = await upCommand(config);

      // Then
      assert.strictEqual(result, false);
    });

    it('returns true when there are no migrations at all', async () => {
      // Given
      const { config } = getMockedConfig([]);

      // When
      const result = await upCommand(config);

      // Then
      assert.strictEqual(result, true);
    });

    it('returns true when limit is 0', async () => {
      // Given
      const { config } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      const result = await upCommand({ ...config, limit: 0 });

      // Then
      assert.strictEqual(result, true);
    });
  });

  /**
   * PLUGIN CALLBACKS
   */
  describe('plugin callbacks', () => {
    it('calls done with the finished migrations when all migrations succeed', async () => {
      // Given
      const { config, plugin } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assertCommandDone(plugin, [
        [pendingMigration1.name, 'done'],
        [pendingMigration2.name, 'done'],
      ]);
    });

    it('calls done without finished migrations when there are no pending migrations', async () => {
      // Given
      const { config, plugin } = getMockedConfig([[doneMigration, 'done']]);

      // When
      await upCommand(config);

      // Then
      assertCommandDone(plugin, []);
    });

    it("calls done with all finished migrations when it's a dry-run", async () => {
      // Given
      const { config, plugin } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await upCommand({ ...config, dry: true });

      // Then
      assertCommandDone(plugin, [
        [pendingMigration1.name, 'done'],
        [pendingMigration2.name, 'done'],
      ]);
    });

    it('calls done with the finished migrations when noExecution is true', async () => {
      // Given
      const { config, plugin } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      // When
      await upCommand({ ...config, noExecution: true });

      // Then
      assertCommandDone(plugin, [[pendingMigration1.name, 'done']]);
    });

    it('calls done with an error when a migration fails', async () => {
      // Given
      pendingMigration1.mock.mockImplementationOnce(async function pendingMigration1() {
        throw migrationError;
      });
      const { config, plugin } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assertCommandFailed(plugin, MigrationRunError.create({ identifier: pendingMigration1.name }, migrationError));
    });

    it("calls done with an error when there's a failed migration in the history", async () => {
      // Given
      const { config, plugin } = getMockedConfig([
        [doneMigration, 'done'],
        [failedMigration, 'failed', migrationError],
        [pendingMigration1, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assertCommandFailed(
        plugin,
        MigrationHistoryError.create({
          identifier: failedMigration.name,
          state: { status: 'failed', error: migrationError },
        }),
      );
    });

    it('calls done with an error when aborted', async () => {
      // Given
      const abortController = new AbortController();
      const abortError = CommandAbortError.fromReason('Aborted during migration');
      pendingMigration1.mock.mockImplementationOnce(async function pendingMigration1() {
        abortController.abort(abortError);
      });
      const { config, plugin } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      // When
      await upCommand({ ...config, abortSignal: abortController.signal });

      // Then
      assertCommandFailed(plugin, abortError);
    });

    it("calls done when pending migrations couldn't be locked but successfully waited for", async () => {
      // Given
      const { config, storage, plugin } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      storage.lock.mock.mockImplementationOnce(async () => []);

      // When
      await upCommand(config);

      // Then
      assertCommandDone(plugin, [[pendingMigration1.name, 'done']]);
    });

    it('calls done with successful migrations before a failure', async () => {
      // Given
      pendingMigration2.mock.mockImplementationOnce(async function pendingMigration2() {
        throw migrationError;
      });
      const { config, plugin } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // When
      await upCommand(config);

      // Then
      assertCommandDone(plugin, [
        [pendingMigration1.name, 'done'],
        [pendingMigration2.name, 'failed', migrationError],
        [pendingMigration3.name, 'skip'],
      ]);
    });

    it('calls done with an error when waiting for migrations fails', async () => {
      // Given
      const waitError = new Error('Failed to wait for migration');
      const { config, storage, plugin } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      storage.lock.mock.mockImplementationOnce(async () => []);
      storage.wait.mock.mockImplementationOnce(async () => {
        throw waitError;
      });

      // When
      await upCommand(config);

      // Then
      assertCommandFailed(plugin, MigrationWaitError.create({ identifier: pendingMigration1.name }, waitError));
    });

    it('calls done with empty array when there are no migrations', async () => {
      // Given
      const { config, plugin } = getMockedConfig([]);

      // When
      await upCommand(config);

      // Then
      assertCommandDone(plugin, []);
    });

    it('calls done with migrations within specified boundaries as done and the others skipped', async () => {
      // Given
      const { config, plugin } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // When
      await upCommand({ ...config, from: pendingMigration2.name, to: pendingMigration2.name });

      // Then
      assertCommandDone(plugin, [
        [pendingMigration1.name, 'skip'],
        [pendingMigration2.name, 'done'],
        [pendingMigration3.name, 'skip'],
      ]);
    });

    it('calls done with only as many migrations as specified by limit', async () => {
      // Given
      const { config, plugin } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // When
      await upCommand({ ...config, limit: 2 });

      // Then
      assertCommandDone(plugin, [
        [pendingMigration1.name, 'done'],
        [pendingMigration2.name, 'done'],
        [pendingMigration3.name, 'skip'],
      ]);
    });
  });

  // To maintain compatibility with other migration tools' history tables
  // we need to ensure that migrations that has been logged as done without
  // file extension are still recognized as done.
  describe('legacy logged migrations support', () => {
    it('recognizes migrations logged without file extension as done', async () => {
      // Given
      // Use an object to define migrations to preserve their names with extensions
      const migrations = {
        async 'newMigration.js'() {},
        async 'anotherMigration.ts'() {},
        async 'yetAnother.sql'() {},
      };
      const newMigration = mock.fn(migrations['newMigration.js']);
      const anotherMigration = mock.fn(migrations['anotherMigration.ts']);
      const yetAnotherMigration = mock.fn(migrations['yetAnother.sql']);

      const { config, storage, plugin } = getMockedConfig(
        [
          [newMigration, 'pending'],
          [anotherMigration, 'pending'],
          [yetAnotherMigration, 'pending'],
        ],
        {
          // Fake a history with migrations logged without file extensions
          history: [['newMigration'], ['anotherMigration']],
        },
      );

      // When
      await upCommand(config);

      // Then
      assert.strictEqual(newMigration.mock.callCount(), 0);
      assert.strictEqual(anotherMigration.mock.callCount(), 0);
      assert.strictEqual(yetAnotherMigration.mock.callCount(), 1);
      assertStorageLogged(storage, [[yetAnotherMigration.name]]);
      assertCommandDone(plugin, [[yetAnotherMigration.name, 'done']]);
    });
  });
});

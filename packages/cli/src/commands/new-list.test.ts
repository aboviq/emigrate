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
import { CommandAbortError } from '../errors.js';
import { listCommand } from './new-list.js';

describe('new list command', () => {
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
   * LISTING MIGRATIONS
   */
  describe('listing migrations', () => {
    it('does not execute any migrations', async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await listCommand(config);

      // Then
      assert.strictEqual(doneMigration.mock.callCount(), 0);
      assert.strictEqual(pendingMigration1.mock.callCount(), 0);
      assert.strictEqual(pendingMigration2.mock.callCount(), 0);
    });

    it('lists all migrations regardless of state', async () => {
      // Given
      const { config, plugin } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [failedMigration, 'failed', migrationError],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await listCommand(config);

      // Then
      assertCommandDone(plugin, [
        [doneMigration.name, 'done'],
        [pendingMigration1.name, 'pending'],
        [failedMigration.name, 'failed', migrationError],
        [pendingMigration2.name, 'pending'],
      ]);
    });

    it('lists migrations in the registered order', async () => {
      // Given
      const finishOrder: string[] = [];
      const { config, plugin } = getMockedConfig([
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
        [pendingMigration3, 'pending'],
      ]);

      // Capture the order by inspecting the plugin callback
      plugin.hooks['emigrate:migration:done'].mock.mockImplementation((parameters) => {
        finishOrder.push(parameters.migration.identifier);
      });

      // When
      await listCommand(config);

      // Then
      assert.deepStrictEqual(finishOrder, [pendingMigration1.name, pendingMigration2.name, pendingMigration3.name]);
    });
  });

  /**
   * NO LOCKING SHOULD OCCUR
   */
  describe('no locking', () => {
    it('does not lock any migrations', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await listCommand(config);

      // Then
      assertStorageLocked(storage, []);
    });

    it('does not unlock any migrations', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await listCommand(config);

      // Then
      assertStorageUnlocked(storage, []);
    });
  });

  /**
   * NO LOGGING SHOULD OCCUR
   */
  describe('no logging', () => {
    it('does not log any migrations', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await listCommand(config);

      // Then
      assertStorageLogged(storage, []);
    });

    it('does not log failed migrations', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [failedMigration, 'failed', migrationError],
        [pendingMigration1, 'pending'],
      ]);

      // When
      await listCommand(config);

      // Then
      assertStorageLogged(storage, []);
    });
  });

  /**
   * NO WAITING SHOULD OCCUR
   */
  describe('no waiting', () => {
    it('does not wait for any migrations', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await listCommand(config);

      // Then
      assertStorageWaited(storage, []);
    });
  });

  /**
   * COMMAND RESULT
   */
  describe('command result', () => {
    it('returns true when there are migrations', async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      const result = await listCommand(config);

      // Then
      assert.strictEqual(result, true);
    });

    it('returns true when there are no migrations', async () => {
      // Given
      const { config } = getMockedConfig([]);

      // When
      const result = await listCommand(config);

      // Then
      assert.strictEqual(result, true);
    });

    it('returns false when there is a failed migration in history', async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [failedMigration, 'failed', migrationError],
        [pendingMigration1, 'pending'],
      ]);

      // When
      const result = await listCommand(config);

      // Then
      // The finish method propagates the failed migration's error, causing the command to fail
      assert.strictEqual(result, false);
    });

    it('returns false when aborted before listing', async () => {
      // Given
      const abortController = new AbortController();
      const abortError = CommandAbortError.fromReason('Aborted before listing');
      abortController.abort(abortError);
      const { config } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      // When
      const result = await listCommand({ ...config, abortSignal: abortController.signal });

      // Then
      assert.strictEqual(result, false);
    });
  });

  /**
   * PLUGIN CALLBACKS
   */
  describe('plugin callbacks', () => {
    it('calls done with all migrations when listing completes', async () => {
      // Given
      const { config, plugin } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
        [pendingMigration2, 'pending'],
      ]);

      // When
      await listCommand(config);

      // Then
      assertCommandDone(plugin, [
        [doneMigration.name, 'done'],
        [pendingMigration1.name, 'pending'],
        [pendingMigration2.name, 'pending'],
      ]);
    });

    it('calls done with an empty array when there are no migrations', async () => {
      // Given
      const { config, plugin } = getMockedConfig([]);

      // When
      await listCommand(config);

      // Then
      assertCommandDone(plugin, []);
    });

    it('calls done with all migrations including failed ones', async () => {
      // Given
      const { config, plugin } = getMockedConfig([
        [doneMigration, 'done'],
        [failedMigration, 'failed', migrationError],
        [pendingMigration1, 'pending'],
      ]);

      // When
      await listCommand(config);

      // Then
      assertCommandDone(plugin, [
        [doneMigration.name, 'done'],
        [failedMigration.name, 'failed', migrationError],
        [pendingMigration1.name, 'pending'],
      ]);
    });

    it('calls done with an error when aborted', async () => {
      // Given
      const abortController = new AbortController();
      const abortError = CommandAbortError.fromReason('Aborted during listing');
      abortController.abort(abortError);
      const { config, plugin } = getMockedConfig([
        [doneMigration, 'done'],
        [pendingMigration1, 'pending'],
      ]);

      // When
      await listCommand({ ...config, abortSignal: abortController.signal });

      // Then
      assertCommandFailed(plugin, abortError);
    });

    it('calls done with an error when there is a failed migration', async () => {
      // Given
      const { config, plugin } = getMockedConfig([
        [doneMigration, 'done'],
        [failedMigration, 'failed', migrationError],
        [pendingMigration1, 'pending'],
      ]);

      // When
      await listCommand(config);

      // Then
      // The finish method propagates the failed migration's error
      assertCommandFailed(plugin, migrationError);
    });
  });
});

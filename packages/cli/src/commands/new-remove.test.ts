import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { getMockedConfig } from '../tests/config.js';
import { assertStorageRemoved } from '../tests/storage.js';
import { assertCommandDone, assertCommandFailed } from '../tests/plugin.js';
import { CommandAbortError, MigrationNotRunError, OptionNeededError } from '../errors.js';
import { removeCommand } from './new-remove.js';
import type { RunnableMigration } from '../types/migrations.js';

describe('new remove command', () => {
  const doneMigration1 = mock.fn(async function doneMigration1() {});
  const doneMigration2 = mock.fn(async function doneMigration2() {});
  const doneMigration3 = mock.fn(async function doneMigration3() {});
  const pendingMigration = mock.fn(async function pendingMigration() {});
  const migrationError = new Error('Migration failed');
  const failedMigration = mock.fn(async function failedMigration() {});

  beforeEach(() => {
    doneMigration1.mock.resetCalls();
    doneMigration2.mock.resetCalls();
    doneMigration3.mock.resetCalls();
    pendingMigration.mock.resetCalls();
    failedMigration.mock.resetCalls();
  });

  /**
   * REMOVING MIGRATIONS
   */
  describe('removing migrations', () => {
    it('removes a failed migration from history', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration1, 'done'],
        [failedMigration, 'failed', migrationError],
      ]);

      // When
      await removeCommand({ ...config, name: failedMigration.name });

      // Then
      assertStorageRemoved(storage, [failedMigration.name]);
    });

    it('removes a done migration from history when force is true', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration1, 'done'],
        [doneMigration2, 'done'],
      ]);

      // When
      await removeCommand({ ...config, name: doneMigration2.name, force: true });

      // Then
      assertStorageRemoved(storage, [doneMigration2.name]);
    });

    it('does not remove a done migration from history when force is false', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration1, 'done'],
        [doneMigration2, 'done'],
      ]);

      // When
      await removeCommand({ ...config, name: doneMigration2.name });

      // Then
      assertStorageRemoved(storage, []);
    });

    it('does not remove a pending migration', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration1, 'done'],
        [pendingMigration, 'pending'],
      ]);

      // When
      await removeCommand({ ...config, name: pendingMigration.name });

      // Then
      assertStorageRemoved(storage, []);
    });

    it('only removes the specified migration', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration1, 'done'],
        [failedMigration, 'failed', migrationError],
        [doneMigration2, 'done'],
      ]);

      // When
      await removeCommand({ ...config, name: failedMigration.name });

      // Then
      assertStorageRemoved(storage, [failedMigration.name]);
    });

    it('does not remove any migration when the specified migration is not found', async () => {
      // Given
      const { config, storage } = getMockedConfig([
        [doneMigration1, 'done'],
        [doneMigration2, 'done'],
      ]);

      // When
      await removeCommand({ ...config, name: 'nonexistentMigration' });

      // Then
      assertStorageRemoved(storage, []);
    });

    it('does not remove any subsequent migrations after an abort', async () => {
      // Given
      const abortController = new AbortController();
      const abortError = CommandAbortError.fromReason('Aborted during removal');
      const { config, storage } = getMockedConfig([
        [failedMigration, 'failed', migrationError],
        [doneMigration1, 'done'],
      ]);

      storage.remove.mock.mockImplementationOnce(async () => {
        abortController.abort(abortError);
      });

      // When
      await removeCommand({ ...config, name: failedMigration.name, abortSignal: abortController.signal });

      // Then
      assertStorageRemoved(storage, [failedMigration.name]);
    });
  });

  /**
   * COMMAND RESULT
   */
  describe('command result', () => {
    it('returns true when the migration is successfully removed', async () => {
      // Given
      const { config } = getMockedConfig([[failedMigration, 'failed', migrationError]]);

      // When
      const result = await removeCommand({ ...config, name: failedMigration.name });

      // Then
      assert.strictEqual(result, true);
    });

    it('returns true when a done migration is removed with force', async () => {
      // Given
      const { config } = getMockedConfig([[doneMigration1, 'done']]);

      // When
      const result = await removeCommand({ ...config, name: doneMigration1.name, force: true });

      // Then
      assert.strictEqual(result, true);
    });

    it('returns false when trying to remove a done migration without force', async () => {
      // Given
      const { config } = getMockedConfig([[doneMigration1, 'done']]);

      // When
      const result = await removeCommand({ ...config, name: doneMigration1.name });

      // Then
      assert.strictEqual(result, false);
    });

    it('returns false when trying to remove a pending migration', async () => {
      // Given
      const { config } = getMockedConfig([[pendingMigration, 'pending']]);

      // When
      const result = await removeCommand({ ...config, name: pendingMigration.name });

      // Then
      assert.strictEqual(result, false);
    });

    it('returns true when the specified migration is not found (no migrations to remove)', async () => {
      // Given
      const { config } = getMockedConfig([
        [doneMigration1, 'done'],
        [doneMigration2, 'done'],
      ]);

      // When
      const result = await removeCommand({ ...config, name: 'nonexistentMigration' });

      // Then
      assert.strictEqual(result, true);
    });

    it('returns false when removal fails', async () => {
      // Given
      const { config, storage } = getMockedConfig([[failedMigration, 'failed', migrationError]]);

      storage.remove.mock.mockImplementationOnce(async () => {
        throw new Error('Storage removal error');
      });

      // When
      const result = await removeCommand({ ...config, name: failedMigration.name });

      // Then
      assert.strictEqual(result, false);
    });

    it('returns false when aborted', async () => {
      // Given
      const abortController = new AbortController();
      const abortError = CommandAbortError.fromReason('Aborted during removal');
      const { config, storage } = getMockedConfig([[failedMigration, 'failed', migrationError]]);

      storage.remove.mock.mockImplementationOnce(async () => {
        abortController.abort(abortError);
      });

      // When
      const result = await removeCommand({
        ...config,
        name: failedMigration.name,
        abortSignal: abortController.signal,
      });

      // Then
      assert.strictEqual(result, false);
    });

    it('returns true when there are no migrations at all', async () => {
      // Given
      const { config } = getMockedConfig([]);

      // When
      const result = await removeCommand({ ...config, name: 'anyMigration' });

      // Then
      assert.strictEqual(result, true);
    });
  });

  /**
   * PLUGIN CALLBACKS
   */
  describe('plugin callbacks', () => {
    it('calls done with the removed migration when removal succeeds', async () => {
      // Given
      const { config, plugin } = getMockedConfig([[failedMigration, 'failed', migrationError]]);

      // When
      await removeCommand({ ...config, name: failedMigration.name });

      // Then
      assertCommandDone(plugin, [[failedMigration.name, 'removed']]);
    });

    it('calls done with all migrations skipped except the removed one', async () => {
      // Given
      const { config, plugin } = getMockedConfig([
        [doneMigration1, 'done'],
        [failedMigration, 'failed', migrationError],
        [doneMigration2, 'done'],
      ]);

      // When
      await removeCommand({ ...config, name: failedMigration.name });

      // Then
      // Note: Migrations that are already done/failed in history retain their state when skipped
      assertCommandDone(plugin, [
        [doneMigration1.name, 'done'],
        [failedMigration.name, 'removed'],
        [doneMigration2.name, 'done'],
      ]);
    });

    it('calls done with an error when trying to remove a done migration without force', async () => {
      // Given
      const { config, plugin } = getMockedConfig([[doneMigration1, 'done']]);

      // When
      await removeCommand({ ...config, name: doneMigration1.name });

      // Then
      assertCommandFailed(
        plugin,
        OptionNeededError.fromOption(
          'force',
          `The migration "${doneMigration1.name}" is not in a failed state. Use the "force" option to force its removal`,
        ),
      );
    });

    it('calls done with an error when trying to remove a pending migration', async () => {
      // Given
      const { config, plugin } = getMockedConfig([[pendingMigration, 'pending']]);

      // When
      await removeCommand({ ...config, name: pendingMigration.name });

      // Then
      assertCommandFailed(
        plugin,
        MigrationNotRunError.create({ identifier: pendingMigration.name } as RunnableMigration),
      );
    });

    it('calls done with an error when aborted', async () => {
      // Given
      const abortController = new AbortController();
      const abortError = CommandAbortError.fromReason('Aborted during removal');
      const { config, storage, plugin } = getMockedConfig([[failedMigration, 'failed', migrationError]]);

      storage.remove.mock.mockImplementationOnce(async () => {
        abortController.abort(abortError);
      });

      // When
      await removeCommand({ ...config, name: failedMigration.name, abortSignal: abortController.signal });

      // Then
      assertCommandFailed(plugin, abortError);
    });

    it('calls done with empty array when there are no migrations', async () => {
      // Given
      const { config, plugin } = getMockedConfig([]);

      // When
      await removeCommand({ ...config, name: 'anyMigration' });

      // Then
      assertCommandDone(plugin, []);
    });

    it('calls done with all migrations with their original state when the specified migration is not found', async () => {
      // Given
      const { config, plugin } = getMockedConfig([
        [doneMigration1, 'done'],
        [doneMigration2, 'done'],
      ]);

      // When
      await removeCommand({ ...config, name: 'nonexistentMigration' });

      // Then
      // Note: Migrations that are already done in history retain their state when skipped
      assertCommandDone(plugin, [
        [doneMigration1.name, 'done'],
        [doneMigration2.name, 'done'],
      ]);
    });

    it('calls done with force removal of done migration', async () => {
      // Given
      const { config, plugin } = getMockedConfig([
        [doneMigration1, 'done'],
        [doneMigration2, 'done'],
      ]);

      // When
      await removeCommand({ ...config, name: doneMigration1.name, force: true });

      // Then
      assertCommandDone(plugin, [
        [doneMigration1.name, 'removed'],
        [doneMigration2.name, 'done'],
      ]);
    });
  });
});

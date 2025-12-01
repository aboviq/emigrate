import { mock } from 'node:test';
import assert from 'node:assert';
import type { EmigrateStorage } from '../types/storage.js';
import type { Mocked } from './utils.js';

type MockedEntry = [string] | [string, Error];

export type MockedStorage = Mocked<Required<EmigrateStorage>>;

export const getMockedStorage = (historyEntries: MockedEntry[]): MockedStorage => {
  return {
    name: 'mocked-storage',
    init: mock.fn(async () => {
      // void
    }),
    lock: mock.fn(async (migrations) => [...migrations]),
    unlock: mock.fn(async () => {
      // void
    }),
    getHistory: mock.fn(async function* () {
      for (const entry of historyEntries) {
        yield entry.length === 1
          ? { identifier: entry[0], state: { status: 'done' } }
          : { identifier: entry[0], state: { status: 'failed', error: entry[1] } };
      }
    }),
    remove: mock.fn(),
    log: mock.fn(),
    wait: mock.fn(async () => {
      // void
    }),
    end: mock.fn(async () => {
      // void
    }),
  };
};

export const assertStorageLogged = (storage: MockedStorage, entries: MockedEntry[]): void => {
  assert.strictEqual(storage.log.mock.callCount(), entries.length, 'Unexpected number of log calls');

  for (const [index, entry] of entries.entries()) {
    const call = storage.log.mock.calls[index];
    const loggedIdentifier = call?.arguments[0].identifier;
    const loggedError = call?.arguments[1];

    assert.strictEqual(loggedIdentifier, entry[0], `Logged identifier does not match for entry ${index}`);

    if (entry.length === 2) {
      assert.ok(loggedError, `Expected an error to be logged for entry ${index}`);
      assert.strictEqual(
        loggedError?.['message'],
        entry[1].message,
        `Logged error message does not match for entry ${index}`,
      );
    } else {
      assert.strictEqual(loggedError, undefined, `Expected no error to be logged for entry ${index}`);
    }
  }
};

export const assertStorageWaited = (storage: MockedStorage, entries: string[]): void => {
  assert.strictEqual(storage.wait.mock.callCount(), entries.length, 'Unexpected number of wait calls');

  for (const [index, identifier] of entries.entries()) {
    const call = storage.wait.mock.calls[index];
    const waitedIdentifier = call?.arguments[0].identifier;

    assert.strictEqual(waitedIdentifier, identifier, `Waited identifier does not match for entry ${index}`);
  }
};

export const assertStorageLocked = (storage: MockedStorage, entries: string[]): void => {
  assert.strictEqual(storage.lock.mock.callCount(), entries.length > 0 ? 1 : 0, 'Unexpected number of lock calls');

  if (entries.length === 0) {
    return;
  }

  const call = storage.lock.mock.calls[0];
  const lockedMigrations: string[] = call?.arguments[0].map((m) => m.identifier) ?? [];

  assert.deepStrictEqual(lockedMigrations, entries, 'Locked migrations do not match');
};

export const assertStorageUnlocked = (storage: MockedStorage, entries: string[]): void => {
  assert.strictEqual(storage.unlock.mock.callCount(), entries.length > 0 ? 1 : 0, 'Unexpected number of unlock calls');

  if (entries.length === 0) {
    return;
  }

  const call = storage.unlock.mock.calls[0];
  const unlockedMigrations: string[] = call?.arguments[0].map((m) => m.identifier) ?? [];

  assert.deepStrictEqual(unlockedMigrations, entries, 'Unlocked migrations do not match');
};

export const assertStorageRemoved = (storage: MockedStorage, entries: string[]): void => {
  assert.strictEqual(storage.remove.mock.callCount(), entries.length, 'Unexpected number of remove calls');

  for (const [index, identifier] of entries.entries()) {
    const call = storage.remove.mock.calls[index];
    const removedIdentifier = call?.arguments[0].identifier;

    assert.strictEqual(removedIdentifier, identifier, `Removed identifier does not match for entry ${index}`);
  }
};

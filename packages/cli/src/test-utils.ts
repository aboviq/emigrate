import { mock, type Mock } from 'node:test';
import path from 'node:path';
import assert from 'node:assert';
import {
  type SerializedError,
  type EmigrateReporter,
  type FailedMigrationHistoryEntry,
  type MigrationHistoryEntry,
  type MigrationMetadata,
  type NonFailedMigrationHistoryEntry,
  type Storage,
} from '@emigrate/types';
import { toSerializedError } from './errors.js';

export type Mocked<T> = {
  // @ts-expect-error - This is a mock
  [K in keyof T]: Mock<T[K]>;
};

export async function noop(): Promise<void> {
  // noop
}

export function getErrorCause(error: Error | undefined): Error | SerializedError | undefined {
  if (error?.cause instanceof Error) {
    return error.cause;
  }

  if (typeof error?.cause === 'object' && error.cause !== null) {
    return error.cause as unknown as SerializedError;
  }

  return undefined;
}

export function getMockedStorage(historyEntries: Array<string | MigrationHistoryEntry>): Mocked<Storage> {
  return {
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
}

export function getMockedReporter(): Mocked<Required<EmigrateReporter>> {
  return {
    onFinished: mock.fn(noop),
    onInit: mock.fn(noop),
    onAbort: mock.fn(noop),
    onCollectedMigrations: mock.fn(noop),
    onLockedMigrations: mock.fn(noop),
    onNewMigration: mock.fn(noop),
    onMigrationStart: mock.fn(noop),
    onMigrationSuccess: mock.fn(noop),
    onMigrationError: mock.fn(noop),
    onMigrationSkip: mock.fn(noop),
  };
}

export function toMigration(cwd: string, directory: string, name: string): MigrationMetadata {
  return {
    name,
    filePath: `${cwd}/${directory}/${name}`,
    relativeFilePath: `${directory}/${name}`,
    extension: path.extname(name),
    directory,
    cwd,
  };
}

export function toMigrations(cwd: string, directory: string, names: string[]): MigrationMetadata[] {
  return names.map((name) => toMigration(cwd, directory, name));
}

export function toEntry(name: MigrationHistoryEntry): MigrationHistoryEntry;
export function toEntry<S extends MigrationHistoryEntry['status']>(
  name: string,
  status?: S,
): S extends 'failed' ? FailedMigrationHistoryEntry : NonFailedMigrationHistoryEntry;

export function toEntry(name: string | MigrationHistoryEntry, status?: 'done' | 'failed'): MigrationHistoryEntry {
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

export function toEntries(
  names: Array<string | MigrationHistoryEntry>,
  status?: MigrationHistoryEntry['status'],
): MigrationHistoryEntry[] {
  return names.map((name) => (typeof name === 'string' ? toEntry(name, status) : name));
}

export function assertErrorEqualEnough(actual?: Error | SerializedError, expected?: Error, message?: string): void {
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
  assert.deepStrictEqual(actualError, expectedError, message);
  assert.deepStrictEqual(actualCauseRest, expectedCauseRest, message ? `${message} (cause)` : undefined);
}

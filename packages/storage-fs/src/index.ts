import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { type EmigrateStorage, type MigrationStatus } from '@emigrate/plugin-tools/types';

export type StorageFsOptions = {
  filename: string;
};

type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
};

const serializeError = (error: Error): SerializedError => {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause instanceof Error ? serializeError(error.cause) : error.cause,
  };
};

export default function storageFs({ filename }: StorageFsOptions): EmigrateStorage {
  const filePath = path.resolve(process.cwd(), filename);
  const lockFilePath = `${filePath}.lock`;

  const read = async (): Promise<
    Record<string, { status: MigrationStatus; date: string; error?: SerializedError }>
  > => {
    try {
      const contents = await fs.readFile(filePath, 'utf8');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return JSON.parse(contents);
    } catch {
      return {};
    }
  };

  let lastUpdate: Promise<void> = Promise.resolve();

  const update = async (migration: string, status: MigrationStatus, error?: Error) => {
    lastUpdate = lastUpdate.then(async () => {
      const history = await read();

      const newHistory = {
        ...history,
        [migration]: {
          status,
          date: new Date().toISOString(),
          error: error ? serializeError(error) : undefined,
        },
      };

      await fs.writeFile(filePath, JSON.stringify(newHistory, undefined, 2));
    });

    return lastUpdate;
  };

  return {
    async initializeStorage() {
      return {
        async lock(migrations) {
          try {
            const fd = await fs.open(lockFilePath, 'wx');

            await fd.close();

            return migrations;
          } catch {
            throw new Error('Could not acquire file lock for migrations');
          }
        },
        async unlock() {
          try {
            await fs.unlink(lockFilePath);
          } catch {
            // Ignore
          }
        },
        async *getHistory() {
          const history = await read();

          yield* Object.entries(history).map(([name, { status, date, error }]) => ({
            name,
            status,
            error,
            date: new Date(date),
          }));
        },
        async onSuccess(migration) {
          await update(migration.name, 'done');
        },
        async onError(migration, error) {
          await update(migration.name, 'failed', error);
        },
      };
    },
  };
}

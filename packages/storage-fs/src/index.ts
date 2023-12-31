import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { type SerializedError, type EmigrateStorage, type MigrationStatus } from '@emigrate/types';

export type StorageFsOptions = {
  filename: string;
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

  const update = async (migration: string, status: MigrationStatus, error?: SerializedError) => {
    lastUpdate = lastUpdate.then(async () => {
      const history = await read();

      const newHistory = {
        ...history,
        [migration]: {
          status,
          date: new Date().toISOString(),
          error,
        },
      };

      try {
        await fs.writeFile(filePath, JSON.stringify(newHistory, undefined, 2));
      } catch (error) {
        throw new Error(`Failed to write migration history to file: ${filePath}`, { cause: error });
      }
    });

    return lastUpdate;
  };

  const acquireLock = async () => {
    try {
      const fd = await fs.open(lockFilePath, 'wx');

      await fd.close();
    } catch (error) {
      throw new Error('Could not acquire file lock for migrations', { cause: error });
    }
  };

  const releaseLock = async () => {
    try {
      await fs.unlink(lockFilePath);
    } catch {
      // Ignore
    }
  };

  return {
    async initializeStorage() {
      return {
        async lock(migrations) {
          await acquireLock();

          return migrations;
        },
        async unlock() {
          await releaseLock();
        },
        async remove(migration) {
          await acquireLock();

          try {
            const history = await read();

            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete history[migration.name];

            await fs.writeFile(filePath, JSON.stringify(history, undefined, 2));
          } catch (error) {
            throw new Error(`Failed to remove migration from history: ${migration.name}`, { cause: error });
          } finally {
            await releaseLock();
          }
        },
        async *getHistory() {
          const history = await read();

          for (const [name, { status, date, error }] of Object.entries(history)) {
            if (status === 'failed') {
              yield {
                name,
                status,
                date: new Date(date),
                error: error ?? { name: 'Error', message: 'Unknown error' },
              };
              continue;
            }

            yield {
              name,
              status,
              date: new Date(date),
            };
          }
        },
        async onSuccess(migration) {
          await update(migration.name, 'done');
        },
        async onError(migration, error) {
          await update(migration.name, 'failed', error);
        },
        async end() {
          // Nothing to do
        },
      };
    },
  };
}

import { exec, type ExecOptions } from '../utils/exec.js';
import { getPluginLogger } from '../logger/index.js';
import type { FailsafeStorage } from '../types/internal.js';
import type { EmigrateStorage } from '../types/storage.js';

export const createFailsafeStorage = (storage: EmigrateStorage, options: ExecOptions): FailsafeStorage => {
  const logger = getPluginLogger(storage);

  return {
    name: storage.name,
    getHistory: storage.getHistory.bind(storage),
    async init() {
      const result = await exec(async () => storage.init?.(), options);

      if (result[1]) {
        logger.fatal(`Failed to initialize storage "${storage.name}"`, { error: result[1] });
      }

      return result;
    },
    async lock(migrations) {
      const result = await exec(async () => storage.lock(migrations), options);

      if (result[1]) {
        logger.fatal(`Failed to lock migrations in storage "${storage.name}"`, { error: result[1] });
      }

      return result;
    },
    async unlock(migrations) {
      const result = await exec(async () => storage.unlock(migrations), options);

      if (result[1]) {
        logger.fatal(`Failed to unlock migrations in storage "${storage.name}"`, { error: result[1] });
      }

      return result;
    },
    async log(migration, error) {
      const result = await exec(async () => storage.log(migration, error), options);

      if (result[1]) {
        logger.fatal(
          `Failed to log migration "${migration.identifier}" as ${error ? 'failed' : 'successful'} in storage "${
            storage.name
          }"`,
          {
            error: result[1],
          },
        );
      }

      return result;
    },
    async remove(migration) {
      const result = await exec(async () => storage.remove(migration), options);

      if (result[1]) {
        logger.fatal(`Failed to remove migration "${migration.identifier}" from storage "${storage.name}"`, {
          error: result[1],
        });
      }

      return result;
    },
    async wait(migration) {
      return exec(async () => storage.wait?.(migration), options);
    },
    async end() {
      const result = await exec(async () => storage.end?.(), options);

      if (result[1]) {
        logger.fatal(`Failed to end storage "${storage.name}"`, { error: result[1] });
      }

      return result;
    },
  };
};

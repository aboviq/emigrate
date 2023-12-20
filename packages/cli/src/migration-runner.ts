import { hrtime } from 'node:process';
import {
  isFinishedMigration,
  isFailedMigration,
  type EmigrateReporter,
  type MigrationMetadata,
  type MigrationMetadataFinished,
  type Storage,
  type FailedMigrationMetadata,
  type SuccessfulMigrationMetadata,
} from '@emigrate/types';
import { toError, EmigrateError, MigrationRunError, toSerializedError } from './errors.js';
import { exec } from './exec.js';
import { getDuration } from './get-duration.js';

type MigrationRunnerParameters = {
  dry: boolean;
  reporter: EmigrateReporter;
  storage: Storage;
  migrations: Array<MigrationMetadata | MigrationMetadataFinished>;
  validate: (migration: MigrationMetadata) => Promise<void>;
  execute: (migration: MigrationMetadata) => Promise<void>;
};

export const migrationRunner = async ({
  dry,
  reporter,
  storage,
  migrations,
  validate,
  execute,
}: MigrationRunnerParameters): Promise<Error | undefined> => {
  await reporter.onCollectedMigrations?.(migrations);

  const finishedMigrations: MigrationMetadataFinished[] = [];
  const migrationsToRun: MigrationMetadata[] = [];

  let skip = false;

  for await (const migration of migrations) {
    if (isFinishedMigration(migration)) {
      skip ||= migration.status === 'failed' || migration.status === 'skipped';

      finishedMigrations.push(migration);
    } else if (skip) {
      finishedMigrations.push({
        ...migration,
        status: dry ? 'pending' : 'skipped',
      });
    } else {
      try {
        await validate(migration);
        migrationsToRun.push(migration);
      } catch (error) {
        for await (const migration of migrationsToRun) {
          finishedMigrations.push({ ...migration, status: 'skipped' });
        }

        migrationsToRun.length = 0;

        finishedMigrations.push({
          ...migration,
          status: 'failed',
          duration: 0,
          error: toError(error),
        });

        skip = true;
      }
    }
  }

  const [lockedMigrations, lockError] = dry ? [migrationsToRun] : await exec(async () => storage.lock(migrationsToRun));

  if (lockError) {
    for await (const migration of migrationsToRun) {
      finishedMigrations.push({ ...migration, status: 'skipped' });
    }

    migrationsToRun.length = 0;

    skip = true;
  } else {
    await reporter.onLockedMigrations?.(lockedMigrations);
  }

  for await (const finishedMigration of finishedMigrations) {
    switch (finishedMigration.status) {
      case 'failed': {
        await reporter.onMigrationError?.(finishedMigration, finishedMigration.error);
        break;
      }

      case 'pending': {
        await reporter.onMigrationSkip?.(finishedMigration);
        break;
      }

      case 'skipped': {
        await reporter.onMigrationSkip?.(finishedMigration);
        break;
      }

      default: {
        await reporter.onMigrationSuccess?.(finishedMigration);
        break;
      }
    }
  }

  for await (const migration of lockedMigrations ?? []) {
    if (dry || skip) {
      const finishedMigration: MigrationMetadataFinished = {
        ...migration,
        status: dry ? 'pending' : 'skipped',
      };

      await reporter.onMigrationSkip?.(finishedMigration);

      finishedMigrations.push(finishedMigration);
      continue;
    }

    await reporter.onMigrationStart?.(migration);

    const start = hrtime();

    const [, migrationError] = await exec(async () => execute(migration));

    const duration = getDuration(start);

    if (migrationError) {
      const finishedMigration: FailedMigrationMetadata = {
        ...migration,
        status: 'failed',
        duration,
        error: migrationError,
      };
      await storage.onError(finishedMigration, toSerializedError(migrationError));
      await reporter.onMigrationError?.(finishedMigration, migrationError);
      finishedMigrations.push(finishedMigration);
      skip = true;
    } else {
      const finishedMigration: SuccessfulMigrationMetadata = {
        ...migration,
        status: 'done',
        duration,
      };
      await storage.onSuccess(finishedMigration);
      await reporter.onMigrationSuccess?.(finishedMigration);
      finishedMigrations.push(finishedMigration);
    }
  }

  const [, unlockError] = dry ? [] : await exec(async () => storage.unlock(lockedMigrations ?? []));

  // eslint-disable-next-line unicorn/no-array-callback-reference
  const firstFailed = finishedMigrations.find(isFailedMigration);
  const firstError =
    firstFailed?.error instanceof EmigrateError
      ? firstFailed.error
      : firstFailed
        ? MigrationRunError.fromMetadata(firstFailed)
        : undefined;
  const error = unlockError ?? firstError ?? lockError;

  await reporter.onFinished?.(finishedMigrations, error);

  return error;
};

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
import { toError, EmigrateError, MigrationRunError, toSerializedError, BadOptionError } from './errors.js';
import { exec } from './exec.js';
import { getDuration } from './get-duration.js';

type MigrationRunnerParameters = {
  dry: boolean;
  limit?: number;
  from?: string;
  to?: string;
  abortSignal?: AbortSignal;
  abortRespite?: number;
  reporter: EmigrateReporter;
  storage: Storage;
  migrations: AsyncIterable<MigrationMetadata | MigrationMetadataFinished>;
  migrationFilter?: (migration: MigrationMetadata | MigrationMetadataFinished) => boolean;
  validate: (migration: MigrationMetadata) => Promise<void>;
  execute: (migration: MigrationMetadata) => Promise<void>;
};

export const migrationRunner = async ({
  dry,
  limit,
  from,
  to,
  abortSignal,
  abortRespite,
  reporter,
  storage,
  migrations,
  validate,
  execute,
  migrationFilter = () => true,
}: MigrationRunnerParameters): Promise<Error | undefined> => {
  const collectedMigrations: Array<MigrationMetadata | MigrationMetadataFinished> = [];
  const validatedMigrations: Array<MigrationMetadata | MigrationMetadataFinished> = [];
  const migrationsToLock: MigrationMetadata[] = [];

  let skip = false;

  abortSignal?.addEventListener(
    'abort',
    () => {
      skip = true;
      reporter.onAbort?.(toError(abortSignal.reason))?.then(
        () => {
          /* noop */
        },
        () => {
          /* noop */
        },
      );
    },
    { once: true },
  );

  let fromFound = false;
  let toFound = false;

  for await (const migration of migrations) {
    if (from && migration.relativeFilePath === from) {
      fromFound = true;
    }

    if (to && migration.relativeFilePath === to) {
      toFound = true;
    }

    if (!migrationFilter(migration)) {
      continue;
    }

    collectedMigrations.push(migration);

    if (isFinishedMigration(migration)) {
      skip ||= migration.status === 'failed' || migration.status === 'skipped';

      validatedMigrations.push(migration);
    } else if (
      skip ||
      Boolean(from && migration.relativeFilePath < from) ||
      Boolean(to && migration.relativeFilePath > to) ||
      (limit && migrationsToLock.length >= limit)
    ) {
      validatedMigrations.push({
        ...migration,
        status: 'skipped',
      });
    } else {
      try {
        await validate(migration);
        migrationsToLock.push(migration);
        validatedMigrations.push(migration);
      } catch (error) {
        for (const migration of migrationsToLock) {
          const validatedIndex = validatedMigrations.indexOf(migration);

          validatedMigrations[validatedIndex] = {
            ...migration,
            status: 'skipped',
          };
        }

        migrationsToLock.length = 0;

        validatedMigrations.push({
          ...migration,
          status: 'failed',
          duration: 0,
          error: toError(error),
        });

        skip = true;
      }
    }
  }

  await reporter.onCollectedMigrations?.(collectedMigrations);

  let optionError: Error | undefined;

  if (from && !fromFound) {
    optionError = BadOptionError.fromOption('from', `The "from" migration: "${from}" was not found`);
  } else if (to && !toFound) {
    optionError = BadOptionError.fromOption('to', `The "to" migration: "${to}" was not found`);
  }

  if (optionError) {
    dry = true;
    skip = true;

    for (const migration of migrationsToLock) {
      const validatedIndex = validatedMigrations.indexOf(migration);

      validatedMigrations[validatedIndex] = {
        ...migration,
        status: 'skipped',
      };
    }

    migrationsToLock.length = 0;
  }

  const [lockedMigrations, lockError] = dry
    ? [migrationsToLock]
    : await exec(async () => storage.lock(migrationsToLock), { abortSignal, abortRespite });

  if (lockError) {
    for (const migration of migrationsToLock) {
      const validatedIndex = validatedMigrations.indexOf(migration);

      validatedMigrations[validatedIndex] = {
        ...migration,
        status: 'skipped',
      };
    }

    migrationsToLock.length = 0;

    skip = true;
  } else {
    for (const migration of migrationsToLock) {
      const isLocked = lockedMigrations.some((lockedMigration) => lockedMigration.name === migration.name);

      if (!isLocked) {
        const validatedIndex = validatedMigrations.indexOf(migration);

        validatedMigrations[validatedIndex] = {
          ...migration,
          status: 'skipped',
        };
      }
    }

    await reporter.onLockedMigrations?.(lockedMigrations);
  }

  const finishedMigrations: MigrationMetadataFinished[] = [];

  for await (const migration of validatedMigrations) {
    if (isFinishedMigration(migration)) {
      switch (migration.status) {
        case 'failed': {
          await reporter.onMigrationError?.(migration, migration.error);
          break;
        }

        case 'pending': {
          await reporter.onMigrationSkip?.(migration);
          break;
        }

        case 'skipped': {
          await reporter.onMigrationSkip?.(migration);
          break;
        }

        default: {
          await reporter.onMigrationSuccess?.(migration);
          break;
        }
      }

      finishedMigrations.push(migration);
      continue;
    }

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

    const [, migrationError] = await exec(async () => execute(migration), { abortSignal, abortRespite });

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

  const [, unlockError] = dry
    ? []
    : await exec(async () => storage.unlock(lockedMigrations ?? []), { abortSignal, abortRespite });

  // eslint-disable-next-line unicorn/no-array-callback-reference
  const firstFailed = finishedMigrations.find(isFailedMigration);
  const firstError =
    firstFailed?.error instanceof EmigrateError
      ? firstFailed.error
      : firstFailed
        ? MigrationRunError.fromMetadata(firstFailed)
        : undefined;
  const error =
    optionError ??
    unlockError ??
    firstError ??
    lockError ??
    (abortSignal?.aborted ? toError(abortSignal.reason) : undefined);

  await reporter.onFinished?.(finishedMigrations, error);

  return error;
};

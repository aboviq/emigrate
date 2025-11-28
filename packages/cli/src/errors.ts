import {
  type SerializedError,
  type MigrationMetadata,
  type FailedMigrationMetadata,
  type FailedMigrationHistoryEntry,
} from '@emigrate/types';
import { serializeError, errorConstructors, deserializeError } from 'serialize-error';
import type { CollectedMigration, RunnableMigration } from './types/migrations.js';

const formatter = new Intl.ListFormat('en', { style: 'long', type: 'disjunction' });

export const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

export const toSerializedError = (error: unknown) => {
  const errorInstance = toError(error);

  return serializeError(errorInstance) as unknown as SerializedError;
};

export class EmigrateError extends Error {
  constructor(
    message: string | undefined,
    options?: ErrorOptions,
    public code?: string,
  ) {
    super(message, options);
    this.name = this.constructor.name;
  }
}

export class ShowUsageError extends EmigrateError {}

export class MissingOptionError extends ShowUsageError {
  static fromOption(option: string | string[]): MissingOptionError {
    return new MissingOptionError(
      `Missing required option: ${Array.isArray(option) ? formatter.format(option) : option}`,
      undefined,
      option,
    );
  }

  constructor(
    message: string | undefined,
    options?: ErrorOptions,
    public option: string | string[] = '',
  ) {
    super(message, options, 'ERR_MISSING_OPT');
  }
}

export class MissingArgumentsError extends ShowUsageError {
  static fromArgument(argument: string): MissingArgumentsError {
    return new MissingArgumentsError(`Missing required argument: ${argument}`, undefined, argument);
  }

  constructor(
    message: string | undefined,
    options?: ErrorOptions,
    public argument = '',
  ) {
    super(message, options, 'ERR_MISSING_ARGS');
  }
}

export class OptionNeededError extends ShowUsageError {
  static fromOption(option: string, message: string): OptionNeededError {
    return new OptionNeededError(message, undefined, option);
  }

  constructor(
    message: string | undefined,
    options?: ErrorOptions,
    public option = '',
  ) {
    super(message, options, 'ERR_OPT_NEEDED');
  }
}

export class BadOptionError extends ShowUsageError {
  static fromOption(option: string, message: string): BadOptionError {
    return new BadOptionError(message, undefined, option);
  }

  constructor(
    message: string | undefined,
    options?: ErrorOptions,
    public option = '',
  ) {
    super(message, options, 'ERR_BAD_OPT');
  }
}

export class MissingStorageError extends EmigrateError {
  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_NO_STORAGE');
  }
}

export class UnexpectedError extends EmigrateError {
  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_UNEXPECTED');
  }
}

export class MigrationHistoryError extends EmigrateError {
  static fromHistoryEntry(entry: FailedMigrationHistoryEntry): MigrationHistoryError {
    return new MigrationHistoryError(`Migration ${entry.name} is in a failed state, it should be fixed and removed`, {
      cause: deserializeError(entry.error),
    });
  }

  static create(migration: Pick<RunnableMigration, 'identifier' | 'state'>): MigrationHistoryError {
    if (migration.state.status === 'failed') {
      return new MigrationHistoryError(
        `Migration "${migration.identifier}" is in a failed state, it should be fixed and removed`,
        {
          cause: deserializeError(migration.state.error),
        },
      );
    }

    throw new UnexpectedError(`Migration "${migration.identifier}" is not in a failed state`);
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_MIGRATION_HISTORY');
  }
}

export class MigrationLoadError extends EmigrateError {
  static fromMetadata(metadata: MigrationMetadata, cause?: Error): MigrationLoadError {
    return new MigrationLoadError(`Failed to load migration file: ${metadata.relativeFilePath}`, { cause });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_MIGRATION_LOAD');
  }
}

export class MigrationWaitError extends EmigrateError {
  static create(migration: Pick<RunnableMigration, 'identifier'>, cause?: Error): MigrationWaitError {
    return new MigrationWaitError(`Failed to wait for migration: ${migration.identifier}`, { cause });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_MIGRATION_WAIT');
  }
}

export class MigrationRunError extends EmigrateError {
  static fromMetadata(metadata: FailedMigrationMetadata): MigrationRunError {
    return new MigrationRunError(`Failed to run migration: ${metadata.relativeFilePath}`, { cause: metadata.error });
  }

  static create(migration: Pick<RunnableMigration, 'identifier'>, cause?: Error): MigrationRunError {
    return new MigrationRunError(`Failed to run migration: ${migration.identifier}`, { cause });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_MIGRATION_RUN');
  }
}

export class MigrationNotRunError extends EmigrateError {
  static fromMetadata(metadata: MigrationMetadata, cause?: Error): MigrationNotRunError {
    return new MigrationNotRunError(`Migration "${metadata.name}" is not in the migration history`, { cause });
  }

  static create(migration: RunnableMigration): MigrationNotRunError {
    return new MigrationNotRunError(`Migration "${migration.identifier}" is not in the migration history`);
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_MIGRATION_NOT_RUN');
  }
}

export class MigrationNotLoadedError extends EmigrateError {
  static create(migration: CollectedMigration, cause?: Error): MigrationNotLoadedError {
    // FIXME: more detailed message
    return new MigrationNotLoadedError(`Migration "${migration.identifier}" was not loaded by any plugin`, { cause });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_MIGRATION_NOT_LOADED');
  }
}

export class MigrationRemovalError extends EmigrateError {
  static fromMetadata(metadata: MigrationMetadata, cause?: Error): MigrationRemovalError {
    return new MigrationRemovalError(`Failed to remove migration: ${metadata.relativeFilePath}`, { cause });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_MIGRATION_REMOVE');
  }
}

export class StorageInitError extends EmigrateError {
  static fromError(error: Error): StorageInitError {
    return new StorageInitError('Could not initialize storage', { cause: error });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_STORAGE_INIT');
  }
}

export class CommandAbortError extends EmigrateError {
  static fromSignal(signal: NodeJS.Signals): CommandAbortError {
    return new CommandAbortError(`Command aborted due to signal: ${signal}`);
  }

  static fromReason(reason: string, cause?: unknown): CommandAbortError {
    return new CommandAbortError(`Command aborted: ${reason}`, { cause });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_COMMAND_ABORT');
  }
}

export class ExecutionDesertedError extends EmigrateError {
  static fromReason(reason: string, cause?: Error): ExecutionDesertedError {
    return new ExecutionDesertedError(`Execution deserted: ${reason}`, { cause });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_EXECUTION_DESERTED');
  }
}

errorConstructors.set('EmigrateError', EmigrateError as ErrorConstructor);
errorConstructors.set('ShowUsageError', ShowUsageError as ErrorConstructor);
errorConstructors.set('MissingOptionError', MissingOptionError as unknown as ErrorConstructor);
errorConstructors.set('MissingArgumentsError', MissingArgumentsError as unknown as ErrorConstructor);
errorConstructors.set('OptionNeededError', OptionNeededError as unknown as ErrorConstructor);
errorConstructors.set('BadOptionError', BadOptionError as unknown as ErrorConstructor);
errorConstructors.set('UnexpectedError', UnexpectedError as ErrorConstructor);
errorConstructors.set('MigrationHistoryError', MigrationHistoryError as unknown as ErrorConstructor);
errorConstructors.set('MigrationLoadError', MigrationLoadError as unknown as ErrorConstructor);
errorConstructors.set('MigrationRunError', MigrationRunError as unknown as ErrorConstructor);
errorConstructors.set('MigrationWaitError', MigrationWaitError as unknown as ErrorConstructor);
errorConstructors.set('MigrationNotRunError', MigrationNotRunError as unknown as ErrorConstructor);
errorConstructors.set('MigrationRemovalError', MigrationRemovalError as unknown as ErrorConstructor);
errorConstructors.set('StorageInitError', StorageInitError as unknown as ErrorConstructor);
errorConstructors.set('CommandAbortError', CommandAbortError as unknown as ErrorConstructor);
errorConstructors.set('ExecutionDesertedError', ExecutionDesertedError as unknown as ErrorConstructor);

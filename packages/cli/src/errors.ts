import {
  type SerializedError,
  type MigrationMetadata,
  type FailedMigrationMetadata,
  type FailedMigrationHistoryEntry,
} from '@emigrate/types';
import { serializeError, errorConstructors, deserializeError } from 'serialize-error';

const formatter = new Intl.ListFormat('en', { style: 'long', type: 'disjunction' });

export const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

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
  }
}

export class ShowUsageError extends EmigrateError {}

export class MissingOptionError extends ShowUsageError {
  static fromOption(option: string | string[]) {
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
  static fromArgument(argument: string) {
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
  static fromOption(option: string, message: string) {
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
  static fromOption(option: string, message: string) {
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

export class UnexpectedError extends EmigrateError {
  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_UNEXPECTED');
  }
}

export class MigrationHistoryError extends EmigrateError {
  static fromHistoryEntry(entry: FailedMigrationHistoryEntry) {
    return new MigrationHistoryError(`Migration ${entry.name} is in a failed state, it should be fixed and removed`, {
      cause: deserializeError(entry.error),
    });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_MIGRATION_HISTORY');
  }
}

export class MigrationLoadError extends EmigrateError {
  static fromMetadata(metadata: MigrationMetadata, cause?: Error) {
    return new MigrationLoadError(`Failed to load migration file: ${metadata.relativeFilePath}`, { cause });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_MIGRATION_LOAD');
  }
}

export class MigrationRunError extends EmigrateError {
  static fromMetadata(metadata: FailedMigrationMetadata) {
    return new MigrationRunError(`Failed to run migration: ${metadata.relativeFilePath}`, { cause: metadata.error });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_MIGRATION_RUN');
  }
}

export class MigrationNotRunError extends EmigrateError {
  static fromMetadata(metadata: MigrationMetadata, cause?: Error) {
    return new MigrationNotRunError(`Migration "${metadata.name}" is not in the migration history`, { cause });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_MIGRATION_NOT_RUN');
  }
}

export class StorageInitError extends EmigrateError {
  static fromError(error: Error) {
    return new StorageInitError('Could not initialize storage', { cause: error });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_STORAGE_INIT');
  }
}

export class CommandAbortError extends EmigrateError {
  static fromSignal(signal: NodeJS.Signals) {
    return new CommandAbortError(`Command aborted due to signal: ${signal}`);
  }

  static fromReason(reason: string, cause?: unknown) {
    return new CommandAbortError(`Command aborted: ${reason}`, { cause });
  }

  constructor(message: string | undefined, options?: ErrorOptions) {
    super(message, options, 'ERR_COMMAND_ABORT');
  }
}

export class ExecutionDesertedError extends EmigrateError {
  static fromReason(reason: string, cause?: Error) {
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
errorConstructors.set('MigrationNotRunError', MigrationNotRunError as unknown as ErrorConstructor);
errorConstructors.set('StorageInitError', StorageInitError as unknown as ErrorConstructor);
errorConstructors.set('CommandAbortError', CommandAbortError as unknown as ErrorConstructor);
errorConstructors.set('ExecutionDesertedError', ExecutionDesertedError as unknown as ErrorConstructor);

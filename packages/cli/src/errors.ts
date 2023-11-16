import { type MigrationHistoryEntry, type MigrationMetadata } from '@emigrate/plugin-tools/types';

const formatter = new Intl.ListFormat('en', { style: 'long', type: 'disjunction' });

export class EmigrateError extends Error {
  constructor(
    public code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class ShowUsageError extends EmigrateError {}

export class MissingOptionError extends ShowUsageError {
  constructor(public option: string | string[]) {
    super('ERR_MISSING_OPT', `Missing required option: ${Array.isArray(option) ? formatter.format(option) : option}`);
  }
}

export class MissingArgumentsError extends ShowUsageError {
  constructor(public argument: string) {
    super('ERR_MISSING_ARGS', `Missing required argument: ${argument}`);
  }
}

export class BadOptionError extends ShowUsageError {
  constructor(
    public option: string,
    message: string,
  ) {
    super('ERR_BAD_OPT', message);
  }
}

export class UnexpectedError extends EmigrateError {
  constructor(message: string, options?: ErrorOptions) {
    super('ERR_UNEXPECTED', message, options);
  }
}

export class MigrationHistoryError extends EmigrateError {
  constructor(
    message: string,
    public entry: MigrationHistoryEntry,
  ) {
    super('ERR_MIGRATION_HISTORY', message);
  }
}

export class MigrationLoadError extends EmigrateError {
  constructor(
    message: string,
    public metadata: MigrationMetadata,
    options?: ErrorOptions,
  ) {
    super('ERR_MIGRATION_LOAD', message, options);
  }
}

export class MigrationRunError extends EmigrateError {
  constructor(
    message: string,
    public metadata: MigrationMetadata,
    options?: ErrorOptions,
  ) {
    super('ERR_MIGRATION_RUN', message, options);
  }
}

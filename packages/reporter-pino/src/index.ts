import process from 'node:process';
import { pino, levels, type Logger } from 'pino';
import {
  type Awaitable,
  type MigrationMetadata,
  type MigrationMetadataFinished,
  type ReporterInitParameters,
  type EmigrateReporter,
} from '@emigrate/types';

type PinoReporterOptions = {
  level?: string;
  /**
   * Customize the key used for logging errors
   *
   * @default 'error'
   * @see https://getpino.io/#/docs/api?id=errorkey-string
   */
  errorKey?: string;
};

class PinoReporter implements Required<EmigrateReporter> {
  #logger!: Logger;
  #migrations?: MigrationMetadata[];
  #command!: ReporterInitParameters['command'];

  constructor(private readonly options: PinoReporterOptions) {
    if (!options.level || !levels.values[options.level]) {
      options.level = 'info';
    }
  }

  get logLevel(): string {
    if (this.options.level && levels.values[this.options.level]) {
      return this.options.level;
    }

    return 'info';
  }

  get errorKey(): string {
    return this.options.errorKey ?? 'error';
  }

  onInit({ command, version, ...parameters }: ReporterInitParameters): Awaitable<void> {
    this.#command = command;
    this.#logger = pino({
      name: 'emigrate',
      level: this.logLevel,
      errorKey: this.errorKey,
      base: {
        scope: command,
        version,
      },
      transport: process.isBun ? { target: 'pino/file', options: { destination: 1 } } : undefined,
    });

    this.#logger.info({ parameters }, `Emigrate "${command}" initialized${parameters.dry ? ' (dry-run)' : ''}`);
  }

  onAbort(reason: Error): Awaitable<void> {
    this.#logger.error({ reason }, `Emigrate "${this.#command}" shutting down`);
  }

  onCollectedMigrations(migrations: MigrationMetadata[]): Awaitable<void> {
    this.#migrations = migrations;
  }

  onLockedMigrations(lockedMigrations: MigrationMetadata[]): Awaitable<void> {
    const migrations = this.#migrations ?? [];

    if (migrations.length === 0) {
      this.#logger.info('No migrations found');
      return;
    }

    const statusText = this.#command === 'list' ? 'migrations are pending' : 'pending migrations to run';

    if (migrations.length === lockedMigrations.length) {
      this.#logger.info({ migrationCount: lockedMigrations.length }, `${lockedMigrations.length} ${statusText}`);
      return;
    }

    let skippedCount = 0;
    let failedCount = 0;

    for (const migration of migrations) {
      const isLocked = lockedMigrations.some((lockedMigration) => lockedMigration.name === migration.name);

      if (isLocked) {
        continue;
      }

      if ('status' in migration) {
        if (migration.status === 'failed') {
          failedCount += 1;
        } else if (migration.status === 'skipped') {
          skippedCount += 1;
        }
      }
    }

    const parts = [
      `${lockedMigrations.length} of ${migrations.length} ${statusText}`,
      skippedCount > 0 ? `(${skippedCount} skipped)` : '',
      failedCount > 0 ? `(${failedCount} failed)` : '',
    ].filter(Boolean);

    this.#logger.info({ migrationCount: lockedMigrations.length }, parts.join(' '));
  }

  onNewMigration(migration: MigrationMetadata, content: string): Awaitable<void> {
    this.#logger.info(
      { migration: migration.relativeFilePath, content },
      `Created new migration file: ${migration.name}`,
    );
  }

  onMigrationStart(migration: MigrationMetadata): Awaitable<void> {
    let status = 'running';

    if (this.#command === 'remove') {
      status = 'removing';
    } else if (this.#command === 'new') {
      status = 'creating';
    }

    this.#logger.info({ migration: migration.relativeFilePath }, `${migration.name} (${status})`);
  }

  onMigrationSuccess(migration: MigrationMetadataFinished): Awaitable<void> {
    let status = 'done';

    if (this.#command === 'remove') {
      status = 'removed';
    } else if (this.#command === 'new') {
      status = 'created';
    }

    this.#logger.info({ migration: migration.relativeFilePath }, `${migration.name} (${status})`);
  }

  onMigrationError(migration: MigrationMetadataFinished, error: Error): Awaitable<void> {
    this.#logger.error(
      { migration: migration.relativeFilePath, [this.errorKey]: error },
      `${migration.name} (${migration.status})`,
    );
  }

  onMigrationSkip(migration: MigrationMetadataFinished): Awaitable<void> {
    this.#logger.info({ migration: migration.relativeFilePath }, `${migration.name} (${migration.status})`);
  }

  onFinished(migrations: MigrationMetadataFinished[], error?: Error | undefined): Awaitable<void> {
    const total = migrations.length;
    let done = 0;
    let failed = 0;
    let skipped = 0;
    let pending = 0;

    for (const migration of migrations) {
      const status = 'status' in migration ? migration.status : undefined;
      switch (status) {
        case 'done': {
          done++;
          break;
        }

        case 'failed': {
          failed++;
          break;
        }

        case 'skipped': {
          skipped++;
          break;
        }

        case 'pending': {
          pending++;
          break;
        }

        default: {
          break;
        }
      }
    }

    const result =
      this.#command === 'remove'
        ? { removed: done, failed, skipped, pending, total }
        : { done, failed, skipped, pending, total };

    if (error) {
      this.#logger.error({ result, [this.errorKey]: error }, `Emigrate "${this.#command}" failed`);
    } else {
      this.#logger.info({ result }, `Emigrate "${this.#command}" finished successfully`);
    }
  }
}

export const createPinoReporter = (options: PinoReporterOptions = {}): EmigrateReporter => {
  return new PinoReporter(options);
};

export default createPinoReporter({
  level: process.env['LOG_LEVEL'],
});

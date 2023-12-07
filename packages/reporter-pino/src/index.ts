import process from 'node:process';
import { pino, levels, type Logger } from 'pino';
import {
  type Awaitable,
  type MigrationMetadata,
  type MigrationMetadataFinished,
  type ReporterInitParameters,
  type EmigrateReporter,
} from '@emigrate/plugin-tools/types';

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

  onInit({ command, ...parameters }: ReporterInitParameters): Awaitable<void> {
    this.#command = command;
    this.#logger = pino({
      name: 'emigrate',
      level: this.logLevel,
      errorKey: this.errorKey,
      base: {
        scope: command,
      },
    });

    this.#logger.info({ parameters }, `Emigrate "${command}" initialized${parameters.dry ? ' (dry-run)' : ''}`);
  }

  onCollectedMigrations(migrations: MigrationMetadata[]): Awaitable<void> {
    this.#migrations = migrations;
  }

  onLockedMigrations(lockedMigrations: MigrationMetadata[]): Awaitable<void> {
    const migrations = this.#migrations ?? [];

    if (migrations.length === 0) {
      this.#logger.info('No pending migrations found');
      return;
    }

    if (migrations.length === lockedMigrations.length) {
      this.#logger.info(
        { migrationCount: lockedMigrations.length },
        `${lockedMigrations.length} pending migrations to run`,
      );
      return;
    }

    const nonLockedMigrations = migrations.filter(
      (migration) => !lockedMigrations.some((lockedMigration) => lockedMigration.name === migration.name),
    );
    const failedMigrations = nonLockedMigrations.filter(
      (migration) => 'status' in migration && migration.status === 'failed',
    );
    const unlockableCount = nonLockedMigrations.length - failedMigrations.length;
    const parts = [
      `${lockedMigrations.length} of ${migrations.length} pending migrations to run`,
      unlockableCount > 0 ? `(${unlockableCount} locked)` : '',
      failedMigrations.length > 0 ? `(${failedMigrations.length} failed)` : '',
    ].filter(Boolean);

    this.#logger.info({ migrationCount: lockedMigrations.length }, parts.join(' '));
  }

  onNewMigration(migration: MigrationMetadata, content: string): Awaitable<void> {
    this.#logger.info({ migration, content }, `Created new migration file: ${migration.name}`);
  }

  onMigrationRemoveStart(migration: MigrationMetadata): Awaitable<void> {
    this.#logger.debug({ migration }, `Removing migration: ${migration.name}`);
  }

  onMigrationRemoveSuccess(migration: MigrationMetadataFinished): Awaitable<void> {
    this.#logger.info({ migration }, `Successfully removed migration: ${migration.name}`);
  }

  onMigrationRemoveError(migration: MigrationMetadataFinished, error: Error): Awaitable<void> {
    this.#logger.error({ migration, [this.errorKey]: error }, `Failed to remove migration: ${migration.name}`);
  }

  onMigrationStart(migration: MigrationMetadata): Awaitable<void> {
    this.#logger.info({ migration }, `${migration.name} (running)`);
  }

  onMigrationSuccess(migration: MigrationMetadataFinished): Awaitable<void> {
    this.#logger.info({ migration }, `${migration.name} (${migration.status})`);
  }

  onMigrationError(migration: MigrationMetadataFinished, error: Error): Awaitable<void> {
    this.#logger.error({ migration, [this.errorKey]: error }, `${migration.name} (${migration.status})`);
  }

  onMigrationSkip(migration: MigrationMetadataFinished): Awaitable<void> {
    this.#logger.info({ migration }, `${migration.name} (${migration.status})`);
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

    if (error) {
      this.#logger.error(
        { failed, done, skipped, pending, total, [this.errorKey]: error },
        `Emigrate "${this.#command}" failed`,
      );
    } else {
      this.#logger.info({ failed, done, skipped, pending, total }, `Emigrate "${this.#command}" finished successfully`);
    }
  }
}

export const createPinoReporter = (options: PinoReporterOptions = {}): EmigrateReporter => {
  return new PinoReporter(options);
};

export default createPinoReporter({
  level: process.env['LOG_LEVEL'],
});

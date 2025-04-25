import { setInterval } from 'node:timers';
import logUpdate from 'log-update';
import isInteractive from 'is-interactive';
import {
  type MigrationMetadata,
  type MigrationMetadataFinished,
  type EmigrateReporter,
  type ReporterInitParameters,
  type Awaitable,
} from '@emigrate/types';
import { getAbortMessage, getError, getHeaderMessage, getMigrationText, getSummary, getTitle } from './ui.js';

const interactive = isInteractive();

class DefaultFancyReporter implements Required<EmigrateReporter> {
  #migrations: Array<MigrationMetadata | MigrationMetadataFinished> | undefined;
  #lockedMigrations: MigrationMetadata[] | undefined;
  #activeMigration: MigrationMetadata | undefined;
  #error: Error | undefined;
  #parameters!: ReporterInitParameters;
  #interval: NodeJS.Timeout | undefined;
  #abortReason: Error | undefined;

  start(): void {
    this.#render();
    this.#interval = setInterval(() => {
      this.#render();
    }, 80).unref();
  }

  stop(): void {
    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = undefined;
    }

    this.#render(true);
  }

  onInit(parameters: ReporterInitParameters): void | PromiseLike<void> {
    this.#parameters = parameters;

    this.start();
  }

  onAbort(reason: Error): void | PromiseLike<void> {
    this.#abortReason = reason;
  }

  onCollectedMigrations(migrations: MigrationMetadata[]): void | PromiseLike<void> {
    this.#migrations = migrations;
  }

  onLockedMigrations(migrations: MigrationMetadata[]): void | PromiseLike<void> {
    this.#lockedMigrations = migrations;
  }

  onNewMigration(migration: MigrationMetadata, _content: string): Awaitable<void> {
    this.#migrations = [migration];
  }

  onMigrationStart(migration: MigrationMetadata): void | PromiseLike<void> {
    this.#activeMigration = migration;
  }

  onMigrationSuccess(migration: MigrationMetadataFinished): void | PromiseLike<void> {
    this.#finishMigration(migration);
  }

  onMigrationError(migration: MigrationMetadataFinished, _error: Error): void | PromiseLike<void> {
    this.#finishMigration(migration);
  }

  onMigrationSkip(migration: MigrationMetadataFinished): void | PromiseLike<void> {
    this.#finishMigration(migration);
  }

  onFinished(migrations: MigrationMetadataFinished[], error?: Error | undefined): void | PromiseLike<void> {
    if (this.#parameters.command === 'new') {
      for (const migration of migrations) {
        this.#finishMigration(migration);
      }
    }

    this.#error = error;
    this.#activeMigration = undefined;
    this.stop();
  }

  #finishMigration(migration: MigrationMetadataFinished): void {
    this.#migrations ??= [];

    const index = this.#migrations.findIndex((m) => m.name === migration.name);

    if (index === -1) {
      this.#migrations.push(migration);
    } else {
      this.#migrations[index] = migration;
    }
  }

  #render(flush = false): void {
    const parts = [
      getTitle(this.#parameters),
      getHeaderMessage(this.#parameters.command, this.#migrations, this.#lockedMigrations),
      this.#migrations
        ?.map((migration) => getMigrationText(this.#parameters.command, migration, this.#activeMigration))
        .join('\n') ?? '',
      getAbortMessage(this.#abortReason),
      getSummary(this.#parameters.command, this.#migrations),
      getError(this.#error),
    ];

    const output = '\n' + parts.filter(Boolean).join('\n\n') + '\n';

    if (flush) {
      logUpdate.clear();
      logUpdate.done();
      console.log(output);
      return;
    }

    logUpdate(output);
  }
}

class DefaultReporter implements Required<EmigrateReporter> {
  #migrations?: MigrationMetadata[];
  #lockedMigrations?: MigrationMetadata[];
  #parameters!: ReporterInitParameters;

  onInit(parameters: ReporterInitParameters): void | PromiseLike<void> {
    this.#parameters = parameters;
    console.log('');
    console.log(getTitle(parameters));
    console.log('');
  }

  onAbort(reason: Error): void | PromiseLike<void> {
    console.log('');
    console.error(getAbortMessage(reason));
    console.log('');
  }

  onCollectedMigrations(migrations: MigrationMetadata[]): void | PromiseLike<void> {
    this.#migrations = migrations;
  }

  onLockedMigrations(migrations: MigrationMetadata[]): void | PromiseLike<void> {
    this.#lockedMigrations = migrations;

    console.log(getHeaderMessage(this.#parameters.command, this.#migrations, this.#lockedMigrations));
    console.log('');
  }

  onNewMigration(migration: MigrationMetadata, _content: string): Awaitable<void> {
    console.log(getMigrationText(this.#parameters.command, migration));
  }

  onMigrationStart(migration: MigrationMetadata): void | PromiseLike<void> {
    console.log(getMigrationText(this.#parameters.command, migration, migration));
  }

  onMigrationSuccess(migration: MigrationMetadataFinished): void | PromiseLike<void> {
    console.log(getMigrationText(this.#parameters.command, migration));
  }

  onMigrationError(migration: MigrationMetadataFinished, _error: Error): void | PromiseLike<void> {
    console.error(getMigrationText(this.#parameters.command, migration));
  }

  onMigrationSkip(migration: MigrationMetadataFinished): void | PromiseLike<void> {
    console.log(getMigrationText(this.#parameters.command, migration));
  }

  onFinished(migrations: MigrationMetadataFinished[], error?: Error | undefined): void | PromiseLike<void> {
    console.log('');
    console.log(getSummary(this.#parameters.command, migrations));
    console.log('');

    if (error) {
      console.error(getError(error));
      console.log('');
    }
  }
}

const reporterDefault: EmigrateReporter = interactive ? new DefaultFancyReporter() : new DefaultReporter();

export default reporterDefault;

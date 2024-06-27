import { type ReporterInitParameters, type EmigrateReporter, type MigrationMetadataFinished } from '@emigrate/types';
import { toSerializedError } from '../errors.js';

class JsonReporter implements EmigrateReporter {
  #parameters!: ReporterInitParameters;
  #startTime!: number;

  onInit(parameters: ReporterInitParameters): void {
    this.#startTime = Date.now();
    this.#parameters = parameters;
  }

  onFinished(migrations: MigrationMetadataFinished[], error?: Error | undefined): void {
    const { command, version } = this.#parameters;

    let numberDoneMigrations = 0;
    let numberSkippedMigrations = 0;
    let numberFailedMigrations = 0;
    let numberPendingMigrations = 0;

    for (const migration of migrations) {
      // eslint-disable-next-line unicorn/prefer-switch
      if (migration.status === 'done') {
        numberDoneMigrations++;
      } else if (migration.status === 'skipped') {
        numberSkippedMigrations++;
      } else if (migration.status === 'failed') {
        numberFailedMigrations++;
      } else {
        numberPendingMigrations++;
      }
    }

    const result = {
      command,
      version,
      numberTotalMigrations: migrations.length,
      numberDoneMigrations,
      numberSkippedMigrations,
      numberFailedMigrations,
      numberPendingMigrations,
      success: !error,
      startTime: this.#startTime,
      endTime: Date.now(),
      error: error ? toSerializedError(error) : undefined,
      migrations: migrations.map((migration) => ({
        name: migration.filePath,
        status: migration.status,
        duration: 'duration' in migration ? migration.duration : 0,
        error: 'error' in migration ? toSerializedError(migration.error) : undefined,
      })),
    };

    console.log(JSON.stringify(result, undefined, 2));
  }
}

const jsonReporter: EmigrateReporter = new JsonReporter();

export default jsonReporter;

import { type ReporterPlugin } from '@emigrate/plugin-tools/types';

const reporterDefault: ReporterPlugin = {
  onInit({ dry, directory }) {
    console.log(`Running migrations in: ${directory}${dry ? ' (dry run)' : ''}`);
  },
  onCollectedMigrations(migrations) {
    console.log(`Found ${migrations.length} pending migrations`);
  },
  onLockedMigrations(migrations) {
    console.log(`Locked ${migrations.length} migrations`);
  },
  onMigrationStart(migration) {
    console.log(`- ${migration.relativeFilePath} (running)`);
  },
  onMigrationSuccess(migration) {
    console.log(`- ${migration.relativeFilePath} (success) [${migration.duration}ms]`);
  },
  onMigrationError(migration, error) {
    console.error(`- ${migration.relativeFilePath} (failed!) [${migration.duration}ms]`);
    console.error(error.cause ?? error);
  },
  onMigrationSkip(migration) {
    console.log(`- ${migration.relativeFilePath} (skipped)`);
  },
  onFinished(migrations, error) {
    const totalDuration = migrations.reduce((total, migration) => total + migration.duration, 0);

    if (error) {
      console.error('Failed to run migrations! [total duration: %dms]', totalDuration);
      console.error(error.cause ?? error);
      return;
    }

    console.log(`Successfully ran ${migrations.length} migrations! [total duration: ${totalDuration}ms]`);
  },
};

export default reporterDefault;

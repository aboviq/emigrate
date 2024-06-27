import { type MigrationHistoryEntry, type MigrationMetadata, type MigrationMetadataFinished } from '@emigrate/types';
import { toMigrationMetadata } from './to-migration-metadata.js';
import { getMigrations as getMigrationsOriginal, type GetMigrationsFunction } from './get-migrations.js';

export async function* collectMigrations(
  cwd: string,
  directory: string,
  history: AsyncIterable<MigrationHistoryEntry>,
  getMigrations: GetMigrationsFunction = getMigrationsOriginal,
): AsyncIterable<MigrationMetadata | MigrationMetadataFinished> {
  const allMigrations = await getMigrations(cwd, directory);
  const seen = new Set<string>();

  for await (const entry of history) {
    const migration = allMigrations.find((migrationFile) => {
      return migrationFile.name === entry.name || migrationFile.name === `${entry.name}.js`;
    });

    if (!migration) {
      continue;
    }

    yield toMigrationMetadata({ ...entry, name: migration.name }, { cwd, directory });

    seen.add(migration.name);
  }

  yield* allMigrations.filter((migration) => !seen.has(migration.name));

  seen.clear();
}

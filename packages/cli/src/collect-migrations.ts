import { type MigrationHistoryEntry, type MigrationMetadata, type MigrationMetadataFinished } from '@emigrate/types';
import { toMigrationMetadata } from './to-migration-metadata.js';
import { getMigrations as getMigrationsOriginal } from './get-migrations.js';

export async function* collectMigrations(
  cwd: string,
  directory: string,
  history: AsyncIterable<MigrationHistoryEntry>,
  getMigrations = getMigrationsOriginal,
): AsyncIterable<MigrationMetadata | MigrationMetadataFinished> {
  const allMigrations = await getMigrations(cwd, directory);
  const seen = new Set<string>();

  for await (const entry of history) {
    const index = allMigrations.findIndex((migrationFile) => migrationFile.name === entry.name);

    if (index === -1) {
      continue;
    }

    yield toMigrationMetadata(entry, { cwd, directory });

    seen.add(entry.name);
  }

  yield* allMigrations.filter((migration) => !seen.has(migration.name));

  seen.clear();
}

import path from 'node:path';
import { type MigrationHistoryEntry, type MigrationMetadataFinished } from '@emigrate/plugin-tools/types';
import { withLeadingPeriod } from './with-leading-period.js';
import { MigrationHistoryError } from './errors.js';

export const toMigrationMetadata = (
  entry: MigrationHistoryEntry,
  { cwd, directory }: { cwd: string; directory: string },
): MigrationMetadataFinished => {
  const filePath = path.resolve(cwd, directory, entry.name);
  const finishedMigration: MigrationMetadataFinished = {
    name: entry.name,
    status: entry.status,
    filePath,
    relativeFilePath: path.relative(cwd, filePath),
    extension: withLeadingPeriod(path.extname(entry.name)),
    directory,
    cwd,
    duration: 0,
  };

  if (entry.status === 'failed') {
    finishedMigration.error = new MigrationHistoryError(
      `Migration ${entry.name} is in a failed state, it should be fixed and removed`,
      entry,
    );
  }

  return finishedMigration;
};

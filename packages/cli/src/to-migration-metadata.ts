import path from 'node:path';
import { type MigrationHistoryEntry, type MigrationMetadataFinished } from '@emigrate/types';
import { withLeadingPeriod } from './with-leading-period.js';
import { MigrationHistoryError } from './errors.js';

export const toMigrationMetadata = (
  entry: MigrationHistoryEntry,
  { cwd, directory }: { cwd: string; directory: string },
): MigrationMetadataFinished => {
  const filePath = path.resolve(cwd, directory, entry.name);

  if (entry.status === 'failed') {
    return {
      name: entry.name,
      status: entry.status,
      filePath,
      relativeFilePath: path.relative(cwd, filePath),
      extension: withLeadingPeriod(path.extname(entry.name)),
      directory,
      cwd,
      duration: 0,
      error: MigrationHistoryError.fromHistoryEntry(entry),
    };
  }

  return {
    name: entry.name,
    status: entry.status,
    filePath,
    relativeFilePath: path.relative(cwd, filePath),
    extension: withLeadingPeriod(path.extname(entry.name)),
    directory,
    cwd,
    duration: 0,
  };
};

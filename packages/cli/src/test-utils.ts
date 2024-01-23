import path from 'node:path';
import {
  type FailedMigrationHistoryEntry,
  type MigrationHistoryEntry,
  type MigrationMetadata,
  type NonFailedMigrationHistoryEntry,
} from '@emigrate/types';

export function toMigration(cwd: string, directory: string, name: string): MigrationMetadata {
  return {
    name,
    filePath: `${cwd}/${directory}/${name}`,
    relativeFilePath: `${directory}/${name}`,
    extension: path.extname(name),
    directory,
    cwd,
  };
}

export function toMigrations(cwd: string, directory: string, names: string[]): MigrationMetadata[] {
  return names.map((name) => toMigration(cwd, directory, name));
}

export function toEntry(name: MigrationHistoryEntry): MigrationHistoryEntry;
export function toEntry<S extends MigrationHistoryEntry['status']>(
  name: string,
  status?: S,
): S extends 'failed' ? FailedMigrationHistoryEntry : NonFailedMigrationHistoryEntry;

export function toEntry(name: string | MigrationHistoryEntry, status?: 'done' | 'failed'): MigrationHistoryEntry {
  if (typeof name !== 'string') {
    return name.status === 'failed' ? name : name;
  }

  if (status === 'failed') {
    return {
      name,
      status,
      date: new Date(),
      error: { name: 'Error', message: 'Failed' },
    };
  }

  return {
    name,
    status: status ?? 'done',
    date: new Date(),
  };
}

export function toEntries(
  names: Array<string | MigrationHistoryEntry>,
  status?: MigrationHistoryEntry['status'],
): MigrationHistoryEntry[] {
  return names.map((name) => (typeof name === 'string' ? toEntry(name, status) : name));
}

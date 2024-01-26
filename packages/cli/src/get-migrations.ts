import path from 'node:path';
import fs from 'node:fs/promises';
import { type MigrationMetadata } from '@emigrate/types';
import { withLeadingPeriod } from './with-leading-period.js';
import { BadOptionError } from './errors.js';
import { arrayFromAsync } from './array-from-async.js';

export type GetMigrationsFunction = typeof getMigrations;

async function* tryReadDirectory(directoryPath: string): AsyncIterable<string> {
  try {
    for await (const entry of await fs.opendir(directoryPath)) {
      if (
        entry.isFile() &&
        !entry.name.startsWith('.') &&
        !entry.name.startsWith('_') &&
        path.extname(entry.name) !== ''
      ) {
        yield entry.name;
      }
    }
  } catch {
    throw BadOptionError.fromOption('directory', `Couldn't read directory: ${directoryPath}`);
  }
}

export const getMigrations = async (cwd: string, directory: string): Promise<MigrationMetadata[]> => {
  const directoryPath = path.resolve(cwd, directory);

  const allFilesInMigrationDirectory = await arrayFromAsync(tryReadDirectory(directoryPath));

  return allFilesInMigrationDirectory.sort().map((name) => {
    const filePath = path.join(directoryPath, name);

    return {
      name,
      filePath,
      relativeFilePath: path.relative(cwd, filePath),
      extension: withLeadingPeriod(path.extname(name)),
      directory,
      cwd,
    } satisfies MigrationMetadata;
  });
};

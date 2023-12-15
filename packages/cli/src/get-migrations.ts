import path from 'node:path';
import fs from 'node:fs/promises';
import { type Dirent } from 'node:fs';
import { type MigrationMetadata } from '@emigrate/types';
import { withLeadingPeriod } from './with-leading-period.js';
import { BadOptionError } from './errors.js';

export type GetMigrationsFunction = typeof getMigrations;

const tryReadDirectory = async (directoryPath: string): Promise<Dirent[]> => {
  try {
    return await fs.readdir(directoryPath, {
      withFileTypes: true,
    });
  } catch {
    throw BadOptionError.fromOption('directory', `Couldn't read directory: ${directoryPath}`);
  }
};

export const getMigrations = async (cwd: string, directory: string): Promise<MigrationMetadata[]> => {
  const directoryPath = path.resolve(cwd, directory);

  const allFilesInMigrationDirectory = await tryReadDirectory(directoryPath);

  const migrationFiles: MigrationMetadata[] = allFilesInMigrationDirectory
    .filter((file) => file.isFile() && !file.name.startsWith('.') && !file.name.startsWith('_'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name }) => {
      const filePath = path.join(directoryPath, name);

      return {
        name,
        filePath,
        relativeFilePath: path.relative(cwd, filePath),
        extension: withLeadingPeriod(path.extname(name)),
        directory,
        cwd,
      };
    });

  return migrationFiles;
};

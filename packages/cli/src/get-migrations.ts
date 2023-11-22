import path from 'node:path';
import fs from 'node:fs/promises';
import { type MigrationMetadata } from '@emigrate/plugin-tools/types';
import { withLeadingPeriod } from './with-leading-period.js';

export const getMigrations = async (cwd: string, directory: string): Promise<MigrationMetadata[]> => {
  const allFilesInMigrationDirectory = await fs.readdir(path.resolve(cwd, directory), {
    withFileTypes: true,
  });

  const migrationFiles: MigrationMetadata[] = allFilesInMigrationDirectory
    .filter((file) => file.isFile() && !file.name.startsWith('.') && !file.name.startsWith('_'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name }) => {
      const filePath = path.resolve(cwd, directory, name);

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

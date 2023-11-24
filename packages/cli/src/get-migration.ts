import path from 'node:path';
import fs from 'node:fs/promises';
import { type MigrationMetadata } from '@emigrate/plugin-tools/types';
import { withLeadingPeriod } from './with-leading-period.js';
import { OptionNeededError } from './errors.js';

const checkMigrationFile = async (name: string, filePath: string) => {
  try {
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      throw new Error('Not a file');
    }
  } catch {
    throw new OptionNeededError(
      'force',
      `The given migration name "${name}" does not exist or is not a file. Use the "force" option to ignore this error`,
    );
  }
};

export const getMigration = async (
  cwd: string,
  directory: string,
  name: string,
  requireExists = true,
): Promise<MigrationMetadata> => {
  const filePath = path.resolve(cwd, directory, name);

  if (requireExists) {
    await checkMigrationFile(name, filePath);
  }

  return {
    name,
    filePath,
    relativeFilePath: path.relative(cwd, filePath),
    extension: withLeadingPeriod(path.extname(name)),
    directory,
    cwd,
  };
};

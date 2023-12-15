import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { UnexpectedError } from './errors.js';

type PackageInfo = {
  version: string;
};

const getPackageInfo = async () => {
  const packageInfoPath = fileURLToPath(new URL('../package.json', import.meta.url));

  try {
    const content = await fs.readFile(packageInfoPath, 'utf8');
    const packageJson: unknown = JSON.parse(content);

    if (
      typeof packageJson === 'object' &&
      packageJson &&
      'version' in packageJson &&
      typeof packageJson.version === 'string'
    ) {
      return packageJson as PackageInfo;
    }
  } catch {
    // ignore
  }

  throw new UnexpectedError(`Could not read package info from: ${packageInfoPath}`);
};

export const { version } = await getPackageInfo();

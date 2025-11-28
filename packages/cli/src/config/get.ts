import process from 'node:process';
import { cosmiconfig, defaultLoaders } from 'cosmiconfig';
import type { EmigrateConfig } from '../types/config.js';
import path from 'node:path';
import { relativize } from '../utils/relativize.js';

const canImportTypeScriptAsIs = Boolean(process.isBun) || typeof Deno !== 'undefined';

const getEmigrateConfig = (config: any): EmigrateConfig => {
  if ('default' in config && typeof config.default === 'object' && config.default !== null) {
    return config.default as EmigrateConfig;
  }

  if (typeof config === 'object' && config !== null) {
    return config as EmigrateConfig;
  }

  return {};
};

export const getConfig = async (
  cwd: string = process.cwd(),
  forceImportTypeScriptAsIs = false,
): Promise<EmigrateConfig> => {
  const explorer = cosmiconfig('emigrate', {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    loaders:
      forceImportTypeScriptAsIs || canImportTypeScriptAsIs
        ? { '.ts': defaultLoaders['.js'], '.cts': defaultLoaders['.cjs'], '.mts': defaultLoaders['.mjs'] }
        : undefined,
  });

  const result = await explorer.search(cwd);

  if (result?.isEmpty || !result?.config) {
    return {};
  }

  const config = getEmigrateConfig(result.config);

  return {
    ...config,
    plugins: config.plugins ? relativize(config.plugins, path.dirname(result.filepath), cwd) : undefined,
  };
};

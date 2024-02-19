import process from 'node:process';
import { cosmiconfig, defaultLoaders } from 'cosmiconfig';
import { type Config, type EmigrateConfig } from './types.js';

const commands = ['up', 'list', 'new', 'remove'] as const;
type Command = (typeof commands)[number];
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

export const getConfig = async (command: Command, forceImportTypeScriptAsIs = false): Promise<Config> => {
  const explorer = cosmiconfig('emigrate', {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    loaders: forceImportTypeScriptAsIs || canImportTypeScriptAsIs ? { '.ts': defaultLoaders['.js'] } : undefined,
  });

  const result = await explorer.search();

  if (!result?.config) {
    return {};
  }

  const config = getEmigrateConfig(result.config);

  const commandConfig = config[command];

  for (const command of commands) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete config[command];
  }

  return { ...config, ...commandConfig };
};

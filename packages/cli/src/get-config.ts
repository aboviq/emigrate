import { cosmiconfig } from 'cosmiconfig';
import { type Config, type EmigrateConfig } from './types.js';

export const getConfig = async (command: 'up' | 'list' | 'new'): Promise<Config> => {
  const explorer = cosmiconfig('emigrate');

  const result = await explorer.search();

  if (!result?.config) {
    return {};
  }

  const { plugins, directory, template, ...commandsConfig } = result.config as EmigrateConfig;

  if (commandsConfig[command]) {
    return { plugins, directory, template, ...commandsConfig[command] };
  }

  return { plugins, directory, template };
};

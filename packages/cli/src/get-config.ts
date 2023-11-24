import { cosmiconfig } from 'cosmiconfig';
import { type Config, type EmigrateConfig } from './types.js';

const commands = ['up', 'list', 'new', 'remove'] as const;
type Command = (typeof commands)[number];

export const getConfig = async (command: Command): Promise<Config> => {
  const explorer = cosmiconfig('emigrate');

  const result = await explorer.search();

  if (!result?.config) {
    return {};
  }

  const config = result.config as EmigrateConfig;

  const commandConfig = config[command];

  for (const command of commands) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete config[command];
  }

  return { ...config, ...commandConfig };
};

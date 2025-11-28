import path from 'node:path';
import type { EmigrateConfig } from '../types/config.js';

/**
 * Make relative plugin paths based on cwd
 */
export const relativize = (
  plugins: EmigrateConfig['plugins'],
  root: string,
  cwd: string,
): Exclude<EmigrateConfig['plugins'], undefined> => {
  if (!plugins) {
    return [];
  }

  return plugins.map((plugin) => {
    if (typeof plugin === 'string' && (plugin.startsWith('.') || plugin.startsWith('/'))) {
      return path.relative(cwd, path.resolve(root, plugin));
    }

    return plugin;
  });
};

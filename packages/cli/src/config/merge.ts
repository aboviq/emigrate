import type { EmigrateConfig } from '../types/config.js';
import type { DeepPartial } from '../types/utils.js';
import { mergeRecursively } from '../utils/merge-recursively.js';

export const mergeConfig = <C extends EmigrateConfig>(defaults: C, overrides: DeepPartial<C>): C => {
  return mergeRecursively(defaults, overrides) as C;
};

import type { EmigrateReporter } from '@emigrate/types';
import { type Config } from '../types.js';
import * as reporters from './index.js';

export const getStandardReporter = (reporter?: Config['reporter']): EmigrateReporter | undefined => {
  if (!reporter) {
    return reporters.pretty;
  }

  if (typeof reporter === 'string' && reporter in reporters) {
    return reporters[reporter as keyof typeof reporters];
  }

  return undefined;
};

import type { Result } from '../utils/exec.js';
import type { EmigrateStorage } from './storage.js';

export type FailsafeStorage = {
  [K in keyof EmigrateStorage]-?: Exclude<EmigrateStorage[K], undefined> extends (...args: infer A) => Promise<infer R>
    ? (...args: A) => Promise<Result<R>>
    : EmigrateStorage[K];
};

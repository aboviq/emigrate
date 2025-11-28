import { serializeError } from 'serialize-error';
import type { SerializedError } from '../types/utils.js';

export const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

export const toSerializedError = (error: unknown) => {
  const errorInstance = toError(error);

  return serializeError(errorInstance) as unknown as SerializedError;
};

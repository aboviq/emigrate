import { toError } from './errors.js';

type Fn<Args extends any[], Result> = (...args: Args) => Result;
type Result<T> = [value: T, error: undefined] | [value: undefined, error: Error];

/**
 * Execute a function and return a result tuple
 *
 * This is a helper function to make it easier to handle errors without the extra nesting of try/catch
 */
export const exec = async <Args extends any[], Return extends Promise<any>>(
  fn: Fn<Args, Return>,
  ...args: Args
): Promise<Result<Awaited<Return>>> => {
  try {
    const result = await fn(...args);

    return [result, undefined];
  } catch (error) {
    return [undefined, toError(error)];
  }
};

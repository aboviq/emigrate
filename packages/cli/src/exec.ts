import { setTimeout } from 'node:timers';
import prettyMs from 'pretty-ms';
import { ExecutionDesertedError, toError } from './errors.js';
import { DEFAULT_RESPITE_SECONDS } from './defaults.js';

type Result<T> = [value: T, error: undefined] | [value: undefined, error: Error];

type ExecOptions = {
  abortSignal?: AbortSignal;
  abortRespite?: number;
};

/**
 * Execute a function and return a result tuple
 *
 * This is a helper function to make it easier to handle errors without the extra nesting of try/catch
 * If an abort signal is provided the function will reject with an ExecutionDesertedError if the signal is aborted
 * and the given function has not yet resolved within the given respite time (or a default of 30 seconds)
 *
 * @param fn The function to execute
 * @param options Options for the execution
 */
export const exec = async <Return extends Promise<any>>(
  fn: () => Return,
  options: ExecOptions = {},
): Promise<Result<Awaited<Return>>> => {
  try {
    const aborter = options.abortSignal ? getAborter(options.abortSignal, options.abortRespite) : undefined;
    const result = await Promise.race(aborter ? [aborter, fn()] : [fn()]);

    return [result, undefined];
  } catch (error) {
    return [undefined, toError(error)];
  }
};

/**
 * Returns a promise that rejects after a given time after the given signal is aborted
 *
 * @param signal The abort signal to listen to
 * @param respite The time in milliseconds to wait before rejecting
 */
const getAborter = async (signal: AbortSignal, respite = DEFAULT_RESPITE_SECONDS * 1000): Promise<never> => {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      setTimeout(
        reject,
        respite,
        ExecutionDesertedError.fromReason(`Deserted after ${prettyMs(respite)}`, toError(signal.reason)),
      ).unref();
      return;
    }

    signal.addEventListener(
      'abort',
      () => {
        setTimeout(
          reject,
          respite,
          ExecutionDesertedError.fromReason(`Deserted after ${prettyMs(respite)}`, toError(signal.reason)),
        ).unref();
      },
      { once: true },
    );
  });
};

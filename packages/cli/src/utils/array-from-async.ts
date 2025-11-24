/**
 * This is a simple polyfill for [Array.fromAsync()](https://github.com/tc39/proposal-array-from-async)
 *
 * It converts an async iterable to an array.
 */
export const arrayFromAsync = async <T>(iterable: AsyncIterable<T>): Promise<T[]> => {
  const array: T[] = [];

  for await (const item of iterable) {
    array.push(item);
  }

  return array;
};

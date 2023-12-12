export function filterAsync<T, S extends T>(
  iterable: AsyncIterable<T>,
  filter: (item: T) => item is S,
): AsyncIterable<S>;
export function filterAsync<T>(iterable: AsyncIterable<T>, filter: (item: T) => unknown): AsyncIterable<T>;

export async function* filterAsync<T>(iterable: AsyncIterable<T>, filter: (item: T) => unknown): AsyncIterable<T> {
  for await (const item of iterable) {
    if (filter(item)) {
      yield item;
    }
  }
}

export async function* arrayMapAsync<T, U>(iterable: AsyncIterable<T>, mapper: (item: T) => U): AsyncIterable<U> {
  for await (const item of iterable) {
    yield mapper(item);
  }
}

export type Awaitable<T> = T | PromiseLike<T>;

export type StringOrModule<T> = string | T | (() => Awaitable<T>) | (() => Awaitable<{ default: T }>);

export type SerializedError = Record<string, unknown>;

export type DeepPartial<T> = {
  // eslint-disable-next-line @typescript-eslint/array-type, @typescript-eslint/ban-types
  [P in keyof T]?: T[P] extends (infer U)[] ? DeepPartial<U>[] : T[P] extends object ? DeepPartial<T[P]> : T[P];
};

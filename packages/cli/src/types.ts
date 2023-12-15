import { type EmigrateStorage, type Awaitable, type Plugin, type EmigrateReporter } from '@emigrate/types';

export type EmigratePlugin = Plugin;

type StringOrModule<T> = string | T | (() => Awaitable<T>) | (() => Awaitable<{ default: T }>);

export type Config = {
  storage?: StringOrModule<EmigrateStorage>;
  reporter?: StringOrModule<EmigrateReporter>;
  plugins?: Array<StringOrModule<EmigratePlugin>>;
  directory?: string;
  template?: string;
  extension?: string;
};

export type EmigrateConfig = Config & {
  up?: Config;
  new?: Config;
  list?: Config;
  remove?: Config;
};

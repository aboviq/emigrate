import { type EmigrateStorage, type Awaitable, type Plugin, type EmigrateReporter } from '@emigrate/types';
import type * as reporters from './reporters/index.js';

export type StandardReporter = keyof typeof reporters;

export type EmigratePlugin = Plugin;

type StringOrModule<T> = string | T | (() => Awaitable<T>) | (() => Awaitable<{ default: T }>);

export type Config = {
  storage?: StringOrModule<EmigrateStorage>;
  reporter?: StandardReporter | StringOrModule<EmigrateReporter>;
  plugins?: Array<StringOrModule<EmigratePlugin>>;
  directory?: string;
  template?: string;
  extension?: string;
  color?: boolean;
  abortRespite?: number;
};

export type EmigrateConfig = Config & {
  up?: Config;
  new?: Config;
  list?: Config;
  remove?: Config;
};

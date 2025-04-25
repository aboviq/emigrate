import { type EmigrateStorage, type Awaitable, type Plugin, type EmigrateReporter } from '@emigrate/types';
import type * as reporters from './reporters/index.js';
import { type PrefixGenerator, type StandardPrefix } from './prefixes.js';

export type StandardReporter = keyof typeof reporters;

export type EmigratePlugin = Plugin;

type StringOrModule<T> = string | T | (() => Awaitable<T>) | (() => Awaitable<{ default: T }>);

export type NewCommandConfig = {
  plugins?: Array<StringOrModule<EmigratePlugin>>;
  directory?: string;
  template?: string;
  extension?: string;
  prefix?: StandardPrefix | PrefixGenerator;
  joiner?: string;
  color?: boolean;
};

export type DefaultConfig = {
  storage?: StringOrModule<EmigrateStorage>;
  reporter?: StandardReporter | StringOrModule<EmigrateReporter>;
  plugins?: Array<StringOrModule<EmigratePlugin>>;
  directory?: string;
  color?: boolean;
  abortRespite?: number;
};

export type EmigrateCommandConfigs = {
  up: DefaultConfig;
  new: NewCommandConfig;
  list: DefaultConfig;
  remove: DefaultConfig;
};

export type EmigrateConfig = NewCommandConfig & DefaultConfig & Partial<EmigrateCommandConfigs>;

export { type PrefixGenerator, type StandardPrefix } from './prefixes.js';

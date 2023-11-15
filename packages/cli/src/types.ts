import { type Plugin } from '@emigrate/plugin-tools/types';

export type EmigratePlugin = Plugin;

export type Config = {
  plugins?: Array<string | EmigratePlugin>;
  directory?: string;
  template?: string;
  extension?: string;
};

export type EmigrateConfig = Config & {
  up?: Config;
  new?: Config;
  list?: Config;
};

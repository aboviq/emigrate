import type { BasePluginHooks } from './plugins.js';

declare global {
  namespace Emigrate {
    export interface MigrationMetadata {}
    export interface PluginHooks extends BasePluginHooks {}
    export interface AdditionalConfig {}
  }
}

export {};

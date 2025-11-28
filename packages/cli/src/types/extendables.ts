/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-empty-interface */
import type { BasePluginHooks } from './plugins.js';

declare global {
  namespace Emigrate {
    export interface MigrationMetadata {}
    export interface PluginHooks extends BasePluginHooks {}
    export interface AdditionalConfig {}
  }
}

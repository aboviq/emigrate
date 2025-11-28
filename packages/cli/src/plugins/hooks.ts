import type { Logger } from '../types/logging.js';
import type { BasePluginHooks, EmigratePlugin, HookParameters } from '../types/plugins.js';
import { getPluginLogger } from '../logger/index.js';
import type { EmigrateCommand, EmigrateResolvedConfig } from '../types/config.js';

export async function runHook<Hook extends keyof BasePluginHooks>({
  plugin,
  hookName,
  params,
}: {
  plugin: EmigratePlugin;
  hookName: Hook;
  params: () => Omit<HookParameters<NoInfer<Hook>>, 'logger'>;
}): Promise<{ pluginLogger: Logger }> {
  const hook = plugin.hooks[hookName];
  const pluginLogger = getPluginLogger(plugin);

  if (hook) {
    try {
      await hook(Object.assign(params(), { logger: pluginLogger }) as any);
    } catch (error) {
      pluginLogger.error(`Unexpected error in hook "${hookName}"`, { error });
      throw error;
    }
  }

  return { pluginLogger };
}

export type HooksRunner = <Hook extends keyof BasePluginHooks>(
  hookName: Hook,
  params: Omit<HookParameters<NoInfer<Hook>>, 'logger' | 'command' | 'config'>,
) => Promise<void>;

export function getHooksRunner(resolvedConfig: EmigrateResolvedConfig, command: EmigrateCommand): HooksRunner {
  const hooksRunner: HooksRunner = async (hookName, params) => {
    for (const plugin of resolvedConfig.plugins) {
      await runHook({
        plugin,
        hookName,
        params() {
          return Object.assign(params, {
            command,
            config: resolvedConfig,
          } as any);
        },
      });
    }
  };

  return hooksRunner;
}

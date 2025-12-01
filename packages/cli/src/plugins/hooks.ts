import type { Logger } from '../types/logging.js';
import type { BasePluginHooks, EmigratePlugin, HookParameters } from '../types/plugins.js';
import { getPluginLogger } from '../logger/index.js';
import type { EmigrateCommand, EmigrateResolvedConfig } from '../types/config.js';

export async function runHook<Hook extends keyof BasePluginHooks>({
  plugin,
  hookName,
  parameters,
}: {
  plugin: EmigratePlugin;
  hookName: Hook;
  parameters: () => Omit<HookParameters<NoInfer<Hook>>, 'logger'>;
}): Promise<{ pluginLogger: Logger }> {
  const hook = plugin.hooks[hookName];
  const pluginLogger = getPluginLogger(plugin);

  if (hook) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await hook(Object.assign(parameters(), { logger: pluginLogger }) as any);
    } catch (error) {
      pluginLogger.error(`Unexpected error in hook "${hookName}"`, { error });
      throw error;
    }
  }

  return { pluginLogger };
}

export type HooksRunner = <Hook extends keyof BasePluginHooks>(
  hookName: Hook,
  parameters: Omit<HookParameters<NoInfer<Hook>>, 'logger' | 'command' | 'config'>,
) => Promise<void>;

export function getHooksRunner(resolvedConfig: EmigrateResolvedConfig, command: EmigrateCommand): HooksRunner {
  const hooksRunner: HooksRunner = async (hookName, parameters) => {
    for (const plugin of resolvedConfig.plugins) {
      // eslint-disable-next-line no-await-in-loop
      await runHook({
        plugin,
        hookName,
        parameters() {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return Object.assign(parameters, {
            command,
            config: resolvedConfig,
          } as any);
        },
      });
    }
  };

  return hooksRunner;
}

import { getLogger, type LoggerConfig } from '@logtape/logtape';
import type { Logger, LoggingConfig } from '../types/logging.js';
import type { EmigratePlugin } from '../types/plugins.js';
import { stripPrefix } from '../utils/strip-prefix.js';
import { mergeRecursively } from '../utils/merge-recursively.js';
import type { EmigrateStorage } from '../types/storage.js';

export { getLogger, getConfig as getLoggingConfig, configure as configureLogging } from '@logtape/logtape';

const defaultLogger = getLogger('emigrate');

const pluginLoggers = new WeakMap<EmigratePlugin | EmigrateStorage, Logger>();

export const getPluginCategory = (plugin: EmigratePlugin | EmigrateStorage): string => {
  return stripPrefix(plugin.name, ['emigrate-plugin-', '@emigrate/plugin-', '@emigrate/']);
};

export const defineLoggingConfig = <LoggingSink extends string, LoggingFilter extends string>(
  config: LoggingConfig<LoggingSink, LoggingFilter>,
): LoggingConfig<LoggingSink, LoggingFilter> => {
  return config;
};

export const getDefaultLogger = (): Logger => {
  return defaultLogger;
};

export const getPluginLogger = (plugin: EmigratePlugin | EmigrateStorage | undefined): Logger => {
  if (!plugin) {
    return defaultLogger;
  }

  if (pluginLoggers.has(plugin)) {
    return pluginLoggers.get(plugin)!;
  }

  const pluginLogger = defaultLogger.getChild(getPluginCategory(plugin));

  pluginLoggers.set(plugin, pluginLogger);

  return pluginLogger;
};

const isSameCategory = (a: LoggerConfig<string, string>, b: LoggerConfig<string, string>): boolean => {
  if (a.category === b.category) {
    return true;
  }

  if (Array.isArray(a.category) && Array.isArray(b.category) && a.category.length === b.category.length) {
    for (const [index, category] of a.category.entries()) {
      if (b.category[index] !== category) {
        return false;
      }
    }

    return true;
  }

  return false;
};

const skipOverriddenLoggers = <C extends LoggingConfig<string, string>>(
  defaults: C,
  overrides: Partial<C>,
): Partial<C> => {
  if (!overrides.loggers || !defaults.loggers) {
    return defaults;
  }

  const overriddenLoggers = overrides.loggers;

  return {
    ...defaults,
    loggers: defaults.loggers.filter(
      (loggerConfig) => !overriddenLoggers.some((overridden) => isSameCategory(loggerConfig, overridden)),
    ),
  };
};

export const mergeLoggingConfig = <C extends LoggingConfig<string, string>>(defaults: C, overrides: Partial<C>): C => {
  return mergeRecursively(skipOverriddenLoggers(defaults, overrides) as Record<string, unknown>, overrides) as C;
};

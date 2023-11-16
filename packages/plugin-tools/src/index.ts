import process from 'node:process';
import {
  type PluginFromType,
  type PluginType,
  type GeneratorPlugin,
  type StoragePlugin,
  type Plugin,
  type LoaderPlugin,
  type ReporterPlugin,
} from './types.js';

export const isGeneratorPlugin = (plugin: any): plugin is GeneratorPlugin => {
  if (!plugin || typeof plugin !== 'object') {
    return false;
  }

  return typeof plugin.generateMigration === 'function';
};

export const isStoragePlugin = (plugin: any): plugin is StoragePlugin => {
  if (!plugin || typeof plugin !== 'object') {
    return false;
  }

  return typeof plugin.initializeStorage === 'function';
};

export const isLoaderPlugin = (plugin: any): plugin is LoaderPlugin => {
  if (!plugin || typeof plugin !== 'object') {
    return false;
  }

  return typeof plugin.loadMigration === 'function' && Array.isArray(plugin.loadableExtensions);
};

export const isReporterPlugin = (plugin: any): plugin is ReporterPlugin => {
  if (!plugin || typeof plugin !== 'object') {
    return false;
  }

  const reporterFunctions = [
    'onInit',
    'onCollectedMigrations',
    'onLockedMigrations',
    'onMigrationStart',
    'onMigrationSuccess',
    'onMigrationError',
    'onMigrationSkip',
    'onFinished',
  ];

  return reporterFunctions.some((fn) => typeof plugin[fn] === 'function');
};

export const isPluginOfType = <T extends PluginType>(type: T, plugin: any): plugin is PluginFromType<T> => {
  if (type === 'generator') {
    return isGeneratorPlugin(plugin);
  }

  if (type === 'storage') {
    return isStoragePlugin(plugin);
  }

  if (type === 'loader') {
    return isLoaderPlugin(plugin);
  }

  if (type === 'reporter') {
    return isReporterPlugin(plugin);
  }

  throw new Error(`Unknown plugin type: ${type}`);
};

export const getOrLoadPlugin = async <T extends PluginType>(
  type: T,
  plugins: Array<Plugin | string>,
): Promise<PluginFromType<T> | undefined> => {
  const reversePlugins = [...plugins].reverse();

  for await (const plugin of reversePlugins) {
    if (isPluginOfType(type, plugin)) {
      return plugin;
    }

    const loadedPlugin = typeof plugin === 'string' ? await loadPlugin(type, plugin) : undefined;

    if (loadedPlugin) {
      return loadedPlugin;
    }
  }

  return undefined;
};

export const getOrLoadPlugins = async <T extends PluginType>(
  type: T,
  plugins: Array<Plugin | string>,
): Promise<Array<PluginFromType<T>>> => {
  const result: Array<PluginFromType<T>> = [];
  const reversePlugins = [...plugins].reverse();

  for await (const plugin of reversePlugins) {
    if (isPluginOfType(type, plugin)) {
      result.push(plugin);
      continue;
    }

    const loadedPlugin = typeof plugin === 'string' ? await loadPlugin(type, plugin) : undefined;

    if (loadedPlugin) {
      result.push(loadedPlugin);
    }
  }

  return result;
};

export const loadPlugin = async <T extends PluginType>(
  type: T,
  plugin: string,
): Promise<PluginFromType<T> | undefined> => {
  let importFromEsm = await import('import-from-esm');

  // Because of "allowSyntheticDefaultImports" we need to do this ugly hack
  if ((importFromEsm as any).default) {
    importFromEsm = (importFromEsm as any).default as unknown as typeof importFromEsm;
  }

  const importsToTry = plugin.startsWith('.')
    ? [plugin]
    : [plugin, `@emigrate/plugin-${plugin}`, `emigrate-plugin-${plugin}`];

  for await (const importPath of importsToTry) {
    try {
      const pluginModule: unknown = await importFromEsm(process.cwd(), importPath);

      // Support module.exports = ...
      if (isPluginOfType(type, pluginModule)) {
        return pluginModule;
      }

      // Support export default ...
      if (
        pluginModule &&
        typeof pluginModule === 'object' &&
        'default' in pluginModule &&
        isPluginOfType(type, pluginModule.default)
      ) {
        return pluginModule.default;
      }
    } catch {
      // Ignore errors
    }
  }

  return undefined;
};

/**
 * Get a timestamp string in the format YYYYMMDDHHmmssmmm based on the current time (UTC)
 *
 * Can be used to prefix migration filenames so that they are executed in the correct order
 *
 * @returns A timestamp string in the format YYYYMMDDHHmmssmmm
 */
export const getTimestampPrefix = () => new Date().toISOString().replaceAll(/[-:ZT.]/g, '');

/**
 * A utility function to sanitize a migration name so that it can be used as a filename
 *
 * @param name A migration name to sanitize
 * @returns A sanitized migration name that can be used as a filename
 */
export const sanitizeMigrationName = (name: string) =>
  name
    .replaceAll(/[\W/\\:|*?'"<>_]+/g, '_')
    .trim()
    .replace(/^_|_$/, '')
    .toLocaleLowerCase();

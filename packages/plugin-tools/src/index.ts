import process from 'node:process';
import {
  type PluginFromType,
  type PluginType,
  type GeneratorPlugin,
  type EmigrateReporter,
  type EmigrateStorage,
  type LoaderPlugin,
  type StringOrModule,
} from './types.js';

export const isGeneratorPlugin = (plugin: any): plugin is GeneratorPlugin => {
  if (!plugin || typeof plugin !== 'object') {
    return false;
  }

  return typeof plugin.generateMigration === 'function';
};

export const isEmigrateStorage = (plugin: any): plugin is EmigrateStorage => {
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

export const isEmigrateReporter = (plugin: any): plugin is EmigrateReporter => {
  if (!plugin || typeof plugin !== 'object') {
    return false;
  }

  const reporterFunctions = [
    'onInit',
    'onCollectedMigrations',
    'onLockedMigrations',
    'onNewMigration',
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

  if (type === 'loader') {
    return isLoaderPlugin(plugin);
  }

  throw new Error(`Unknown plugin type: ${type}`);
};

export const getOrLoadStorage = async (
  potentialStorages: Array<StringOrModule<unknown>>,
): Promise<EmigrateStorage | undefined> => {
  return getOrLoad(potentialStorages, isEmigrateStorage);
};

export const getOrLoadReporter = async (
  potentialReporters: Array<StringOrModule<unknown>>,
): Promise<EmigrateReporter | undefined> => {
  return getOrLoad(potentialReporters, isEmigrateReporter);
};

export const getOrLoadPlugin = async <T extends PluginType>(
  type: T,
  plugins: Array<StringOrModule<unknown>>,
): Promise<PluginFromType<T> | undefined> => {
  return getOrLoad(plugins, (value: unknown): value is PluginFromType<T> => isPluginOfType(type, value));
};

export const getOrLoadPlugins = async <T extends PluginType>(
  type: T,
  plugins: Array<StringOrModule<unknown>>,
): Promise<Array<PluginFromType<T>>> => {
  const result: Array<PluginFromType<T>> = [];
  const reversePlugins = [...plugins].reverse();

  for await (let plugin of reversePlugins) {
    if (typeof plugin === 'function') {
      plugin = await plugin();
    }

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

const getOrLoad = async <T>(potentials: Array<StringOrModule<unknown>>, check: (value: unknown) => value is T) => {
  const reversed = [...potentials].reverse();

  for await (let potential of reversed) {
    if (typeof potential === 'function') {
      potential = await potential();
    }

    if (check(potential)) {
      return potential;
    }

    // Support export default ...
    if (potential && typeof potential === 'object' && 'default' in potential && check(potential.default)) {
      return potential.default;
    }
  }

  return undefined;
};

const getImportFromEsm = async () => {
  let importFromEsm = await import('import-from-esm');

  // Because of "allowSyntheticDefaultImports" we need to do this ugly hack
  if ((importFromEsm as any).default) {
    importFromEsm = (importFromEsm as any).default as unknown as typeof importFromEsm;
  }

  return importFromEsm;
};

export const loadStorage = async (name: string): Promise<EmigrateStorage | undefined> => {
  return load(name, ['@emigrate/storage-', 'emigrate-storage-', '@emigrate/plugin-storage-'], isEmigrateStorage);
};

export const loadReporter = async (name: string): Promise<EmigrateReporter | undefined> => {
  return load(name, ['@emigrate/reporter-', 'emigrate-reporter-'], isEmigrateReporter);
};

export const loadPlugin = async <T extends PluginType>(
  type: T,
  plugin: string,
): Promise<PluginFromType<T> | undefined> => {
  return load(plugin, ['@emigrate/plugin-', 'emigrate-plugin-'], (value: unknown): value is PluginFromType<T> => {
    return isPluginOfType(type, value);
  });
};

const load = async <T>(
  name: string,
  prefixes: string[],
  check: (value: unknown) => value is T,
): Promise<T | undefined> => {
  const importFromEsm = await getImportFromEsm();

  const importsToTry = name.startsWith('.') ? [name] : [name, ...prefixes.map((prefix) => `${prefix}${name}`)];

  for await (const importPath of importsToTry) {
    try {
      const module: unknown = await importFromEsm(process.cwd(), importPath);

      // Support module.exports = ...
      if (check(module)) {
        return module;
      }

      // Support export default ...
      if (module && typeof module === 'object' && 'default' in module && check(module.default)) {
        return module.default;
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

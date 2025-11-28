import type { EmigratePlugin } from '../types/plugins.js';
import type { StringOrModule } from '../types/utils.js';

const isEmigratePlugin = (plugin: unknown): plugin is EmigratePlugin => {
  return Boolean(plugin && typeof plugin === 'object' && 'name' in plugin && typeof plugin.name === 'string');
};

const getEmigratePlugin = (plugin: unknown): EmigratePlugin | undefined => {
  // Support export default ...
  if (plugin && typeof plugin === 'object' && 'default' in plugin && isEmigratePlugin(plugin.default)) {
    return plugin.default;
  }

  if (isEmigratePlugin(plugin)) {
    return plugin;
  }

  return undefined;
};

const loadPluginByName = async (name: string, prefixes: string[], cwd: string): Promise<EmigratePlugin | undefined> => {
  const { default: importFromEsm } = await import('import-from-esm');

  const importsToTry = name.startsWith('.') ? [name] : [...prefixes.map((prefix) => `${prefix}${name}`), name];

  for await (const importPath of importsToTry) {
    try {
      const plugin = getEmigratePlugin(await importFromEsm(cwd, importPath));

      if (plugin) {
        return plugin;
      }
    } catch {
      // Ignore errors
    }
  }

  // TODO: throw a descriptive error here that the plugin could not be found?

  return undefined;
};

export const getOrLoadPlugin = async (
  plugin: StringOrModule<EmigratePlugin | false | null | undefined>,
  cwd: string = process.cwd(),
): Promise<EmigratePlugin | undefined> => {
  if (typeof plugin === 'function') {
    const awaitedPlugin = getEmigratePlugin(await plugin());

    if (awaitedPlugin) {
      return awaitedPlugin;
    }
  }

  if (typeof plugin === 'string') {
    return loadPluginByName(plugin, ['@emigrate/plugin-', 'emigrate-plugin-', '@emigrate/'], cwd);
  }

  return getEmigratePlugin(plugin);
};

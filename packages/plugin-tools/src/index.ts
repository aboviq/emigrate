import { type GeneratorPlugin, type StoragePlugin } from './types.js';

export const createStoragePlugin = (initialize: StoragePlugin['initialize']): StoragePlugin => {
  return {
    type: 'storage',
    initialize,
  };
};

export const createGeneratorPlugin = (generate: GeneratorPlugin['generate']): GeneratorPlugin => {
  return {
    type: 'generator',
    generate,
  };
};

export const isGeneratorPlugin = (plugin: any): plugin is GeneratorPlugin => {
  if (!plugin || typeof plugin !== 'object') {
    return false;
  }

  if (plugin.type === 'generator') {
    return typeof plugin.generate === 'function';
  }

  return false;
};

export const isStoragePlugin = (plugin: any): plugin is StoragePlugin => {
  if (!plugin || typeof plugin !== 'object') {
    return false;
  }

  if (plugin.type === 'storage') {
    return typeof plugin.initialize === 'function';
  }

  return false;
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
export const sanitizeMigrationName = (name: string) => name.replaceAll(/[\W/\\:|*?'"<>]/g, '_').trim();

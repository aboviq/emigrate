import process from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getTimestampPrefix, sanitizeMigrationName, isGeneratorPlugin } from '@emigrate/plugin-tools';
import { type GeneratorPlugin } from '@emigrate/plugin-tools/types';
import { ShowUsageError } from './show-usage-error.js';

type NewCommandOptions = {
  directory?: string;
  template?: string;
  plugins: string[];
  name?: string;
};

export default async function newCommand({ directory, template, plugins, name }: NewCommandOptions) {
  if (!directory) {
    throw new ShowUsageError('Missing required option: directory');
  }

  if (!name) {
    throw new ShowUsageError('Missing required migration name');
  }

  if (!template && plugins.length === 0) {
    throw new ShowUsageError('Missing required option: template or plugin');
  }

  let filename: string | undefined;
  let content: string | undefined;

  if (template) {
    const fs = await import('node:fs/promises');
    const templatePath = path.resolve(process.cwd(), template);
    const extension = path.extname(templatePath);

    try {
      content = await fs.readFile(templatePath, 'utf8');
      content = content.replaceAll('{{name}}', name);
    } catch (error) {
      throw new Error(`Failed to read template file: ${templatePath}`, { cause: error });
    }

    filename = `${getTimestampPrefix()}_${sanitizeMigrationName(name)}${extension}`;
  } else if (plugins.length > 0) {
    let generatorPlugin: GeneratorPlugin | undefined;

    for await (const plugin of plugins) {
      const pluginPath = plugin.startsWith('.') ? path.resolve(process.cwd(), plugin) : plugin;

      try {
        const pluginModule: unknown = await import(pluginPath);

        if (isGeneratorPlugin(pluginModule)) {
          generatorPlugin = pluginModule;
          break;
        }

        if (
          pluginModule &&
          typeof pluginModule === 'object' &&
          'default' in pluginModule &&
          isGeneratorPlugin(pluginModule.default)
        ) {
          generatorPlugin = pluginModule.default;
          break;
        }
      } catch (error) {
        throw new Error(`Failed to load plugin: ${plugin}`, { cause: error });
      }
    }

    if (!generatorPlugin) {
      throw new Error('No generator plugin found, please specify a generator plugin using the plugin option');
    }

    const generated = await generatorPlugin.generate(name);

    filename = generated.filename;
    content = generated.content;
  }

  if (!filename || !content) {
    throw new Error('Unexpected error, missing filename or content for migration file');
  }

  const directoryPath = path.resolve(process.cwd(), directory);
  const filePath = path.resolve(directoryPath, filename);

  await createDirectory(directoryPath);
  await saveFile(filePath, content);
}

async function createDirectory(directoryPath: string) {
  try {
    await fs.mkdir(directoryPath, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create migration directory: ${directoryPath}`, { cause: error });
  }
}

async function saveFile(filePath: string, content: string) {
  try {
    await fs.writeFile(filePath, content);

    console.log(`Created migration file: ${path.relative(process.cwd(), filePath)}`);
  } catch (error) {
    throw new Error(`Failed to write migration file: ${filePath}`, { cause: error });
  }
}

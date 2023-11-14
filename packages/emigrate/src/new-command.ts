import process from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getTimestampPrefix, sanitizeMigrationName, loadPlugin, isGeneratorPlugin } from '@emigrate/plugin-tools';
import { type Plugin, type GeneratorPlugin } from '@emigrate/plugin-tools/types';
import { ShowUsageError } from './show-usage-error.js';

type NewCommandOptions = {
  directory?: string;
  template?: string;
  extension?: string;
  plugins: Array<string | Plugin>;
  name?: string;
};

export default async function newCommand({ directory, template, plugins, name, extension }: NewCommandOptions) {
  if (!directory) {
    throw new ShowUsageError('Missing required option: directory');
  }

  if (!name) {
    throw new ShowUsageError('Missing required migration name');
  }

  if (!extension && !template && plugins.length === 0) {
    throw new ShowUsageError('Missing required option: extension, template or plugin');
  }

  let filename: string | undefined;
  let content: string | undefined;

  if (template) {
    const fs = await import('node:fs/promises');
    const templatePath = path.resolve(process.cwd(), template);
    const fileExtension = path.extname(templatePath);

    try {
      content = await fs.readFile(templatePath, 'utf8');
      content = content.replaceAll('{{name}}', name);
    } catch (error) {
      throw new Error(`Failed to read template file: ${templatePath}`, { cause: error });
    }

    filename = `${getTimestampPrefix()}_${sanitizeMigrationName(name)}${extension ?? fileExtension}`;
  } else if (plugins.length > 0) {
    let generatorPlugin: GeneratorPlugin | undefined;

    for await (const plugin of plugins) {
      if (isGeneratorPlugin(plugin)) {
        generatorPlugin = plugin;
        break;
      }

      generatorPlugin = typeof plugin === 'string' ? await loadPlugin('generator', plugin) : undefined;

      if (generatorPlugin) {
        break;
      }
    }

    if (!generatorPlugin) {
      throw new Error('No generator plugin found, please specify a generator plugin using the plugin option');
    }

    const generated = await generatorPlugin.generate(name);

    filename = generated.filename;
    content = generated.content;
  } else if (extension) {
    content = '';
    filename = `${getTimestampPrefix()}_${sanitizeMigrationName(name)}${extension}`;
  }

  if (!filename || content === undefined) {
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

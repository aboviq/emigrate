import process from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getTimestampPrefix, sanitizeMigrationName, getOrLoadPlugin, getOrLoadReporter } from '@emigrate/plugin-tools';
import { type MigrationMetadata } from '@emigrate/plugin-tools/types';
import { BadOptionError, MissingArgumentsError, MissingOptionError, UnexpectedError } from './errors.js';
import { type Config } from './types.js';
import { withLeadingPeriod } from './with-leading-period.js';

const lazyDefaultReporter = async () => import('./plugin-reporter-default.js');

export default async function newCommand(
  { directory, template, reporter: reporterConfig, plugins = [], extension }: Config,
  name: string,
) {
  if (!directory) {
    throw new MissingOptionError('directory');
  }

  if (!name) {
    throw new MissingArgumentsError('name');
  }

  if (!extension && !template && plugins.length === 0) {
    throw new MissingOptionError(['extension', 'template', 'plugin']);
  }

  const cwd = process.cwd();

  const reporter = await getOrLoadReporter([reporterConfig ?? lazyDefaultReporter]);

  if (!reporter) {
    throw new BadOptionError(
      'reporter',
      'No reporter found, please specify an existing reporter using the reporter option',
    );
  }

  await reporter.onInit?.({ command: 'new', cwd, dry: false, directory });

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
      await reporter.onFinished?.(
        [],
        new UnexpectedError(`Failed to read template file: ${templatePath}`, { cause: error }),
      );
      return;
    }

    filename = `${getTimestampPrefix()}_${sanitizeMigrationName(name)}${withLeadingPeriod(extension ?? fileExtension)}`;
  }

  let hasGeneratedFile = Boolean(filename && content !== undefined);

  if (plugins.length > 0 && !hasGeneratedFile) {
    const generatorPlugin = await getOrLoadPlugin('generator', plugins);

    if (generatorPlugin) {
      const generated = await generatorPlugin.generateMigration(name);

      filename = generated.filename;
      content = generated.content;
    }
  }

  hasGeneratedFile = Boolean(filename && content !== undefined);

  if (extension && !hasGeneratedFile) {
    content = '';
    filename = `${getTimestampPrefix()}_${sanitizeMigrationName(name)}${withLeadingPeriod(extension)}`;
  }

  if (!filename || content === undefined) {
    throw new BadOptionError(
      'plugin',
      'No generator plugin found, please specify a generator plugin using the plugin option',
    );
  }

  const directoryPath = path.resolve(process.cwd(), directory);
  const filePath = path.resolve(directoryPath, filename);

  const migration: MigrationMetadata = {
    name: filename,
    filePath,
    relativeFilePath: path.relative(cwd, filePath),
    extension: withLeadingPeriod(path.extname(filename)),
    directory,
    cwd,
  };

  await reporter.onNewMigration?.(migration, content);

  let saveError: Error | undefined;

  try {
    await createDirectory(directoryPath);
    await saveFile(filePath, content);
  } catch (error) {
    saveError = error instanceof Error ? error : new Error(String(error));
  }

  await reporter.onFinished?.(
    [{ ...migration, status: saveError ? 'failed' : 'done', error: saveError, duration: 0 }],
    saveError,
  );
}

async function createDirectory(directoryPath: string) {
  try {
    await fs.mkdir(directoryPath, { recursive: true });
  } catch (error) {
    throw new UnexpectedError(`Failed to create migration directory: ${directoryPath}`, { cause: error });
  }
}

async function saveFile(filePath: string, content: string) {
  try {
    await fs.writeFile(filePath, content);
  } catch (error) {
    throw new UnexpectedError(`Failed to write migration file: ${filePath}`, { cause: error });
  }
}

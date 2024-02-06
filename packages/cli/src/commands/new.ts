import { hrtime } from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getTimestampPrefix, sanitizeMigrationName, getOrLoadPlugin, getOrLoadReporter } from '@emigrate/plugin-tools';
import { type MigrationMetadataFinished, type MigrationMetadata, isFailedMigration } from '@emigrate/types';
import {
  BadOptionError,
  EmigrateError,
  MissingArgumentsError,
  MissingOptionError,
  UnexpectedError,
  toError,
} from '../errors.js';
import { type Config } from '../types.js';
import { withLeadingPeriod } from '../with-leading-period.js';
import { version } from '../get-package-info.js';
import { getDuration } from '../get-duration.js';
import { getStandardReporter } from '../reporters/get.js';

type ExtraFlags = {
  cwd: string;
};

export default async function newCommand(
  { directory, template, reporter: reporterConfig, plugins = [], cwd, extension, color }: Config & ExtraFlags,
  name: string,
) {
  if (!directory) {
    throw MissingOptionError.fromOption('directory');
  }

  if (!name) {
    throw MissingArgumentsError.fromArgument('name');
  }

  if (!extension && !template && plugins.length === 0) {
    throw MissingOptionError.fromOption(['extension', 'template', 'plugin']);
  }

  const reporter = getStandardReporter(reporterConfig) ?? (await getOrLoadReporter([reporterConfig]));

  if (!reporter) {
    throw BadOptionError.fromOption(
      'reporter',
      'No reporter found, please specify an existing reporter using the reporter option',
    );
  }

  await reporter.onInit?.({ command: 'new', version, cwd, dry: false, directory, color });

  const start = hrtime();

  let filename: string | undefined;
  let content: string | undefined;

  if (template) {
    const fs = await import('node:fs/promises');
    const templatePath = path.resolve(cwd, template);
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
    throw BadOptionError.fromOption(
      'plugin',
      'No generator plugin found, please specify a generator plugin using the plugin option',
    );
  }

  const directoryPath = path.resolve(cwd, directory);
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

  const finishedMigrations: MigrationMetadataFinished[] = [];

  try {
    await createDirectory(directoryPath);
    await saveFile(filePath, content);
    const duration = getDuration(start);
    finishedMigrations.push({ ...migration, status: 'done', duration });
  } catch (error) {
    const duration = getDuration(start);
    const errorInstance = toError(error);
    finishedMigrations.push({ ...migration, status: 'failed', duration, error: errorInstance });
  }

  // eslint-disable-next-line unicorn/no-array-callback-reference
  const firstFailed = finishedMigrations.find(isFailedMigration);
  const firstError =
    firstFailed?.error instanceof EmigrateError
      ? firstFailed.error
      : firstFailed
        ? new UnexpectedError(`Failed to create migration file: ${firstFailed.relativeFilePath}`, {
            cause: firstFailed?.error,
          })
        : undefined;

  await reporter.onFinished?.(finishedMigrations, firstError);
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

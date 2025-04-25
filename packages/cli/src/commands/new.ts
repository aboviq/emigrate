import { hrtime } from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getOrLoadPlugins } from '@emigrate/plugin-tools';
import { type MigrationMetadataFinished, type MigrationMetadata, isFailedMigration } from '@emigrate/types';
import {
  BadOptionError,
  EmigrateError,
  MissingArgumentsError,
  MissingOptionError,
  UnexpectedError,
  toError,
} from '../errors.js';
import { type NewCommandConfig } from '../types.js';
import { withLeadingPeriod } from '../with-leading-period.js';
import { version } from '../get-package-info.js';
import { getDuration } from '../get-duration.js';
import { newCommandReporter, type NewCommandReporter } from '../reporters/new-command.js';
import { DEFAULT_TEMPLATE_PLUGIN } from '../defaults.js';
import { getMigrations as getMigrationsOriginal, type GetMigrationsFunction } from '../get-migrations.js';
import { getPrefixGenerator } from '../prefixes.js';
import { sanitizeName } from '../sanitize-name.js';

type ExtraFlags = {
  cwd: string;
  getMigrations?: GetMigrationsFunction;
  reporter?: NewCommandReporter;
};

export default async function newCommand(
  {
    directory,
    template,
    reporter = newCommandReporter,
    plugins = [],
    cwd,
    extension,
    color,
    prefix = 'timestamp',
    joiner = '_',
    getMigrations = getMigrationsOriginal,
  }: NewCommandConfig & ExtraFlags,
  name: string,
): Promise<void> {
  if (!directory) {
    throw MissingOptionError.fromOption('directory');
  }

  if (!name) {
    throw MissingArgumentsError.fromArgument('name');
  }

  reporter.onInit({ command: 'new', version, cwd, dry: false, directory, color });

  const start = hrtime();

  let content: string | undefined;

  if (template) {
    const templatePath = path.resolve(cwd, template);
    const fileExtension = path.extname(templatePath);

    try {
      content = await fs.readFile(templatePath, 'utf8');
      extension ??= fileExtension || undefined;
    } catch (error) {
      reporter.onFinished([], new UnexpectedError(`Failed to read template file: ${templatePath}`, { cause: error }));
      return;
    }
  }

  extension ??= '.js';
  extension = withLeadingPeriod(extension);

  content ??= await getContentFromTemplates(plugins, extension, name);
  content ??= '';
  content = content.replaceAll('{{name}}', name);

  const migrations = await getMigrations(cwd, directory);

  const prefixGenerator = getPrefixGenerator(prefix);
  const namePrefix = prefixGenerator(name, migrations.at(-1));

  if (typeof namePrefix !== 'string') {
    throw BadOptionError.fromOption('prefix', 'Prefix generator must return a string');
  }

  const nameSuffix = `${sanitizeName(name, joiner)}${withLeadingPeriod(extension)}`;
  const filename = namePrefix ? `${namePrefix}${joiner}${nameSuffix}` : nameSuffix;
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

  reporter.onNewMigration(migration, content);

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

  reporter.onFinished(finishedMigrations, firstError);
}

async function getContentFromTemplates(
  plugins: Exclude<NewCommandConfig['plugins'], undefined>,
  extension: string,
  name: string,
) {
  const templatePlugins = await getOrLoadPlugins('template', plugins);

  for (const templatePlugin of [...templatePlugins, DEFAULT_TEMPLATE_PLUGIN]) {
    for (const template of templatePlugin.templates) {
      if (withLeadingPeriod(template.extension) === extension) {
        return typeof template.template === 'function' ? template.template(name) : template.template;
      }
    }
  }

  return undefined;
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

import { hrtime } from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getOrLoadPluginsWithNames } from '@emigrate/plugin-tools';
import {
  type MigrationMetadataFinished,
  type MigrationMetadata,
  type Template,
  type TemplatePlugin,
} from '@emigrate/types';
import confirm from '@inquirer/confirm';
import input from '@inquirer/input';
import select, { Separator } from '@inquirer/select';
import isInteractive from 'is-interactive';
import {
  BadOptionError,
  CommandAbortError,
  EmigrateError,
  MissingOptionError,
  OptionNeededError,
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
import { indent } from '../indent.js';

type ExtraFlags = {
  cwd: string;
  getMigrations?: GetMigrationsFunction;
  reporter?: NewCommandReporter;
  yes?: boolean;
  abortSignal?: AbortSignal;
};

export default async function newCommand(
  {
    directory,
    template,
    reporter = newCommandReporter,
    plugins = [],
    cwd,
    extension,
    prefix = 'timestamp',
    joiner = '_',
    getMigrations = getMigrationsOriginal,
    yes,
    abortSignal,
  }: NewCommandConfig & ExtraFlags,
  name?: string,
): Promise<number> {
  let finishedMigration: MigrationMetadataFinished | undefined;

  reporter.onInit({ version, cwd });

  let content: string | undefined;

  // Treat empty string as undefined
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  name = name?.trim() || undefined;

  try {
    directory ||= await getDirectory(abortSignal);
    name ||= await getName(abortSignal);

    const templatePlugins = await getTemplatePlugins(plugins);

    extension ??= getTemplateFileExtension(template) ?? (await getExtension(templatePlugins, abortSignal));

    if (!extension || extension === '.') {
      throw BadOptionError.fromOption('extension', 'Extension must be a valid file extension');
    }

    extension = withLeadingPeriod(extension);
    content ??=
      (await getTemplateFileContent(cwd, name, template)) ??
      (await getContentFromTemplates(templatePlugins, extension, name, abortSignal)) ??
      '';

    const migrations = await getMigrations(cwd, directory);

    const prefixGenerator = getPrefixGenerator(prefix);
    const namePrefix = prefixGenerator(name, migrations.at(-1));

    if (typeof namePrefix !== 'string') {
      throw BadOptionError.fromOption('prefix', 'Prefix generator must return a string');
    }

    const nameSuffix = `${sanitizeName(name, joiner)}${withLeadingPeriod(extension)}`;
    const filename = namePrefix ? `${namePrefix}${joiner}${nameSuffix}` : nameSuffix;
    const filePath = path.resolve(cwd, directory, filename);

    const migration: MigrationMetadata = {
      name: filename,
      filePath,
      relativeFilePath: path.relative(cwd, filePath),
      extension: withLeadingPeriod(path.extname(filename)),
      directory,
      cwd,
    };

    reporter.onNewMigration(migration, content);

    if (!yes) {
      try {
        await getConfirmation(abortSignal);
      } catch (error) {
        finishedMigration = { ...migration, status: 'skipped' };
        reporter.onMigrationSkip(finishedMigration);
        throw error;
      }
    }

    const start = hrtime();

    try {
      await saveFile(filePath, content);
      const duration = getDuration(start);
      finishedMigration = { ...migration, status: 'done', duration };
      reporter.onMigrationSuccess(finishedMigration);
    } catch (error) {
      const duration = getDuration(start);
      const errorInstance = toError(error);
      finishedMigration = { ...migration, status: 'failed', duration, error: errorInstance };
      reporter.onMigrationError(finishedMigration, errorInstance);

      throw errorInstance;
    }

    reporter.onFinished([finishedMigration]);

    return 0;
  } catch (error) {
    const migrations = finishedMigration ? [finishedMigration] : [];

    if (error instanceof CommandAbortError) {
      reporter.onFinished(migrations);
      reporter.onAbort(error);
      return 1;
    }

    const finishedError =
      error instanceof EmigrateError
        ? error
        : new UnexpectedError('Failed to create migration', {
            cause: error,
          });

    reporter.onFinished(migrations, finishedError);
    return 1;
  }
}

async function getTemplateFileContent(cwd: string, migrationName: string, template?: string) {
  if (!template) {
    return;
  }

  const templatePath = path.resolve(cwd, template);

  try {
    const templateContent = await fs.readFile(templatePath, 'utf8');

    return await renderTemplate(templateContent, migrationName);
  } catch (error) {
    throw new UnexpectedError(`Failed to read template file: ${templatePath}`, { cause: error });
  }
}

function getTemplateFileExtension(template?: string) {
  if (!template) {
    return;
  }

  return path.extname(template) || undefined;
}

async function getName(abortSignal?: AbortSignal) {
  try {
    return await input(
      {
        message: 'Give your migration a name:',
        required: true,
      },
      { signal: abortSignal },
    );
  } catch (error) {
    handlePromptError(error, 'Failed to read migration name', abortSignal);
  }
}

async function getExtension(plugins: Array<{ name: string; plugin: TemplatePlugin }>, abortSignal?: AbortSignal) {
  const possibleExtensions = [
    ...new Set(
      plugins.flatMap(({ plugin }) => plugin.templates.map((template) => withLeadingPeriod(template.extension))),
    ),
  ];
  const defaultExtension = '.js';

  if (!isInteractive()) {
    return possibleExtensions[0] ?? defaultExtension;
  }

  try {
    const extension = await select<string>(
      {
        message: 'Select a file extension:',
        choices: [
          ...possibleExtensions.map((ext) => ({ name: ext, value: ext })),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Don't know why this error occurs
          new Separator(),
          { name: 'Other', value: 'other' },
        ],
        loop: false,
      },
      { signal: abortSignal },
    );

    if (extension !== 'other') {
      return extension;
    }

    return await input(
      {
        message: 'What file extension do you want:',
        default: defaultExtension,
        validate(value) {
          const trimmed = value.trim();

          if (trimmed.length === 0 || trimmed === '.') {
            return 'Extension must not be empty';
          }

          if (/\s/.test(trimmed)) {
            return 'Extension must not contain whitespace';
          }

          return true;
        },
      },
      { signal: abortSignal },
    );
  } catch (error) {
    handlePromptError(error, 'Failed to read migration extension', abortSignal);
  }
}

async function getConfirmation(abortSignal?: AbortSignal) {
  if (!isInteractive()) {
    throw OptionNeededError.fromOption('yes', 'Confirmation is required in non-interactive mode');
  }

  try {
    const confirmed = await confirm(
      {
        message: 'Do you want to proceed?',
      },
      { signal: abortSignal },
    );

    if (!confirmed) {
      throw CommandAbortError.fromReason('aborted by user');
    }
  } catch (error) {
    handlePromptError(error, 'Failed to read confirmation', abortSignal);
  }
}

async function getDirectory(abortSignal?: AbortSignal) {
  if (!isInteractive()) {
    throw MissingOptionError.fromOption('directory');
  }

  try {
    return await input(
      {
        message: 'In which directory do you want to create the migration?',
        required: true,
        default: 'migrations',
      },
      { signal: abortSignal },
    );
  } catch (error) {
    handlePromptError(error, 'Failed to read directory name', abortSignal);
  }
}

async function getTemplatePlugins(plugins: Exclude<NewCommandConfig['plugins'], undefined>) {
  const templatePlugins = await getOrLoadPluginsWithNames('template', plugins);

  return [...templatePlugins, { name: 'Built-In', plugin: DEFAULT_TEMPLATE_PLUGIN }];
}

const renderTemplate = async (template: Template['template'], name: string) => {
  const content = typeof template === 'function' ? await template(name) : template;

  return content.replaceAll('{{name}}', name);
};

async function getContentFromTemplates(
  plugins: Array<{ name: string; plugin: TemplatePlugin }>,
  extension: string,
  migrationName: string,
  abortSignal?: AbortSignal,
) {
  const matchingTemplates: Array<{ name: string; template: Template }> = [];
  const canPrompt = isInteractive();

  for (const templatePlugin of plugins) {
    for (const template of templatePlugin.plugin.templates) {
      if (withLeadingPeriod(template.extension) === extension) {
        matchingTemplates.push({ name: templatePlugin.name, template });
      }
    }
  }

  if (matchingTemplates.length === 0) {
    return;
  }

  try {
    if ((matchingTemplates.length === 1 || !canPrompt) && matchingTemplates[0]) {
      return await renderTemplate(matchingTemplates[0].template.template, migrationName);
    }

    return await select<string>(
      {
        message: 'Select a template:',
        choices: await Promise.all(
          matchingTemplates.map(async ({ name, template }) => {
            const content = await renderTemplate(template.template, migrationName);
            return {
              name: template.description ? `${name}: ${template.description}` : name,
              value: content,
              description: `\n${indent(content)}`,
            };
          }),
        ),
      },
      { signal: abortSignal },
    );
  } catch (error) {
    handlePromptError(error, 'Failed to select template', abortSignal);
  }
}

async function createDirectory(directoryPath: string) {
  try {
    await fs.mkdir(directoryPath, { recursive: true });
  } catch (error) {
    throw new UnexpectedError(`Failed to create migration directory: ${directoryPath}`, { cause: error });
  }
}

async function saveFile(filePath: string, content: string) {
  await createDirectory(path.dirname(filePath));

  try {
    await fs.writeFile(filePath, content);
  } catch (error) {
    throw new UnexpectedError(`Failed to write migration file: ${filePath}`, { cause: error });
  }
}

function handlePromptError(error: unknown, unexpectedErrorMessage: string, abortSignal?: AbortSignal): never {
  if (abortSignal?.aborted) {
    throw toError(abortSignal.reason);
  } else if (error instanceof Error && error.name === 'ExitPromptError') {
    throw CommandAbortError.fromReason('aborted by user');
  } else if (error instanceof EmigrateError) {
    throw error;
  }

  throw new UnexpectedError(unexpectedErrorMessage, { cause: error });
}

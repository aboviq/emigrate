import elegantSpinner from 'elegant-spinner';
import figures from 'figures';
import isInteractive from 'is-interactive';
import prettyMs from 'pretty-ms';
import { type MigrationMetadata, type MigrationMetadataFinished, type ReporterInitParameters } from '@emigrate/types';
import { style } from '../style.js';

const { black, blueBright, bgBlueBright, bold, cyan, dim, gray, green, red, redBright, yellow, yellowBright } = style;

type Status = ReturnType<typeof getMigrationStatus>;
type Command = ReporterInitParameters['command'];

const interactive = isInteractive();
const spinner = interactive ? elegantSpinner() : () => figures.pointerSmall;

const formatDuration = (duration: number): string => {
  const pretty = prettyMs(duration);

  return yellow(pretty.replaceAll(/([^\s\d.]+)/g, dim('$1')));
};

export const getTitle = ({ command, version, dry, cwd }: ReporterInitParameters) => {
  return `${black(bgBlueBright(` Emigrate `)).trim()} ${blueBright(bold(command))} ${blueBright(`v${version}`)} ${gray(
    cwd,
  )}${dry ? yellow(` (dry run)`) : ''}`;
};

const getMigrationStatus = (
  command: Command,
  migration: MigrationMetadata | MigrationMetadataFinished,
  activeMigration?: MigrationMetadata,
) => {
  if ('status' in migration) {
    return command === 'remove' && migration.status === 'done' ? 'removed' : migration.status;
  }

  if (command === 'remove' && migration.name === activeMigration?.name) {
    return 'removing';
  }

  if (command === 'new') {
    return '';
  }

  return migration.name === activeMigration?.name ? 'running' : 'pending';
};

const getIcon = (status: Status) => {
  switch (status) {
    case 'removing': {
      return cyan(spinner());
    }

    case 'running': {
      return cyan(spinner());
    }

    case 'pending': {
      return gray(figures.pointerSmall);
    }

    case 'removed': {
      return green(figures.tick);
    }

    case 'done': {
      return green(figures.tick);
    }

    case 'failed': {
      return red(figures.cross);
    }

    case 'skipped': {
      return yellow(figures.circle);
    }

    default: {
      return ' ';
    }
  }
};

const getName = (name: string, status?: Status) => {
  switch (status) {
    case 'failed': {
      return red(name);
    }

    case 'skipped': {
      return yellow(name);
    }

    case 'pending': {
      return dim(name);
    }

    default: {
      return name;
    }
  }
};

export const getMigrationText = (
  command: Command,
  migration: MigrationMetadata | MigrationMetadataFinished,
  activeMigration?: MigrationMetadata,
): string => {
  const pathWithoutName = migration.relativeFilePath.slice(0, -migration.name.length);
  const nameWithoutExtension = migration.name.slice(0, -migration.extension.length);
  const status = getMigrationStatus(command, migration, activeMigration);
  const parts = [' ', getIcon(status)];

  parts.push(`${dim(pathWithoutName)}${getName(nameWithoutExtension, status)}${dim(migration.extension)}`);

  if ('status' in migration || migration.name === activeMigration?.name) {
    parts.push(gray(`(${status})`));
  }

  if ('duration' in migration && migration.duration) {
    parts.push(formatDuration(migration.duration));
  }

  return parts.join(' ');
};

type ErrorLike = {
  name?: string;
  message: string;
  stack?: string;
  cause?: unknown;
};

const isErrorLike = (error: unknown): error is ErrorLike => {
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string';
};

export const getError = (error?: ErrorLike, indent = '  '): string => {
  if (!error) {
    return '';
  }

  let stack: string[] = [];

  if (error.stack) {
    const stackParts = error.stack.split('\n');
    const messageParts = (error.message ?? '').split('\n');

    stack = stackParts.slice(messageParts.length);
  }

  const properties = Object.getOwnPropertyNames(error).filter(
    (property) => !['name', 'message', 'stack', 'cause'].includes(property),
  );
  const others: Record<string, unknown> = {};

  for (const property of properties) {
    others[property] = error[property as keyof ErrorLike];
  }

  const codeString =
    typeof others['code'] === 'string' || typeof others['code'] === 'number' ? others['code'] : undefined;
  const code = codeString ? ` [${codeString}]` : '';

  const errorTitle = error.name ? `${error.name}${code}: ${error.message}` : error.message;
  const parts = [`${indent}${bold(red(errorTitle))}`, ...stack.map((line) => `${indent}  ${dim(line.trim())}`)];

  if (properties.length > 0) {
    parts.push(`${indent}  ${JSON.stringify(others, undefined, 2).split('\n').join(`\n${indent}  `)}`);
  }

  if (isErrorLike(error.cause)) {
    const nextIndent = `${indent}  `;
    parts.push(`\n${nextIndent}${bold('Original error cause:')}\n`, getError(error.cause, nextIndent));
  }

  return parts.join('\n');
};

export const getAbortMessage = (reason?: Error): string => {
  if (!reason) {
    return '';
  }

  const parts = [`  ${bold(red(reason.message))}`];

  if (isErrorLike(reason.cause)) {
    parts.push(getError(reason.cause, '    '));
  }

  return parts.join('\n');
};

export const getSummary = (
  command: ReporterInitParameters['command'],
  migrations: Array<MigrationMetadata | MigrationMetadataFinished> = [],
): string => {
  const total = migrations.length;
  let done = 0;
  let failed = 0;
  let skipped = 0;
  let pending = 0;

  for (const migration of migrations) {
    const status = 'status' in migration ? migration.status : undefined;
    switch (status) {
      case 'done': {
        done++;
        break;
      }

      case 'failed': {
        failed++;
        break;
      }

      case 'skipped': {
        skipped++;
        break;
      }

      case 'pending': {
        pending++;
        break;
      }

      default: {
        break;
      }
    }
  }

  const showTotal = command !== 'new';

  const statusLine = [
    failed ? red(bold(`${failed} failed`)) : '',
    done ? green(bold(`${done} ${command === 'new' ? 'created' : command === 'remove' ? 'removed' : 'done'}`)) : '',
    skipped ? yellow(bold(`${skipped} skipped`)) : '',
    pending ? cyan(bold(`${pending} pending`)) : '',
  ]
    .filter(Boolean)
    .join(dim(' | '));

  if (!statusLine) {
    return '';
  }

  return `  ${statusLine}${showTotal ? gray(` (${total} total)`) : ''}`;
};

export const getHeaderMessage = (
  command: ReporterInitParameters['command'],
  migrations?: Array<MigrationMetadata | MigrationMetadataFinished>,
  lockedMigrations?: Array<MigrationMetadata | MigrationMetadataFinished>,
): string => {
  if (!migrations || !lockedMigrations) {
    return '';
  }

  if (migrations.length === 0) {
    return '  No migrations found';
  }

  const statusText = command === 'list' ? 'migrations are pending' : 'pending migrations to run';

  if (migrations.length === lockedMigrations.length) {
    return `  ${bold(migrations.length.toString())} ${dim(statusText)}`;
  }

  let skippedCount = 0;
  let failedCount = 0;

  for (const migration of migrations) {
    const isLocked = lockedMigrations.some((lockedMigration) => lockedMigration.name === migration.name);

    if (isLocked) {
      continue;
    }

    if ('status' in migration) {
      if (migration.status === 'failed') {
        failedCount += 1;
      } else if (migration.status === 'skipped') {
        skippedCount += 1;
      }
    }
  }

  const parts = [
    bold(`${lockedMigrations.length} of ${migrations.length}`),
    dim(statusText),
    skippedCount > 0 ? yellowBright(`(${skippedCount} skipped)`) : '',
    failedCount > 0 ? redBright(`(${failedCount} failed)`) : '',
  ].filter(Boolean);

  return `  ${parts.join(' ')}`;
};

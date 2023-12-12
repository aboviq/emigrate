import path from 'node:path';
import { black, blueBright, bold, cyan, dim, faint, gray, green, red, redBright, yellow } from 'ansis';
import logUpdate from 'log-update';
import elegantSpinner from 'elegant-spinner';
import figures from 'figures';
import isInteractive from 'is-interactive';
import prettyMs from 'pretty-ms';
import {
  type MigrationMetadata,
  type MigrationMetadataFinished,
  type EmigrateReporter,
  type ReporterInitParameters,
  type Awaitable,
} from '@emigrate/plugin-tools/types';
import { EmigrateError } from '../errors.js';

type Status = ReturnType<typeof getMigrationStatus>;

const interactive = isInteractive();
const spinner = interactive ? elegantSpinner() : () => figures.pointerSmall;

const formatDuration = (duration: number): string => {
  const pretty = prettyMs(duration);

  return yellow(pretty.replaceAll(/([^\s\d]+)/g, dim('$1')));
};

const getTitle = ({ command, directory, dry, cwd }: ReporterInitParameters) => {
  return `${black.bgBlueBright(' Emigrate ').trim()} ${blueBright.bold(command)} ${gray(cwd + path.sep)}${directory}${
    dry ? yellow` (dry run)` : ''
  }`;
};

const getMigrationStatus = (
  migration: MigrationMetadata | MigrationMetadataFinished,
  activeMigration?: MigrationMetadata,
) => {
  if ('status' in migration) {
    return migration.status;
  }

  return migration.name === activeMigration?.name ? 'running' : 'pending';
};

const getIcon = (status: Status) => {
  switch (status) {
    case 'running': {
      return cyan(spinner());
    }

    case 'pending': {
      return gray(figures.pointerSmall);
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
      return faint(name);
    }

    default: {
      return name;
    }
  }
};

const getMigrationText = (
  migration: MigrationMetadata | MigrationMetadataFinished,
  activeMigration?: MigrationMetadata,
) => {
  const nameWithoutExtension = migration.name.slice(0, -migration.extension.length);
  const status = getMigrationStatus(migration, activeMigration);
  const parts = [' ', getIcon(status)];

  parts.push(`${getName(nameWithoutExtension, status)}${dim(migration.extension)}`);

  if ('status' in migration) {
    parts.push(gray(`(${migration.status})`));
  } else if (migration.name === activeMigration?.name) {
    parts.push(gray`(running)`);
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

const getError = (error?: ErrorLike, indent = '  ') => {
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

  const codeString = typeof others['code'] === 'string' ? others['code'] : undefined;
  const code = codeString ? ` [${codeString}]` : '';

  const errorTitle = error.name
    ? `${error.name}${codeString && !error.name.includes(codeString) ? code : ''}: ${error.message}`
    : error.message;
  const parts = [`${indent}${bold.red(errorTitle)}`, ...stack.map((line) => `${indent}  ${dim(line.trim())}`)];

  if (properties.length > 0 && !(error instanceof EmigrateError)) {
    parts.push(`${indent}  ${JSON.stringify(others, undefined, 2).split('\n').join(`\n${indent}  `)}`);
  }

  if (isErrorLike(error.cause)) {
    const nextIndent = `${indent}  `;
    parts.push(`\n${nextIndent}${bold('Original error cause:')}\n`, getError(error.cause, nextIndent));
  }

  return parts.join('\n');
};

const getSummary = (
  command: ReporterInitParameters['command'],
  migrations: Array<MigrationMetadata | MigrationMetadataFinished> = [],
) => {
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
    failed ? red.bold(`${failed} failed`) : '',
    done ? green.bold(`${done} ${command === 'new' ? 'created' : command === 'remove' ? 'removed' : 'done'}`) : '',
    skipped ? yellow.bold(`${skipped} skipped`) : '',
    pending ? cyan.bold(`${pending} pending`) : '',
  ]
    .filter(Boolean)
    .join(dim(' | '));

  if (!statusLine) {
    return '';
  }

  return `  ${statusLine}${showTotal ? gray(` (${total} total)`) : ''}`;
};

const getHeaderMessage = (
  migrations?: Array<MigrationMetadata | MigrationMetadataFinished>,
  lockedMigrations?: Array<MigrationMetadata | MigrationMetadataFinished>,
) => {
  if (!migrations || !lockedMigrations) {
    return '';
  }

  if (migrations.length === 0) {
    return '  No pending migrations found';
  }

  if (migrations.length === lockedMigrations.length) {
    return `  ${bold(migrations.length.toString())} ${dim('pending migrations to run')}`;
  }

  const nonLockedMigrations = migrations.filter(
    (migration) => !lockedMigrations.some((lockedMigration) => lockedMigration.name === migration.name),
  );
  const failedMigrations = nonLockedMigrations.filter(
    (migration) => 'status' in migration && migration.status === 'failed',
  );
  const unlockableCount = nonLockedMigrations.length - failedMigrations.length;

  const parts = [
    bold(`${lockedMigrations.length} of ${migrations.length}`),
    dim`pending migrations to run`,
    unlockableCount > 0 ? yellow(`(${unlockableCount} locked)`) : '',
    failedMigrations.length > 0 ? redBright(`(${failedMigrations.length} failed)`) : '',
  ].filter(Boolean);

  return `  ${parts.join(' ')}`;
};

class DefaultFancyReporter implements Required<EmigrateReporter> {
  #migrations: Array<MigrationMetadata | MigrationMetadataFinished> | undefined;
  #lockedMigrations: MigrationMetadata[] | undefined;
  #activeMigration: MigrationMetadata | undefined;
  #error: Error | undefined;
  #parameters!: ReporterInitParameters;
  #interval: NodeJS.Timeout | undefined;

  onInit(parameters: ReporterInitParameters): void | PromiseLike<void> {
    this.#parameters = parameters;

    this.#start();
  }

  onCollectedMigrations(migrations: MigrationMetadata[]): void | PromiseLike<void> {
    this.#migrations = migrations;
  }

  onLockedMigrations(migrations: MigrationMetadata[]): void | PromiseLike<void> {
    this.#lockedMigrations = migrations;
  }

  onNewMigration(migration: MigrationMetadata, _content: string): Awaitable<void> {
    this.#migrations = [migration];
  }

  onMigrationRemoveStart(migration: MigrationMetadata): Awaitable<void> {
    this.#migrations = [migration];
    this.#activeMigration = migration;
  }

  onMigrationRemoveSuccess(migration: MigrationMetadataFinished): Awaitable<void> {
    this.#finishMigration(migration);
  }

  onMigrationRemoveError(migration: MigrationMetadataFinished, _error: Error): Awaitable<void> {
    this.#finishMigration(migration);
  }

  onMigrationStart(migration: MigrationMetadata): void | PromiseLike<void> {
    this.#activeMigration = migration;
  }

  onMigrationSuccess(migration: MigrationMetadataFinished): void | PromiseLike<void> {
    this.#finishMigration(migration);
  }

  onMigrationError(migration: MigrationMetadataFinished, _error: Error): void | PromiseLike<void> {
    this.#finishMigration(migration);
  }

  onMigrationSkip(migration: MigrationMetadataFinished): void | PromiseLike<void> {
    this.#finishMigration(migration);
  }

  onFinished(migrations: MigrationMetadataFinished[], error?: Error | undefined): void | PromiseLike<void> {
    if (this.#parameters.command === 'new') {
      for (const migration of migrations) {
        this.#finishMigration(migration);
      }
    }

    this.#error = error;
    this.#activeMigration = undefined;
    this.#stop();
  }

  #finishMigration(migration: MigrationMetadataFinished): void {
    this.#migrations ??= [];

    const index = this.#migrations.findIndex((m) => m.name === migration.name);

    if (index === -1) {
      this.#migrations.push(migration);
    } else {
      this.#migrations[index] = migration;
    }
  }

  #render(flush = false): void {
    const parts = [
      getTitle(this.#parameters),
      getHeaderMessage(this.#migrations, this.#lockedMigrations),
      this.#migrations?.map((migration) => getMigrationText(migration, this.#activeMigration)).join('\n') ?? '',
      getSummary(this.#parameters.command, this.#migrations),
      getError(this.#error),
    ];

    const output = '\n' + parts.filter(Boolean).join('\n\n') + '\n';

    if (flush) {
      logUpdate.clear();
      logUpdate.done();
      console.log(output);
      return;
    }

    logUpdate(output);
  }

  #start(): void {
    this.#render();
    this.#interval = setInterval(() => {
      this.#render();
    }, 80).unref();
  }

  #stop(): void {
    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = undefined;
    }

    this.#render(true);
  }
}

class DefaultReporter implements Required<EmigrateReporter> {
  #migrations?: MigrationMetadata[];
  #lockedMigrations?: MigrationMetadata[];
  #parameters!: ReporterInitParameters;

  onInit(parameters: ReporterInitParameters): void | PromiseLike<void> {
    this.#parameters = parameters;
    console.log('');
    console.log(getTitle(parameters));
    console.log('');
  }

  onCollectedMigrations(migrations: MigrationMetadata[]): void | PromiseLike<void> {
    this.#migrations = migrations;
  }

  onLockedMigrations(migrations: MigrationMetadata[]): void | PromiseLike<void> {
    this.#lockedMigrations = migrations;

    console.log(getHeaderMessage(this.#migrations, this.#lockedMigrations));
    console.log('');
  }

  onNewMigration(migration: MigrationMetadata, _content: string): Awaitable<void> {
    console.log(getMigrationText(migration));
  }

  onMigrationRemoveStart(migration: MigrationMetadata): Awaitable<void> {
    console.log(getMigrationText(migration));
  }

  onMigrationRemoveSuccess(migration: MigrationMetadataFinished): Awaitable<void> {
    console.log(getMigrationText(migration));
  }

  onMigrationRemoveError(migration: MigrationMetadataFinished, _error: Error): Awaitable<void> {
    console.error(getMigrationText(migration));
  }

  onMigrationStart(migration: MigrationMetadata): void | PromiseLike<void> {
    console.log(getMigrationText(migration, migration));
  }

  onMigrationSuccess(migration: MigrationMetadataFinished): void | PromiseLike<void> {
    console.log(getMigrationText(migration));
  }

  onMigrationError(migration: MigrationMetadataFinished, _error: Error): void | PromiseLike<void> {
    console.error(getMigrationText(migration));
  }

  onMigrationSkip(migration: MigrationMetadataFinished): void | PromiseLike<void> {
    console.log(getMigrationText(migration));
  }

  onFinished(migrations: MigrationMetadataFinished[], error?: Error | undefined): void | PromiseLike<void> {
    console.log('');
    console.log(getSummary(this.#parameters.command, migrations));
    console.log('');

    if (error) {
      console.error(getError(error));
      console.log('');
    }
  }
}

const reporterDefault = interactive ? new DefaultFancyReporter() : new DefaultReporter();

export default reporterDefault;

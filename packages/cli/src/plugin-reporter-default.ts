import path from 'node:path';
import { black, blueBright, bold, cyan, dim, gray, green, red, redBright, yellow } from 'ansis';
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

type Status = ReturnType<typeof getMigrationStatus>;

const interactive = isInteractive();
const spinner = interactive ? elegantSpinner() : () => figures.pointerSmall;

const formatDuration = (duration: number): string => {
  const pretty = prettyMs(duration);

  return yellow(pretty.replaceAll(/([^\s\d]+)/g, dim('$1')));
};

const getTitle = ({ command, directory, dry, cwd }: ReporterInitParameters) => {
  return `${black.bgBlueBright` Emigrate `} ${blueBright.bold(command)} ${gray(cwd + path.sep)}${directory}${
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

const getError = (error?: Error, indent = '  ') => {
  if (!error) {
    return '';
  }

  let errorTitle: string;
  let stack: string[] = [];

  if (error.stack) {
    // @ts-expect-error error won't be undefined here
    [errorTitle, ...stack] = error.stack.split('\n');
  } else if (error.name) {
    errorTitle = `${error.name}: ${error.message}`;
  } else {
    errorTitle = error.message;
  }

  const parts = [`${indent}${bold.red(errorTitle)}`, ...stack.map((line) => `${indent}${dim(line)}`)];

  if (error.cause instanceof Error) {
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

  for (const migration of migrations) {
    const status = getMigrationStatus(migration);
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

      default: {
        break;
      }
    }
  }

  const showTotal = command !== 'new';

  const statusLine = [
    failed ? red.bold(`${failed} failed`) : '',
    done ? green.bold(`${done} ${command === 'new' ? 'created' : 'done'}`) : '',
    skipped ? yellow.bold(`${skipped} skipped`) : '',
  ]
    .filter(Boolean)
    .join(dim(' | '));

  if (!statusLine) {
    return '';
  }

  return `  ${statusLine}${showTotal ? gray(` (${total} total)`) : ''}`;
};

const getHeaderMessage = (migrations?: MigrationMetadata[], lockedMigrations?: MigrationMetadata[]) => {
  if (!migrations || !lockedMigrations) {
    return '';
  }

  if (migrations.length === 0) {
    return '  No pending migrations found';
  }

  if (migrations.length === lockedMigrations.length) {
    return `  ${bold(migrations.length.toString())} ${dim('pending migrations to run')}`;
  }

  if (lockedMigrations.length === 0) {
    return `  ${bold(`0 of ${migrations.length}`)} ${dim('pending migrations to run')} ${redBright('(all locked)')}`;
  }

  return `  ${bold(`${lockedMigrations.length} of ${migrations.length}`)} ${dim('pending migrations to run')} ${yellow(
    `(${migrations.length - lockedMigrations.length} locked)`,
  )}`;
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
    if (!this.#migrations) {
      return;
    }

    const index = this.#migrations.findIndex((m) => m.name === migration.name);

    if (index !== -1) {
      this.#migrations[index] = migration;
    }
  }

  #render(): void {
    const parts = [
      getTitle(this.#parameters),
      getHeaderMessage(this.#migrations, this.#lockedMigrations),
      this.#migrations?.map((migration) => getMigrationText(migration, this.#activeMigration)).join('\n') ?? '',
      getSummary(this.#parameters.command, this.#migrations),
      getError(this.#error),
    ];
    logUpdate('\n' + parts.filter(Boolean).join('\n\n') + '\n');
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

    this.#render();
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

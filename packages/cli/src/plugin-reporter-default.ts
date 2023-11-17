import path from 'node:path';
import ansis from 'ansis';
import logUpdate from 'log-update';
import elegantSpinner from 'elegant-spinner';
import figures from 'figures';
import isInteractive from 'is-interactive';
import prettyMs from 'pretty-ms';
import {
  type MigrationMetadata,
  type MigrationMetadataFinished,
  type ReporterPlugin,
} from '@emigrate/plugin-tools/types';

type Status = ReturnType<typeof getMigrationStatus>;

const interactive = isInteractive();
const spinner = interactive ? elegantSpinner() : () => figures.pointerSmall;

const formatDuration = (duration: number): string => {
  const pretty = prettyMs(duration);

  return ansis.yellow(pretty.replaceAll(/([^\s\d]+)/g, ansis.dim('$1')));
};

const getTitle = ({ directory, dry, cwd }: { directory: string; dry: boolean; cwd: string }) => {
  return `${ansis.bgBlueBright(ansis.black(' Emigrate '))} ${ansis.gray(cwd + path.sep)}${directory}${
    dry ? ansis.yellow(' (dry run)') : ''
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
      return ansis.cyan(spinner());
    }

    case 'pending': {
      return ansis.gray(figures.pointerSmall);
    }

    case 'done': {
      return ansis.green(figures.tick);
    }

    case 'failed': {
      return ansis.red(figures.cross);
    }

    case 'skipped': {
      return ansis.yellow(figures.circle);
    }

    default: {
      return ' ';
    }
  }
};

const getName = (name: string, status?: Status) => {
  switch (status) {
    case 'failed': {
      return ansis.red(name);
    }

    case 'skipped': {
      return ansis.yellow(name);
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

  parts.push(`${getName(nameWithoutExtension, status)}${ansis.dim(migration.extension)}`);

  if ('status' in migration) {
    parts.push(ansis.gray(`(${migration.status})`));
  } else if (migration.name === activeMigration?.name) {
    parts.push(ansis.gray('(running)'));
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

  const parts = [`${indent}${ansis.bold.red(errorTitle)}`, ...stack.map((line) => `${indent}${ansis.dim(line)}`)];

  if (error.cause instanceof Error) {
    const nextIndent = `${indent}  `;
    parts.push(`\n${nextIndent}${ansis.bold('Original error cause:')}\n`, getError(error.cause, nextIndent));
  }

  return parts.join('\n');
};

const getSummary = (migrations: Array<MigrationMetadata | MigrationMetadataFinished> = []) => {
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

  const statusLine = [
    failed ? ansis.bold.red(`${failed} failed`) : '',
    done ? ansis.bold.green(`${done} done`) : '',
    skipped ? ansis.bold.yellow(`${skipped} skipped`) : '',
  ]
    .filter(Boolean)
    .join(ansis.dim(' | '));

  if (!statusLine) {
    return '';
  }

  return `  ${statusLine}${ansis.gray(` (${total} total)`)}`;
};

const getHeaderMessage = (migrations?: MigrationMetadata[], lockedMigrations?: MigrationMetadata[]) => {
  if (!migrations || !lockedMigrations) {
    return '';
  }

  if (migrations.length === 0) {
    return '  No pending migrations found';
  }

  if (migrations.length === lockedMigrations.length) {
    return `  ${ansis.bold(migrations.length.toString())} ${ansis.dim('pending migrations to run')}`;
  }

  if (lockedMigrations.length === 0) {
    return `  ${ansis.bold(`0 of ${migrations.length}`)} ${ansis.dim('pending migrations to run')} ${ansis.redBright(
      '(all locked)',
    )}`;
  }

  return `  ${ansis.bold(`${lockedMigrations.length} of ${migrations.length}`)} ${ansis.dim(
    'pending migrations to run',
  )} ${ansis.yellow(`(${migrations.length - lockedMigrations.length} locked)`)}`;
};

class DefaultFancyReporter implements Required<ReporterPlugin> {
  #migrations: Array<MigrationMetadata | MigrationMetadataFinished> | undefined;
  #lockedMigrations: MigrationMetadata[] | undefined;
  #activeMigration: MigrationMetadata | undefined;
  #error: Error | undefined;
  #directory!: string;
  #cwd!: string;
  #dry!: boolean;
  #interval: NodeJS.Timeout | undefined;

  onInit(parameters: { directory: string; cwd: string; dry: boolean }): void | PromiseLike<void> {
    this.#directory = parameters.directory;
    this.#dry = parameters.dry;
    this.#cwd = parameters.cwd;

    this.#start();
  }

  onCollectedMigrations(migrations: MigrationMetadata[]): void | PromiseLike<void> {
    this.#migrations = migrations;
  }

  onLockedMigrations(migrations: MigrationMetadata[]): void | PromiseLike<void> {
    this.#lockedMigrations = migrations;
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

  onFinished(_migrations: MigrationMetadataFinished[], error?: Error | undefined): void | PromiseLike<void> {
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
      getTitle({ directory: this.#directory, dry: this.#dry, cwd: this.#cwd }),
      getHeaderMessage(this.#migrations, this.#lockedMigrations),
      this.#migrations?.map((migration) => getMigrationText(migration, this.#activeMigration)).join('\n') ?? '',
      getSummary(this.#migrations),
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

class DefaultReporter implements Required<ReporterPlugin> {
  #migrations?: MigrationMetadata[];
  #lockedMigrations?: MigrationMetadata[];

  onInit(parameters: { directory: string; cwd: string; dry: boolean }): void | PromiseLike<void> {
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
    console.log(getSummary(migrations));
    console.log('');

    if (error) {
      console.error(getError(error));
      console.log('');
    }
  }
}

const reporterDefault = interactive ? new DefaultFancyReporter() : new DefaultReporter();

export default reporterDefault;

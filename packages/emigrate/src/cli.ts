#!/usr/bin/env node
import process from 'node:process';
import { parseArgs } from 'node:util';
import { ShowUsageError } from './show-usage-error.js';

type Action = (args: string[]) => Promise<void>;

const up: Action = async (args) => {
  const { values } = parseArgs({
    args,
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
      dir: {
        type: 'string',
        short: 'd',
      },
      plugin: {
        type: 'string',
        short: 'p',
        multiple: true,
        default: [],
      },
    },
    allowPositionals: false,
  });

  const showHelp = !values.dir || values.help;

  if (!values.dir) {
    console.error('Missing required option: --dir\n');
  }

  if (showHelp) {
    console.log(`Usage: emigrate up [options]

Run all pending migrations

Options:

  -h, --help    Show this help message and exit
  -d, --dir     The directory where the migration files are located (required)
  -p, --plugin  The plugin(s) to use (can be specified multiple times)

Examples:

  emigrate up --dir src/migrations
  emigrate up --dir ./migrations --plugin @emigrate/plugin-storage-mysql
`);
    process.exitCode = 1;
    return;
  }

  console.log(values);
};

const newMigration: Action = async (args) => {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
      directory: {
        type: 'string',
        short: 'd',
      },
      template: {
        type: 'string',
        short: 't',
      },
      plugin: {
        type: 'string',
        short: 'p',
        multiple: true,
        default: [],
      },
    },
    allowPositionals: true,
  });

  const usage = `Usage: emigrate new [options] <name>

Create a new migration file with the given name in the specified directory

Options:

  -h, --help       Show this help message and exit
  -d, --directory  The directory where the migration files are located (required)
  -p, --plugin     The plugin(s) to use (can be specified multiple times)
  -t, --template   A template file to use as contents for the new migration file

  Either the --template or the --plugin option is required must be specified

Examples:

  emigrate new -d src/migrations -t migration-template.js create users table
  emigrate new --directory ./migrations --plugin @emigrate/plugin-generate-sql create_users_table
`;

  if (values.help) {
    console.log(usage);
    process.exitCode = 1;
    return;
  }

  const { plugin: plugins = [], directory, template } = values;
  const name = positionals.join(' ').trim();

  try {
    const { default: newCommand } = await import('./new-command.js');
    await newCommand({ directory, template, plugins, name });
  } catch (error) {
    if (error instanceof ShowUsageError) {
      console.error(error.message, '\n');
      console.log(usage);
      process.exitCode = 1;
      return;
    }

    throw error;
  }
};

const list: Action = async (args) => {
  const { values } = parseArgs({
    args,
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
      plugin: {
        type: 'string',
        short: 'p',
        multiple: true,
        default: [],
      },
    },
    allowPositionals: false,
  });

  console.log(values);
};

const commands: Record<string, Action> = {
  up,
  list,
  new: newMigration,
};

const command = process.argv[2];
const action = command ? commands[command] : undefined;

if (!action) {
  if (command) {
    console.error(`Unknown command: ${command}\n`);
  } else {
    console.error('No command specified\n');
  }

  console.log(`Usage: emigrate <command>

Commands:

  up      Run all pending migrations
  new     Create a new migration file
  list    List all migrations
`);
  process.exit(1);
}

try {
  await action(process.argv.slice(3));
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
    if (error.cause instanceof Error) {
      console.error(error.cause.message);
    }
  } else {
    console.error(error);
  }

  process.exit(1);
}

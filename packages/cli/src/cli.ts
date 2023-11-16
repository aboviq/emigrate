#!/usr/bin/env node
import process from 'node:process';
import { parseArgs } from 'node:util';
import { ShowUsageError } from './errors.js';
import { getConfig } from './get-config.js';

type Action = (args: string[]) => Promise<void>;

const up: Action = async (args) => {
  const config = await getConfig('up');
  const { values } = parseArgs({
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
      dry: {
        type: 'boolean',
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

  const usage = `Usage: emigrate up [options]

Run all pending migrations

Options:

  -h, --help       Show this help message and exit
  -d, --directory  The directory where the migration files are located (required)
  -p, --plugin     The plugin(s) to use (can be specified multiple times)
  --dry            List the pending migrations that would be run without actually running them

Examples:

  emigrate up --directory src/migrations
  emigrate up -d ./migrations --plugin @emigrate/plugin-storage-mysql
  emigrate up -d src/migrations --dry
`;

  if (values.help) {
    console.log(usage);
    process.exitCode = 1;
    return;
  }

  const { directory = config.directory, dry } = values;
  const plugins = [...(config.plugins ?? []), ...(values.plugin ?? [])];

  try {
    const { default: upCommand } = await import('./up-command.js');
    await upCommand({ directory, plugins, dry });
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

const newMigration: Action = async (args) => {
  const config = await getConfig('new');
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
      extension: {
        type: 'string',
        short: 'e',
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
                   (if the extension option is not provided the template file's extension will be used)
  -e, --extension  The extension to use for the new migration file
                   (if no template or plugin is provided an empty migration file will be created with the given extension)

  One of the --template, --extension or the --plugin options must be specified

Examples:

  emigrate new -d src/migrations -t migration-template.js create users table
  emigrate new --directory ./migrations --plugin @emigrate/plugin-generate-sql create_users_table
  emigrate new -d ./migrations -e .sql create_users_table
  emigrate new -d ./migrations -t .migration-template -e .sql "drop some table"
`;

  if (values.help) {
    console.log(usage);
    process.exitCode = 1;
    return;
  }

  const { directory = config.directory, template = config.template, extension = config.extension } = values;
  const plugins = [...(config.plugins ?? []), ...(values.plugin ?? [])];
  const name = positionals.join(' ').trim();

  try {
    const { default: newCommand } = await import('./new-command.js');
    await newCommand({ directory, template, plugins, extension }, name);
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
      console.error(error.cause.stack);
    }
  } else {
    console.error(error);
  }

  process.exit(1);
}

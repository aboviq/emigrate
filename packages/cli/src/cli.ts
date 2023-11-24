#!/usr/bin/env node --enable-source-maps
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
      reporter: {
        type: 'string',
        short: 'r',
      },
      storage: {
        type: 'string',
        short: 's',
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
  -s, --storage    The storage to use for where to store the migration history (required)
  -p, --plugin     The plugin(s) to use (can be specified multiple times)
  -r, --reporter   The reporter to use for reporting the migration progress
  --dry            List the pending migrations that would be run without actually running them

Examples:

  emigrate up --directory src/migrations -s fs
  emigrate up -d ./migrations --storage @emigrate/storage-mysql
  emigrate up -d src/migrations -s postgres -r json --dry
`;

  if (values.help) {
    console.log(usage);
    process.exitCode = 1;
    return;
  }

  const { directory = config.directory, storage = config.storage, reporter = config.reporter, dry } = values;
  const plugins = [...(config.plugins ?? []), ...(values.plugin ?? [])];

  try {
    const { default: upCommand } = await import('./commands/up.js');
    await upCommand({ storage, reporter, directory, plugins, dry });
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
      reporter: {
        type: 'string',
        short: 'r',
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

Arguments:

  name   The name of the migration file to create (required)

Options:

  -h, --help       Show this help message and exit
  -d, --directory  The directory where the migration files are located (required)
  -r, --reporter   The reporter to use for reporting the migration file creation progress
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

  const {
    directory = config.directory,
    template = config.template,
    extension = config.extension,
    reporter = config.reporter,
  } = values;
  const plugins = [...(config.plugins ?? []), ...(values.plugin ?? [])];
  const name = positionals.join(' ').trim();

  try {
    const { default: newCommand } = await import('./commands/new.js');
    await newCommand({ directory, template, plugins, extension, reporter }, name);
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
  const config = await getConfig('list');
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
      reporter: {
        type: 'string',
        short: 'r',
      },
      storage: {
        type: 'string',
        short: 's',
      },
    },
    allowPositionals: false,
  });

  const usage = `Usage: emigrate list [options]

List all migrations and their status. This command does not run any migrations.

Options:

  -h, --help       Show this help message and exit
  -d, --directory  The directory where the migration files are located (required)
  -r, --reporter   The reporter to use for reporting the migrations
  -s, --storage    The storage to use to get the migration history (required)

Examples:

  emigrate list -d migrations -s fs
  emigrate list --directory ./migrations --storage postgres --reporter json
`;

  if (values.help) {
    console.log(usage);
    process.exitCode = 1;
    return;
  }

  const { directory = config.directory, storage = config.storage, reporter = config.reporter } = values;

  try {
    const { default: listCommand } = await import('./commands/list.js');
    await listCommand({ directory, storage, reporter });
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

const remove: Action = async (args) => {
  const config = await getConfig('remove');
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
      force: {
        type: 'boolean',
        short: 'f',
      },
      reporter: {
        type: 'string',
        short: 'r',
      },
      storage: {
        type: 'string',
        short: 's',
      },
    },
    allowPositionals: true,
  });

  const usage = `Usage: emigrate remove [options] <name>

Remove entries from the migration history.
This is useful if you want to retry a migration that has failed.

Arguments:

  name   The name of the migration file to remove from the history (required)

Options:

  -h, --help       Show this help message and exit
  -d, --directory  The directory where the migration files are located (required)
  -r, --reporter   The reporter to use for reporting the removal process
  -s, --storage    The storage to use to get the migration history (required)
  -f, --force      Force removal of the migration history entry even if the migration file does not exist
                   or it's in a non-failed state

Examples:

  emigrate remove -d migrations -s fs 20231122120529381_some_migration_file.js
  emigrate remove --directory ./migrations --storage postgres 20231122120529381_some_migration_file.sql
`;

  if (values.help) {
    console.log(usage);
    process.exitCode = 1;
    return;
  }

  const { directory = config.directory, storage = config.storage, reporter = config.reporter, force } = values;

  try {
    const { default: removeCommand } = await import('./commands/remove.js');
    await removeCommand({ directory, storage, reporter, force }, positionals[0] ?? '');
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

const commands: Record<string, Action> = {
  up,
  list,
  remove,
  new: newMigration,
};

const command = process.argv[2]?.toLowerCase();
const action = command ? commands[command] : undefined;

if (!action) {
  if (command) {
    console.error(`Unknown command: ${command}\n`);
  } else {
    console.error('No command specified\n');
  }

  console.log(`Usage: emigrate <command>

Commands:

  up      Run all pending migrations (or do a dry run)
  new     Create a new migration file
  list    List all migrations and their status
  remove  Remove entries from the migration history
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
}

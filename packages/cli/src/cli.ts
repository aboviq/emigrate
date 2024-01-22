#!/usr/bin/env node
import process from 'node:process';
import { parseArgs } from 'node:util';
import importFromEsm from 'import-from-esm';
import { CommandAbortError, ShowUsageError } from './errors.js';
import { getConfig } from './get-config.js';
import { DEFAULT_RESPITE_SECONDS } from './defaults.js';

type Action = (args: string[], abortSignal: AbortSignal) => Promise<void>;

const useColors = (values: { color?: boolean; 'no-color'?: boolean }) => {
  if (values['no-color']) {
    return false;
  }

  return values.color;
};

const importAll = async (cwd: string, modules: string[]) => {
  for await (const module of modules) {
    await importFromEsm(cwd, module);
  }
};

const up: Action = async (args, abortSignal) => {
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
      import: {
        type: 'string',
        short: 'i',
        multiple: true,
        default: [],
      },
      reporter: {
        type: 'string',
        short: 'r',
      },
      storage: {
        type: 'string',
        short: 's',
      },
      limit: {
        type: 'string',
        short: 'l',
      },
      from: {
        type: 'string',
        short: 'f',
      },
      to: {
        type: 'string',
        short: 't',
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
      color: {
        type: 'boolean',
      },
      'no-execution': {
        type: 'boolean',
      },
      'no-color': {
        type: 'boolean',
      },
      'abort-respite': {
        type: 'string',
      },
    },
    allowPositionals: false,
  });

  const usage = `Usage: emigrate up [options]

Run all pending migrations

Options:

  -h, --help              Show this help message and exit
  -d, --directory <path>  The directory where the migration files are located (required)
  -i, --import <module>   Additional modules/packages to import before running the migrations (can be specified multiple times)
                          For example if you want to use Dotenv to load environment variables or when using TypeScript
  -s, --storage <name>    The storage to use for where to store the migration history (required)
  -p, --plugin <name>     The plugin(s) to use (can be specified multiple times)
  -r, --reporter <name>   The reporter to use for reporting the migration progress
  -l, --limit <count>     Limit the number of migrations to run
  -f, --from <name>       Start running migrations from the given migration name, the given name doesn't need to exist
                          and is compared in lexicographical order
  -t, --to <name>         Skip migrations after the given migration name, the given name doesn't need to exist
                          and is compared in lexicographical order
  --dry                   List the pending migrations that would be run without actually running them
  --color                 Force color output (this option is passed to the reporter)
  --no-color              Disable color output (this option is passed to the reporter)
  --no-execution          Mark the migrations as executed and successful without actually running them,
                          which is useful if you want to mark migrations as successful after running them manually
  --abort-respite <sec>   The number of seconds to wait before abandoning running migrations after the command has been aborted (default: ${DEFAULT_RESPITE_SECONDS})

Examples:

  emigrate up --directory src/migrations -s fs
  emigrate up -d ./migrations --storage @emigrate/mysql
  emigrate up -d src/migrations -s postgres -r json --dry
  emigrate up -d ./migrations -s mysql --import dotenv/config
  emigrate up --limit 1
  emigrate up --to 20231122120529381_some_migration_file.js
  emigrate up --to 20231122120529381_some_migration_file.js --no-execution
`;

  if (values.help) {
    console.log(usage);
    process.exitCode = 1;
    return;
  }

  const cwd = process.cwd();
  const {
    directory = config.directory,
    storage = config.storage,
    reporter = config.reporter,
    dry,
    from,
    to,
    limit: limitString,
    import: imports = [],
    'abort-respite': abortRespiteString,
    'no-execution': noExecution,
  } = values;
  const plugins = [...(config.plugins ?? []), ...(values.plugin ?? [])];

  const limit = limitString === undefined ? undefined : Number.parseInt(limitString, 10);
  const abortRespite = abortRespiteString === undefined ? config.abortRespite : Number.parseInt(abortRespiteString, 10);

  if (Number.isNaN(limit)) {
    console.error('Invalid limit value, expected an integer but was:', limitString);
    console.log(usage);
    process.exitCode = 1;
    return;
  }

  if (Number.isNaN(abortRespite)) {
    console.error(
      'Invalid abortRespite value, expected an integer but was:',
      abortRespiteString ?? config.abortRespite,
    );
    console.log(usage);
    process.exitCode = 1;
    return;
  }

  await importAll(cwd, imports);

  try {
    const { default: upCommand } = await import('./commands/up.js');
    process.exitCode = await upCommand({
      storage,
      reporter,
      directory,
      plugins,
      cwd,
      dry,
      limit,
      from,
      to,
      noExecution,
      abortSignal,
      abortRespite: (abortRespite ?? DEFAULT_RESPITE_SECONDS) * 1000,
      color: useColors(values),
    });
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
        short: 'x',
      },
      plugin: {
        type: 'string',
        short: 'p',
        multiple: true,
        default: [],
      },
      color: {
        type: 'boolean',
      },
      'no-color': {
        type: 'boolean',
      },
    },
    allowPositionals: true,
  });

  const usage = `Usage: emigrate new [options] <name>

Create a new migration file with the given name in the specified directory

Arguments:

  name   The name of the migration file to create (required)

Options:

  -h, --help              Show this help message and exit
  -d, --directory <path>  The directory where the migration files are located (required)
  -r, --reporter <name>   The reporter to use for reporting the migration file creation progress
  -p, --plugin <name>     The plugin(s) to use (can be specified multiple times)
  -t, --template <path>   A template file to use as contents for the new migration file
                          (if the extension option is not provided the template file's extension will be used)
  -x, --extension <ext>   The extension to use for the new migration file
                          (if no template or plugin is provided an empty migration file will be created with the given extension)
  --color                 Force color output (this option is passed to the reporter)
  --no-color              Disable color output (this option is passed to the reporter)

  One of the --template, --extension or the --plugin options must be specified

Examples:

  emigrate new -d src/migrations -t migration-template.js create users table
  emigrate new --directory ./migrations --plugin @emigrate/postgres create_users_table
  emigrate new -d ./migrations -x .sql create_users_table
  emigrate new -d ./migrations -t .migration-template -x .sql "drop some table"
`;

  if (values.help) {
    console.log(usage);
    process.exitCode = 1;
    return;
  }

  const cwd = process.cwd();
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
    await newCommand({ directory, template, plugins, extension, reporter, cwd, color: useColors(values) }, name);
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
      import: {
        type: 'string',
        short: 'i',
        multiple: true,
        default: [],
      },
      reporter: {
        type: 'string',
        short: 'r',
      },
      storage: {
        type: 'string',
        short: 's',
      },
      color: {
        type: 'boolean',
      },
      'no-color': {
        type: 'boolean',
      },
    },
    allowPositionals: false,
  });

  const usage = `Usage: emigrate list [options]

List all migrations and their status. This command does not run any migrations.

Options:

  -h, --help              Show this help message and exit
  -d, --directory <path>  The directory where the migration files are located (required)
  -i, --import <module>   Additional modules/packages to import before listing the migrations (can be specified multiple times)
                          For example if you want to use Dotenv to load environment variables
  -r, --reporter <name>   The reporter to use for reporting the migrations
  -s, --storage <name>    The storage to use to get the migration history (required)
  --color                 Force color output (this option is passed to the reporter)
  --no-color              Disable color output (this option is passed to the reporter)

Examples:

  emigrate list -d migrations -s fs
  emigrate list --directory ./migrations --storage postgres --reporter json
`;

  if (values.help) {
    console.log(usage);
    process.exitCode = 1;
    return;
  }

  const cwd = process.cwd();
  const {
    directory = config.directory,
    storage = config.storage,
    reporter = config.reporter,
    import: imports = [],
  } = values;

  await importAll(cwd, imports);

  try {
    const { default: listCommand } = await import('./commands/list.js');
    process.exitCode = await listCommand({ directory, storage, reporter, cwd, color: useColors(values) });
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
      import: {
        type: 'string',
        short: 'i',
        multiple: true,
        default: [],
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
      color: {
        type: 'boolean',
      },
      'no-color': {
        type: 'boolean',
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

  -h, --help              Show this help message and exit
  -d, --directory <path>  The directory where the migration files are located (required)
  -i, --import <module>   Additional modules/packages to import before removing the migration (can be specified multiple times)
                          For example if you want to use Dotenv to load environment variables
  -r, --reporter <name>   The reporter to use for reporting the removal process
  -s, --storage <name>    The storage to use to get the migration history (required)
  -f, --force             Force removal of the migration history entry even if the migration file does not exist
                          or it's in a non-failed state
  --color                 Force color output (this option is passed to the reporter)
  --no-color              Disable color output (this option is passed to the reporter)

Examples:

  emigrate remove -d migrations -s fs 20231122120529381_some_migration_file.js
  emigrate remove --directory ./migrations --storage postgres 20231122120529381_some_migration_file.sql
  emigrate remove -i dotenv/config -d ./migrations -s postgres 20231122120529381_some_migration_file.sql
`;

  if (values.help) {
    console.log(usage);
    process.exitCode = 1;
    return;
  }

  const cwd = process.cwd();
  const {
    directory = config.directory,
    storage = config.storage,
    reporter = config.reporter,
    force,
    import: imports = [],
  } = values;

  await importAll(cwd, imports);

  try {
    const { default: removeCommand } = await import('./commands/remove.js');
    process.exitCode = await removeCommand(
      { directory, storage, reporter, force, cwd, color: useColors(values) },
      positionals[0] ?? '',
    );
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

const main: Action = async (args, abortSignal) => {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
      version: {
        type: 'boolean',
        short: 'v',
      },
    },
    allowPositionals: true,
    strict: false,
  });

  const usage = `Usage: emigrate <options>/<command>

Options:

  -h, --help     Show this help message and exit
  -v, --version  Print version number and exit

Commands:

  up      Run all pending migrations (or do a dry run)
  new     Create a new migration file
  list    List all migrations and their status
  remove  Remove entries from the migration history
`;

  const command = positionals[0]?.toLowerCase();
  const action = command ? commands[command] : undefined;

  if (!action) {
    if (command) {
      console.error(`Unknown command: ${command}\n`);
    } else if (values.version) {
      const { version } = await import('./get-package-info.js');
      console.log(version);
      process.exitCode = 0;
      return;
    } else if (!values.help) {
      console.error('No command specified\n');
    }

    console.log(usage);
    process.exitCode = 1;
    return;
  }

  try {
    await action(process.argv.slice(3), abortSignal);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      if (error.cause instanceof Error) {
        console.error(error.cause);
      }
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  }
};

const controller = new AbortController();

process.on('SIGINT', () => {
  controller.abort(CommandAbortError.fromSignal('SIGINT'));
});

process.on('SIGTERM', () => {
  controller.abort(CommandAbortError.fromSignal('SIGTERM'));
});

process.on('uncaughtException', (error) => {
  controller.abort(CommandAbortError.fromReason('Uncaught exception', error));
});

process.on('unhandledRejection', (error) => {
  controller.abort(CommandAbortError.fromReason('Unhandled rejection', error));
});

await main(process.argv.slice(2), controller.signal);

setTimeout(() => {
  console.error('Process did not exit within 10 seconds, forcing exit');
  process.exit(1);
}, 10_000).unref();

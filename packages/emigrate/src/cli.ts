#!/usr/bin/env node
import process from 'node:process';
import { parseArgs } from 'node:util';
import { isGeneratorPlugin } from '@emigrate/plugin-tools';
import { type GeneratorPlugin } from '@emigrate/plugin-tools/types';

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
    allowPositionals: true,
  });

  const hasPositionals = positionals.join('').trim() !== '';
  const showHelp = !values.dir || !hasPositionals || values.help;

  if (!values.dir) {
    console.error('Missing required option: --dir\n');
  }

  if (!hasPositionals) {
    console.error('Missing required migration name: <name>\n');
  }

  if (showHelp) {
    console.log(`Usage: emigrate new [options] <name>

Run all pending migrations

Options:

  -h, --help    Show this help message and exit
  -d, --dir     The directory where the migration files are located (required)
  -p, --plugin  The plugin(s) to use (can be specified multiple times)

Examples:

  emigrate new --dir src/migrations create users table
  emigrate new --dir ./migrations --plugin @emigrate/plugin-generate-sql create_users_table
`);
    process.exitCode = 1;
    return;
  }

  const { plugin: plugins = [] } = values;

  if (plugins.length > 0) {
    let generatorPlugin: GeneratorPlugin | undefined;

    const path = await import('node:path');

    for await (const plugin of plugins) {
      const pluginPath = plugin.startsWith('.') ? path.resolve(process.cwd(), plugin) : plugin;

      try {
        const pluginModule: unknown = await import(pluginPath);

        if (isGeneratorPlugin(pluginModule)) {
          generatorPlugin = pluginModule;
          break;
        }

        if (
          pluginModule &&
          typeof pluginModule === 'object' &&
          'default' in pluginModule &&
          isGeneratorPlugin(pluginModule.default)
        ) {
          generatorPlugin = pluginModule.default;
          break;
        }
      } catch (error) {
        console.error(`Failed to load plugin: ${plugin}`);

        if (error instanceof Error) {
          console.error(error.message);
        }

        process.exitCode = 1;
        return;
      }
    }

    if (!generatorPlugin) {
      console.error('No generator plugin found, please specify a generator plugin using the --plugin option\n');
      process.exitCode = 1;
      return;
    }

    const fs = await import('node:fs/promises');

    const { filename, content } = await generatorPlugin.generate(positionals.join(' '));

    const directory = path.resolve(process.cwd(), values.dir!);

    try {
      await fs.mkdir(directory, { recursive: true });
    } catch (error) {
      console.error(`Failed to create migration directory: ${directory}`);

      if (error instanceof Error) {
        console.error(error.message);
      }

      process.exitCode = 1;
      return;
    }

    const file = path.resolve(directory, filename);

    try {
      await fs.writeFile(file, content);

      console.log(`Created migration file: ${path.relative(process.cwd(), file)}`);
    } catch (error) {
      console.error(`Failed to write migration file: ${file}`);

      if (error instanceof Error) {
        console.error(error.message);
      }

      process.exitCode = 1;
    }
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
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

# @emigrate/cli

Emigrate is a tool for managing database migrations. It is designed to be simple yet support advanced setups, modular and extensible.

📖 Read the [documentation](https://emigrate.dev) for more information!

## Installation

Install the Emigrate CLI in your project:

```bash
npm install @emigrate/cli
# or
pnpm add @emigrate/cli
# or
yarn add @emigrate/cli
# or
bun add @emigrate/cli
```

## Usage

```text
Usage: emigrate up [options]

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
  --abort-respite <sec>   The number of seconds to wait before abandoning running migrations after the command has been aborted (default: 10)

Examples:

  emigrate up --directory src/migrations -s fs
  emigrate up -d ./migrations --storage @emigrate/mysql
  emigrate up -d src/migrations -s postgres -r json --dry
  emigrate up -d ./migrations -s mysql --import dotenv/config
  emigrate up --limit 1
  emigrate up --to 20231122120529381_some_migration_file.js
  emigrate up --to 20231122120529381_some_migration_file.js --no-execution
```

### Examples

Create a new migration:

```bash
npx emigrate new -d migrations create some fancy table
# or
pnpm emigrate new -d migrations create some fancy table
# or
yarn emigrate new -d migrations create some fancy table
# or
bunx --bun emigrate new -d migrations create some fancy table
```

Will create a new empty JavaScript migration file with the name "YYYYMMDDHHmmssuuu_create_some_fancy_table.js" in the `migrations` directory.

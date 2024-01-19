# Emigrate

> The modern, modular and flexible migration tool for any database

It's effectively a successor of [klei-migrate](https://www.npmjs.com/package/klei-migrate) and [Immigration](https://www.npmjs.com/package/immigration).

📖 Read the [documentation](https://emigrate.dev) for more information!

## Features

- Database agnostic
  - Emigrate can migrate any database
- Works at any scale
  - Supports any database as storage so multiple instances of the same app can share the same migration history
  - Supports multiple projects/apps doing migrations on the same database without interfering with each other
  - Uses smart locking to ensure only one instance migrates a certain migration at a time
  - Thanks to the smart locking it's safe to run migrations in parallel
- Can be run inside containers
  - It's common for Docker or Kubernetes to kill containers with health checks if migrations takes too long to run
  - Emigrate makes sure the migration history does not get stuck in a locked state if that's the case
- Supports any file type for your migration files
  - You can easily write migrations in JavaScript, TypeScript or plain SQL (or any other language)
  - JavaScript migration files written using CommonJS or ES modules (ESM) are supported out of the box
  - You can customize the template for your migration files to fit your needs (or use a plugin to do it for you)
- Easy to debug
  - Emigrate will store any errors that occur during migration in the migration history so you can easily debug them

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

Examples:

  emigrate up --directory src/migrations -s fs
  emigrate up -d ./migrations --storage @emigrate/mysql
  emigrate up -d src/migrations -s postgres -r json --dry
  emigrate up -d ./migrations -s mysql --import dotenv/config
  emigrate up --limit 1
  emigrate up --to 20231122120529381_some_migration_file.js
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

## License

Emigrate is licensed under the MIT license. See [LICENSE](LICENSE) for the full license text.

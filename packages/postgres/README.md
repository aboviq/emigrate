# @emigrate/postgres

A PostgreSQL plugin for Emigrate. Uses a PostgreSQL database for storing the migration history. Can load and generate .sql migration files.

The table used for storing the migration history is compatible with the [immigration-postgres](https://github.com/aboviq/immigration-postgres) package, so you can use this together with the [@emigrate/cli](../cli) as a drop-in replacement for that package.

## Description

This plugin is actually three different Emigrate plugins in one:

1. A [storage plugin](#using-the-storage-plugin) for storing the migration history in a PostgreSQL database.
2. A [loader plugin](#using-the-loader-plugin) for loading .sql migration files and be able to execute them as part of the migration process.
3. A [template plugin](#using-the-template-plugin) for generating .sql or .js and .ts migration files.

## Installation

Install the plugin in your project, alongside the Emigrate CLI:

```bash
npm install @emigrate/cli @emigrate/postgres
# or
pnpm add @emigrate/cli @emigrate/postgres
# or
yarn add @emigrate/cli @emigrate/postgres
# or
bun add @emigrate/cli @emigrate/postgres
```

## Usage

### Using the storage plugin

See [Options](#options) below for the default values and how to configure the plugin using environment variables.

Configure the storage in your `emigrate.config.js` file:

```js
export default {
  directory: 'migrations',
  storage: 'postgres', // the @emigrate/ prefix is optional
};
```

Or use the CLI options `--storage` (or `-s`)

```bash
emigrate up --storage postgres  # the @emigrate/ prefix is optional
```

#### Storage plugin with custom options

Configure the storage in your `emigrate.config.js` file by importing the `createPostgresStorage` function (see [Options](#options) for available options).

In this mode the plugin will _not_ use any of the environment variables for configuration.

```js
import { createPostgresStorage } from '@emigrate/postgres';

export default {
  directory: 'migrations',
  storage: createPostgresStorage({ table: 'migrations', connection: { ... } }), // All connection options are passed to postgres()
};
```

Or use the CLI option `--storage` (or `-s`) and use environment variables (see [Options](#options) for available variables).

```bash
POSTGRES_URL=postgres://user:pass@host/db emigrate up --storage postgres  # the @emigrate/ prefix is optional
```

### Using the loader plugin

The loader plugin is used to transform .sql migration files into JavaScript functions that can be executed by the "up" command.

See [Options](#options) below for the default values and how to configure the plugin using environment variables.

Configure the loader in your `emigrate.config.js` file:

```js
export default {
  directory: 'migrations',
  plugins: ['postgres'], // the @emigrate/ prefix is optional
};
```

Or by importing the default export from the plugin:

```js
import postgresPlugin from '@emigrate/postgres';

export default {
  directory: 'migrations',
  plugins: [postgresPlugin],
};
```

**NOTE:** Using the root level `plugins` option will load the plugin for all commands, which means the [template plugin](#using-the-template-plugin) will be used by default for the "new" command as well. If you only want to use the loader plugin, use the `up.plugins` option instead:

```js
export default {
  directory: 'migrations',
  up: {
    plugins: ['postgres'], // the @emigrate/ prefix is optional
    // or:
    plugins: [import('@emigrate/postgres')],
  },
};
```

The loader plugin can also be loaded using the CLI option `--plugin` (or `-p`) together with the "up" command:

```bash
emigrate up --plugin postgres  # the @emigrate/ prefix is optional
```

### Using the template plugin

The template plugin is used to generate skeleton .sql or .js and .ts migration files inside your migration directory.

Configure the template plugin in your `emigrate.config.js` file:

```js
export default {
  directory: 'migrations',
  plugins: ['postgres'], // the @emigrate/ prefix is optional
};
```

Or by importing the default export from the plugin:

```js
import postgresPlugin from '@emigrate/postgres';

export default {
  directory: 'migrations',
  plugins: [postgresPlugin],
};
```

Use the `extension` option or (`--extension` CLI option for the `new` command) to chose which of the three formats to use for the generated migration file:

- `.sql` - will generate a .sql migration file
- `.js` - will generate a .js migration file
- `.ts` - will generate a .ts migration file

The loader plugin will automatically figure out if it should be used for loading .js and .ts migration files instead of the built-in loader.  
It does this by checking if the migration file contains `@emigrate/postgres` or not, if it does it will use the loader plugin, otherwise Emigrate will use the built-in loader for `.js` and `.ts` files.

But remember to add `@emigrate/postgres` as a loader plugin for it to work.

**NOTE:** Using the root level `plugins` option will load the plugin for all commands, which means the [loader plugin](#using-the-loader-plugin) will be used by default for the "up" command as well. If you only want to use the template plugin, use the `new.plugins` option instead:

```js
export default {
  directory: 'migrations',
  new: {
    plugins: ['postgres'], // the @emigrate/ prefix is optional
    // or:
    plugins: [import('@emigrate/postgres')],
  },
};
```

The template plugin can also be loaded using the CLI option `--plugin` (or `-p`) together with the "new" command:

```bash
emigrate new --plugin postgres My new migration file  # the @emigrate/ prefix is optional
```

#### Loader plugin with custom options

Configure the loader in your `emigrate.config.js` file by importing the `createPostgresLoader` function (see [Options](#options) for available options).

In this mode the plugin will _not_ use any of the environment variables for configuration.

```js
import { createPostgresLoader } from '@emigrate/postgres';

export default {
  directory: 'migrations',
  plugins: [
    createPostgresLoader({ connection: { ... } }), // All connection options are passed to postgres()
  ],
};
```

## Options

The storage plugin accepts the following options:

| Option       | Applies to                 | Description                                                                                        | Default      | Environment variable                                                                                       |
| ------------ | -------------------------- | -------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| `table`      | storage plugin             | The name of the table to use for storing the migrations.                                           | `migrations` | `POSTGRES_TABLE`                                                                                           |
| `connection` | storage and loader plugins | The connection options to pass to [`postgres()`](https://github.com/porsager/postgres#connection). | `{}`         | `POSTGRES_URL` or `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` |

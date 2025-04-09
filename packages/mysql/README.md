# @emigrate/mysql

A MySQL plugin for Emigrate. Uses a MySQL database for storing the migration history. Can load and generate .sql migration files.

The table used for storing the migration history is compatible with the [immigration-mysql](https://github.com/joakimbeng/immigration-mysql) package, so you can use this together with the [@emigrate/cli](../cli) as a drop-in replacement for that package.

## Description

This plugin is actually three different Emigrate plugins in one:

1. A [storage plugin](#using-the-storage-plugin) for storing the migration history in a MySQL database.
2. A [loader plugin](#using-the-loader-plugin) for loading .sql migration files and be able to execute them as part of the migration process.
3. A [template plugin](#using-the-template-plugin) for generating .sql migration files.

## Installation

Install the plugin in your project, alongside the Emigrate CLI:

```bash
npm install @emigrate/cli @emigrate/mysql
# or
pnpm add @emigrate/cli @emigrate/mysql
# or
yarn add @emigrate/cli @emigrate/mysql
# or
bun add @emigrate/cli @emigrate/mysql
```

## Usage

### Using the storage plugin

See [Options](#options) below for the default values and how to configure the plugin using environment variables.

Configure the storage in your `emigrate.config.js` file:

```js
export default {
  directory: 'migrations',
  storage: 'mysql', // the @emigrate/ prefix is optional
};
```

Or use the CLI options `--storage` (or `-s`)

```bash
emigrate up --storage mysql  # the @emigrate/ prefix is optional
```

#### Storage plugin with custom options

Configure the storage in your `emigrate.config.js` file by importing the `createMysqlStorage` function (see [Options](#options) for available options).

In this mode the plugin will _not_ use any of the environment variables for configuration.

```js
import { createMysqlStorage } from '@emigrate/mysql';

export default {
  directory: 'migrations',
  storage: createMysqlStorage({ table: 'migrations', connection: { ... } }), // All connection options are passed to mysql.createConnection()
};
```

Or use the CLI option `--storage` (or `-s`) and use environment variables (see [Options](#options) for available variables).

```bash
MYSQL_URL=mysql://user:pass@host/db emigrate up --storage mysql  # the @emigrate/ prefix is optional
```

### Using the loader plugin

The loader plugin is used to transform .sql migration files into JavaScript functions that can be executed by the "up" command.

See [Options](#options) below for the default values and how to configure the plugin using environment variables.

Configure the loader in your `emigrate.config.js` file:

```js
export default {
  directory: 'migrations',
  plugins: ['mysql'], // the @emigrate/ prefix is optional
};
```

Or by importing the default export from the plugin:

```js
import mysqlPlugin from '@emigrate/mysql';

export default {
  directory: 'migrations',
  plugins: [mysqlPlugin],
};
```

**NOTE:** Using the root level `plugins` option will load the plugin for all commands, which means the [template plugin](#using-the-template-plugin) will be used by default for the "new" command as well. If you only want to use the loader plugin, use the `up.plugins` option instead:

```js
export default {
  directory: 'migrations',
  up: {
    plugins: ['mysql'], // the @emigrate/ prefix is optional
    // or:
    plugins: [import('@emigrate/mysql')],
  },
};
```

The loader plugin can also be loaded using the CLI option `--plugin` (or `-p`) together with the "up" command:

```bash
emigrate up --plugin mysql  # the @emigrate/ prefix is optional
```

### Using the template plugin

The template plugin is used to generate skeleton .sql migration files inside your migration directory.

Configure the template plugin in your `emigrate.config.js` file:

```js
export default {
  directory: 'migrations',
  plugins: ['mysql'], // the @emigrate/ prefix is optional
};
```

Or by importing the default export from the plugin:

```js
import mysqlPlugin from '@emigrate/mysql';

export default {
  directory: 'migrations',
  plugins: [mysqlPlugin],
};
```

**NOTE:** Using the root level `plugins` option will load the plugin for all commands, which means the [loader plugin](#using-the-loader-plugin) will be used by default for the "up" command as well. If you only want to use the template plugin, use the `new.plugins` option instead:

```js
export default {
  directory: 'migrations',
  new: {
    plugins: ['mysql'], // the @emigrate/ prefix is optional
    // or:
    plugins: [import('@emigrate/mysql')],
  },
};
```

The template plugin can also be loaded using the CLI option `--plugin` (or `-p`) together with the "new" command:

```bash
emigrate new --plugin mysql My new migration file  # the @emigrate/ prefix is optional
```

#### Loader plugin with custom options

Configure the loader in your `emigrate.config.js` file by importing the `createMysqlLoader` function (see [Options](#options) for available options).

In this mode the plugin will _not_ use any of the environment variables for configuration.

```js
import { createMysqlLoader } from '@emigrate/mysql';

export default {
  directory: 'migrations',
  plugins: [
    createMysqlLoader({ connection: { ... } }), // All connection options are passed to mysql.createConnection()
  ],
};
```

## Options

The storage plugin accepts the following options:

| Option       | Applies to                 | Description                                                                                                          | Default      | Environment variable                                                                           |
| ------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| `table`      | storage plugin             | The name of the table to use for storing the migrations.                                                             | `migrations` | `MYSQL_TABLE`                                                                                  |
| `connection` | storage and loader plugins | The connection options to pass to [`mysql.createConnection()`](https://github.com/mysqljs/mysql#connection-options). | `{}`         | `MYSQL_URL` or `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD` and `MYSQL_DATABASE` |

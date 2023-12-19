# @emigrate/reporter-pino

A [Pino](https://getpino.io/#/) reporter for Emigrate which logs the migration progress using line delimited JSON by default.  
Which is great both in production environments and for piping the output to other tools.

## Installation

Install the reporter in your project, alongside the Emigrate CLI:

```bash
npm install @emigrate/cli @emigrate/reporter-pino
# or
pnpm add @emigrate/cli @emigrate/reporter-pino
# or
yarn add @emigrate/cli @emigrate/reporter-pino
# or
bun add @emigrate/cli @emigrate/reporter-pino
```

## Usage

### With default options

Configure the reporter in your `emigrate.config.js` file:

```js
import reporterPino from '@emigrate/reporter-pino';

export default {
  directory: 'migrations',
  reporter: reporterPino,
};
```

Or simply:

```js
export default {
  directory: 'migrations',
  reporter: 'pino', // the @emigrate/reporter- prefix is optional
};
```

Or use the CLI option `--reporter` (or `-r`):

```bash
emigrate up --reporter pino  # the @emigrate/reporter- prefix is optional
```

### With custom options

Configure the reporter in your `emigrate.config.js` file:

```js
import { createPinoReporter } from '@emigrate/reporter-pino';

export default {
  directory: 'migrations',
  reporter: createPinoReporter({
    level: 'error', // default is 'info'
    errorKey: 'err', // default is 'error'
  }),
};
```

The log level can also be set using the `LOG_LEVEL` environment variable:

```bash
LOG_LEVEL=error emigrate up -r pino
```

# @emigrate/storage-fs

A file system storage plugin for Emigrate, suitable for simple migration setups. To support containerized environments, it is recommended to use a database storage plugin instead.

## Installation

Install the storage plugin in your project, alongside the Emigrate CLI:

```bash
npm install --save-dev @emigrate/cli @emigrate/storage-fs
```

## Usage

Configure the storage in your `emigrate.config.js` file:

```js
import storageFs from '@emigrate/storage-fs';

export default {
  directory: 'migrations',
  storage: storageFs({ filename: '.migrated.json' }),
};
```

Or use the CLI option `--storage` (or `-s`):

```bash
emigrate up --storage fs  # the @emigrate/storage- prefix is optional
```

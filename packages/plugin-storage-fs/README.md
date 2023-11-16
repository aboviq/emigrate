# @emigrate/plugin-storage-fs

A file system storage plugin for Emigrate, suitable for simple migration setups. To support containerized environments, it is recommended to use a database storage plugin instead.

## Installation

Install the plugin in your project, alongside the Emigrate CLI:

```bash
npm install --save-dev @emigrate/cli @emigrate/plugin-storage-fs
```

## Usage

Configure the plugin in your `emigrate.config.js` file:

```js
import storageFs from '@emigrate/plugin-storage-fs';

export default {
  directory: 'migrations',
  plugins: [storageFs({ filename: '.migrated.json' })],
};
```

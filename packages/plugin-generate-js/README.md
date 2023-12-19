# @emigrate/plugin-generate-js

This package contains an Emigrate plugin for generating migration files using JavaScript as a language.

## Usage

Install the package:

```bash
npm install @emigrate/cli @emigrate/plugin-generate-js
# or
pnpm add @emigrate/cli @emigrate/plugin-generate-js
# or
yarn add @emigrate/cli @emigrate/plugin-generate-js
# or
bun add @emigrate/cli @emigrate/plugin-generate-js
```

Use the plugin with the `emigrate new` command:

```bash
emigrate new --plugin generate-js create some fancy table
```

Or add it to your `emigrate.config.js` file:

```js
import generateJs from '@emigrate/plugin-generate-js';

export default {
  directory: 'migrations',
  plugins: [generateJs],
};
```

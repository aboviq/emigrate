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

# @emigrate/cli

Emigrate is a tool for managing database migrations. It is designed to be simple yet support advanced setups, modular and extensible.

## Installation

Install the Emigrate CLI in your project:

```bash
npm install --save-dev @emigrate/cli
```

## Usage

Create a new migration:

```bash
emigrate new -d migrations -e .js create some fancy table
```

Will create a new empty JavaScript migration file with the name "YYYYMMDDHHmmssuuu_create_some_fancy_table.js" in the `migrations` directory.

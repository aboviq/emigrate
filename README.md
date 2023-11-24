# Emigrate

> The modern, modular and flexible migration tool for any database

It's effectively a successor of [klei-migrate](https://www.npmjs.com/package/klei-migrate) and [Immigration](https://www.npmjs.com/package/immigration).

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
npm install --save-dev @emigrate/cli
```

## Usage

Create a new migration:

```bash
emigrate new -d migrations -e .js create some fancy table
```

Will create a new empty JavaScript migration file with the name "YYYYMMDDHHmmssuuu_create_some_fancy_table.js" in the `migrations` directory.

## License

Emigrate is licensed under the MIT license. See [LICENSE](LICENSE) for the full license text.

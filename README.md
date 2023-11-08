# Emigrate

> The modern, modular and flexible migration tool for any database

It's effectively a successor of [klei-migrate](https://www.npmjs.com/package/klei-migrate) and [Immigration](https://www.npmjs.com/package/immigration).

## Features

- Database agnostic
  - Emigrate can migrate any database
- Works at any scale
  - Supports any database as storage so multiple instances can share the same migration history
  - Uses smart locking to ensure only one instance migrates a certain migration at a time
  - Thanks to the smart locking it's safe to run migrations in parallel
- Can be run inside containers
  - It's common for Docker or Kubernetes to kill containers with health checks if migrations takes too long to run
  - Emigrate makes sure the migration history does not get stuck in a locked state if that's the case
- Supports any file type for your migration files
  - You can easily write migrations in JavaScript, TypeScript or plain SQL (or any other language)
  - You can customize the template for your migration files to fit your needs (or use a plugin to do it for you)
- Easy to debug
  - Emigrate will store any errors that occur during migration in the migration history so you can easily debug them

## License

Emigrate is licensed under the MIT license. See [LICENSE](LICENSE) for the full license text.

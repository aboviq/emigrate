# @emigrate/cli

## 0.18.4

### Patch Changes

- d779286: Upgrade TypeScript to v5.5 and enable [isolatedDeclarations](https://devblogs.microsoft.com/typescript/announcing-typescript-5-5/#isolated-declarations)
- Updated dependencies [d779286]
  - @emigrate/plugin-tools@0.9.8
  - @emigrate/types@0.12.2

## 0.18.3

### Patch Changes

- ca154fa: Minimize package size by excluding \*.tsbuildinfo files
- Updated dependencies [ca154fa]
  - @emigrate/plugin-tools@0.9.7
  - @emigrate/types@0.12.2

## 0.18.2

### Patch Changes

- 4152209: Handle the case where the config is returned as an object with a nested `default` property

## 0.18.1

### Patch Changes

- 57a0991: Cleanup AbortSignal listeners when they are not needed to avoid MaxListenersExceededWarning when migrating many migrations at once

## 0.18.0

### Minor Changes

- c838ffb: Make it possible to write the Emigrate configuration file in TypeScript and load it using `tsx` in a NodeJS environment by importing packages provided using the `--import` CLI option before loading the configuration file. This makes it possible to run Emigrate in production with a configuration file written in TypeScript without having the `typescript` package installed.
- 18382ce: Add a built-in "json" reporter for outputting a single JSON object
- 18382ce: Rename the "default" reporter to "pretty" and make it possible to specify it using the `--reporter` CLI option or in the configuration file

### Patch Changes

- c838ffb: Don't use the `typescript` package for loading an Emigrate configuration file written in TypeScript in a Bun or Deno environment

## 0.17.2

### Patch Changes

- 61cbcbd: Force exiting after 10 seconds should not change the exit code, i.e. if all migrations have run successfully the exit code should be 0

## 0.17.1

### Patch Changes

- 543b7f6: Use setTimeout/setInterval from "node:timers" so that .unref() correctly works with Bun
- db656c2: Enable NPM provenance
- Updated dependencies [db656c2]
  - @emigrate/plugin-tools@0.9.6
  - @emigrate/types@0.12.1

## 0.17.0

### Minor Changes

- 0faebbe: Add support for passing the relative path to a migration file to remove from the history using the "remove" command
- 9109238: When the `--from` or `--to` CLI options are used the given migration name (or path to migration file) must exist. This is a BREAKING CHANGE from before. The reasoning is that by forcing the migrations to exist you avoid accidentally running migrations you don't intend to, because a simple typo could have the effect that many unwanted migrations is executed so it's better to show an error if that's the case.
- 1f139fd: Completely rework how the "remove" command is run, this is to make it more similar to the "up" and "list" command as now it will also use the `onMigrationStart`, `onMigrationSuccess` and `onMigrationError` reporter methods when reporting the command progress. It's also in preparation for adding `--from` and `--to` CLI options for the "remove" command, similar to how the same options work for the "up" command.
- 9109238: Add support for passing relative paths to migration files as the `--from` and `--to` CLI options. This is very useful from terminals that support autocomplete for file paths. It also makes it possible to copy the path to a migration file from Emigrate's output and use that as either `--from` and `--to` directly.

### Patch Changes

- f1b9098: Only include files when collecting migrations, i.e. it should be possible to have folders inside your migrations folder.
- 2f6b4d2: Don't dim decimal points in durations in the default reporter
- f2d4bb3: Set Emigrate error instance names from their respective constructor's name for consistency and correct error deserialization.
- ef45be9: Show number of skipped migrations correctly in the command output
- Updated dependencies [94ad9fe]
  - @emigrate/types@0.12.0
  - @emigrate/plugin-tools@0.9.5

## 0.16.2

### Patch Changes

- b56b6da: Handle migration history entries without file extensions for migration files with periods in their names that are not part of the file extension. Previously Emigrate would attempt to re-run these migrations, but now it will correctly ignore them. E.g. the migration history contains an entry for "migration.file.name" and the migration file is named "migration.file.name.js" it will not be re-run.

## 0.16.1

### Patch Changes

- 121492b: Sort migration files lexicographically correctly by using the default Array.sort implementation

## 0.16.0

### Minor Changes

- a4da353: Handle process interruptions gracefully, e.g. due to receiving a SIGINT or SIGTERM signal. If a migration is currently running when the process is about to shutdown it will have a maximum of 10 more seconds to finish before being deserted (there's no way to cancel a promise sadly, and many database queries are not easy to abort either). The 10 second respite length can be customized using the --abort-respite CLI option or the abortRespite config.

### Patch Changes

- Updated dependencies [ce15648]
  - @emigrate/types@0.11.0
  - @emigrate/plugin-tools@0.9.4

## 0.15.0

### Minor Changes

- f515c8a: Add support for the --no-execution option to the "up" command to be able to log migrations as successful without actually running them. Can for instance be used for baselining a database or logging manually run migrations as successful.
- 9ef0fa2: Add --from and --to CLI options to control which migrations to include or skip when executing migrations.
- 02c142e: Add --limit option to the "up" command, for limiting the number of migrations to run

### Patch Changes

- bf4d596: Clarify which cli options that needs parameters
- 98adcda: Use better wording in the header in the console output from the default reporter

## 0.14.1

### Patch Changes

- 73a8a42: Support stored migration histories that have only stored the migration file names without file extension and assume it's .js files in that case. This is to be compatible with a migration history generated by Immigration.

## 0.14.0

### Minor Changes

- b083e88: Upgrade cosmiconfig to 9.0.0

## 0.13.1

### Patch Changes

- 83dc618: Remove the --enable-source-maps flag from the shebang for better NodeJS compatibility

## 0.13.0

### Minor Changes

- 9a605a8: Add support for loading TypeScript migration files in the default loader
- 9a605a8: Add a guide for running migration files written in TypeScript to the documentation

## 0.12.0

### Minor Changes

- 9f91bdc: Add support for the `--import` option to import modules/packages before any command is run. This can for instance be used to load environment variables using the [dotenv](https://github.com/motdotla/dotenv) package with `--import dotenv/config`.
- f9a16d8: Add `color` option to the CLI and configuration file, which is used to force enable/disable color output from the reporter (the option is passed to the chosen reporter which should respect it)
- e6e4433: BREAKING CHANGE: Rename the `extension` short CLI option from `-e` to `-x` in preparation for an upcoming option that will take its place

### Patch Changes

- Updated dependencies [f9a16d8]
  - @emigrate/types@0.10.0
  - @emigrate/plugin-tools@0.9.3

## 0.11.2

### Patch Changes

- Updated dependencies [a6c6e6d]
  - @emigrate/types@0.9.1
  - @emigrate/plugin-tools@0.9.2

## 0.11.1

### Patch Changes

- Updated dependencies [3a8b06b]
  - @emigrate/plugin-tools@0.9.1

## 0.11.0

### Minor Changes

- ce6946c: Emigrate supports Bun, make use of the `bun` key in package.json `exports`

### Patch Changes

- Updated dependencies [ce6946c]
  - @emigrate/plugin-tools@0.9.0
  - @emigrate/types@0.9.0

## 0.10.0

### Minor Changes

- cae6d11: Make Emigrate Error instances deserializable using the serialize-error package, and also switch to its serializeError method
- cae6d11: Adapt to the new discriminating union types in @emigrate/types

### Patch Changes

- cae6d11: Shutdown the storage correctly in case of directory or file reading errors
- Updated dependencies [cae6d11]
- Updated dependencies [cae6d11]
- Updated dependencies [cae6d11]
  - @emigrate/types@0.8.0
  - @emigrate/plugin-tools@0.8.0

## 0.9.0

### Minor Changes

- 1434be5: The default reporter now prints the relative path instead of only the migration file name when logging migrations. Thanks to this most shells supports opening the corresponding migration file by clicking it.
- 1434be5: Print Emigrate CLI version when using the default reporter

## 0.8.0

### Minor Changes

- bad4e25: Pass the Emigrate CLI's version number to reporters
- 960ce08: Add --help and --version options to main command

### Patch Changes

- Updated dependencies [bad4e25]
  - @emigrate/plugin-tools@0.7.0

## 0.7.0

### Minor Changes

- bc33e63: Improve error logging in the default reporter so that all "own properties" of errors are logged

### Patch Changes

- a79f8e8: Serialization of errors now happens inside storage plugins because it makes more sense and the types are easier to work with this way
- 5307e87: Only log info about locked migrations in the "up" command, as "list" doesn't do any locking
- Updated dependencies [a79f8e8]
- Updated dependencies [a79f8e8]
  - @emigrate/plugin-tools@0.6.0

## 0.6.0

### Minor Changes

- a8db226: Handle storage initialization errors and show missing loader plugin errors in a better way
- c1d5597: Serialize errors before passing them to the storage so that storage plugins doesn't have to care about serialization of errors
- 703e6f0: Call storage.end() to cleanup resources when a command has finished

### Patch Changes

- 703e6f0: Handle storage initialization errors in the "list" and "remove" commands
- Updated dependencies [703e6f0]
- Updated dependencies [c1d5597]
  - @emigrate/plugin-tools@0.5.0

## 0.5.1

### Patch Changes

- Updated dependencies [20ed2e8]
- Updated dependencies [d916043]
  - @emigrate/plugin-tools@0.4.1

## 0.5.0

### Minor Changes

- 8347fc1: Show any failed migration from the history in the "up" dry-run output
- cf17e48: Enable source maps when running the Emigrate CLI
- 53cdb23: Implement the "list" command for listing the full migration history and any pending migrations
- 8e87ade: Move storages and reporters out from the plugin option into their own separate options (i.e. "--reporter" and "--storage" respectively). This makes it easier to change the interfaces of storages and reporters, and it's also more similar to other tools.
- da1eee3: Add "reporter" option for the "new" command and use it for improved logging
- 8347fc1: Improve the looks of the "up" dry-run default output by showing pending migrations in a different color
- d8a6a24: Implement the "remove" command for removing migration entries from the history
- c68c6f0: Include Emigrate error codes in the error names
- 8f623ef: Allow running commands no matter of the provided command's letter casing

### Patch Changes

- 8347fc1: Return a non zero exit code in case a migration fails (or for a dry-run if there's a failed migration in the history)
- 570bd1f: The default reporter now prints the full command output once a command is done (in interactive mode) so that the full output is visible no matter the size of the terminal window.
- 8347fc1: Don't pass the EmigrateError instance to the storage for each failed migration but only the real cause. This is so that errors from failed migrations are not wrapped twice in EmigrateError instances when presenting failed migrations during an "up" dry-run or the "list" command.
- 9447d28: Ignore migration history entries not belonging to the current migration directory when considering what to list or execute. This way a project can have multiple folders with different kind of migration sets or multiple projects can share the same migration history without any of them conflicting or blocking each other in case of failed migrations.
- b57c86e: Only load the JavaScript loader plugin if necessary
- 1940885: Remove the double period before the file extension when generating new migration files
- Updated dependencies [5e8572b]
- Updated dependencies [8e87ade]
- Updated dependencies [60ae3b8]
- Updated dependencies [672fae1]
- Updated dependencies [d8a6a24]
- Updated dependencies [acb0b4f]
  - @emigrate/plugin-tools@0.4.0

## 0.4.0

### Minor Changes

- 59ec16b: Make the dry run mode work for the "up" command using the "--dry" CLI option
- 59ec16b: Improve the default reporter with good looking output that has colors and animations. In non-interactive environments the animations are not used (this includes CI environments).
- 59ec16b: Improve the "up" command flow and the usage of reporters, handle migration errors and automatic skipping of migrations.
- 8f35812: Add support for "reporter" plugins and implement a simple default reporter

### Patch Changes

- Updated dependencies [8f35812]
  - @emigrate/plugin-tools@0.3.0

## 0.3.0

### Minor Changes

- 8dadfe9: Support migration functions using the old NodeJS callback style API, i.e. accepting a callback as a single parameter which in turns takes any error as its first parameter (any other parameters are ignored)
- a058ebf: Handle file extensions with or without a leading period, i.e. `emigrate new -e .js ...` is now the same as `emigrate new -e js ...`
- b56794a: Implement the "up" command with support for "storage" and "loader" plugins
- 0b78d5c: Rename the "emigrate" package to "@emigrate/cli" to mimic other tools
- 30a448b: Improve error handling by making more granular custom Error instances
- 3b36b3d: Implement a default "loader" plugin for JavaScript files (supports `.js`, `.cjs` and `.mjs` file extensions)
- 9f5abf7: Simplify plugin interfaces by getting rid of the "type" string, in preparation for having packages that contains multiple different plugins

### Patch Changes

- 46b9104: Don't run any migrations if there's a failed migration in the migration history
- 3e0ff07: Specify files to include in published NPM package
- a1debba: Fix a logical error that didn't allow creating new migration files with only the "extension" option
- Updated dependencies [1799b6e]
- Updated dependencies [3e0ff07]
- Updated dependencies [23a323c]
- Updated dependencies [62bd5a4]
- Updated dependencies [81fde2e]
- Updated dependencies [9f5abf7]
  - @emigrate/plugin-tools@0.2.0

## 0.2.1

### Patch Changes

- 50fce0a: Add some simple README's for each package and add homepage, repository and bugs URLs to each package.json file
- Updated dependencies [50fce0a]
  - @emigrate/plugin-tools@0.1.1

## 0.2.0

### Minor Changes

- aa87800: Add the "extension" option for the "new" command to be able to generate empty migration files without any plugin and template and still get the right file extension. It can also be used together with the "template" option to override the template file's file extension when saving the new migration file.
- aa87800: Support reading config from for instance emigrate.config.js

## 0.1.0

### Minor Changes

- ca3ab9e: Add template support for the "new" migration command
- 9c239e0: Automatically prefix plugin names when loading them if necessary. I.e. when specifying only "--plugin generate-js" Emigrate will load the @emigrate/plugin-generate-js plugin. It has a priority order that is: 1. the provided plugin name as is, 2. the name prefixed with "@emigrate/plugin-", 3. the name prefixed with "emigrate-plugin-"

### Patch Changes

- Updated dependencies [cdafd05]
- Updated dependencies [9c239e0]
- Updated dependencies [1634094]
  - @emigrate/plugin-tools@0.1.0

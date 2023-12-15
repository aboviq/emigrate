# @emigrate/cli

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

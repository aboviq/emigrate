# emigrate

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

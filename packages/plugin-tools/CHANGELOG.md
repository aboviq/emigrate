# @emigrate/plugin-tools

## 0.2.0

### Minor Changes

- 23a323c: Add the convenience functions `getOrLoadPlugin` and `getOrLoadPlugins`
- 62bd5a4: Add more properties to the MigrationMetadata type to ease writing "loader" plugins
- 81fde2e: Prepare for supporting "loader" plugins. A loader plugin is used to transform a migration file of a given type (file extension) to a function that will execute the actual migration.
- 9f5abf7: Simplify plugin interfaces by getting rid of the "type" string, in preparation for having packages that contains multiple different plugins

### Patch Changes

- 1799b6e: Add missing types and utility methods related to the new "loader" plugins
- 3e0ff07: Specify files to include in published NPM package

## 0.1.1

### Patch Changes

- 50fce0a: Add some simple README's for each package and add homepage, repository and bugs URLs to each package.json file

## 0.1.0

### Minor Changes

- cdafd05: First version of the @emigrate/plugin-tools package which contains some nice to have utilities when building and using Emigrate plugins
- 9c239e0: Use import-from-esm to resolve plugins relative to the current working directory and add a convenient plugin loader helper (loadPlugin)

### Patch Changes

- 1634094: Remove double and trailing underscores in sanitized filenames and lower case the result for consistent filenames

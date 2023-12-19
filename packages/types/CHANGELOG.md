# @emigrate/types

## 0.9.1

### Patch Changes

- a6c6e6d: Remove the `bun` exports config in this package as well

## 0.9.0

### Minor Changes

- ce6946c: Emigrate supports Bun, make use of the `bun` key in package.json `exports`

## 0.8.0

### Minor Changes

- cae6d11: Use discriminating union types for migration types for easier error handling and such
- cae6d11: Move the Emigrate plugin types to a separate package for fewer version bumps in plugins hopefully
- cae6d11: Make it easier for storage plugins by serializing errors passed to the onError method and let it respond with serialized errors in the getHistory method

## 0.7.0

### Minor Changes

- bad4e25: Pass the Emigrate CLI's version number to reporters

## 0.6.0

### Minor Changes

- a79f8e8: When serializing errors take all "own properties" into account to be able to serialize errors thrown by the `mysql2` package for instance without losing any information

### Patch Changes

- a79f8e8: Serialization of errors now happens inside storage plugins because it makes more sense and the types are easier to work with this way

## 0.5.0

### Minor Changes

- 703e6f0: Add "end" method to storage plugins so they can cleanup resources when a command is finished
- c1d5597: Add serializeError utility function for serializing Error instances

## 0.4.1

### Patch Changes

- 20ed2e8: Try importing plugins (and reporters) using prefixes before importing without, this is to avoid issue with accidentaly importing other non-emigrate related packages. E.g. setting the reporter to "pino" would import the "pino" package without this fix and will import "@emigrate/reporter-pino" with this fix.
- d916043: Fix a regression issue where plugins wasn't correctly loaded if specified as strings

## 0.4.0

### Minor Changes

- 5e8572b: Pass the current command to the reporter
- 8e87ade: Move storages and reporters out from the plugin option into their own separate options (i.e. "--reporter" and "--storage" respectively). This makes it easier to change the interfaces of storages and reporters, and it's also more similar to other tools.
- 672fae1: Include "@emigrate/" in the plugin prefix list, i.e. when searching for the plugin "blaha" it will look for the packages "blaha", "@emigrate/blaha", "@emigrate/plugin-blaha" and "emigrate-plugin-blaha" and use the first of them that exists
- d8a6a24: Implement the "remove" command for removing migration entries from the history

### Patch Changes

- 60ae3b8: Fix loading of lazy loaded plugins with default exports
- acb0b4f: Keep upper cased letters in migration file names by default

## 0.3.0

### Minor Changes

- 8f35812: Add support for "reporter" plugins and implement a simple default reporter

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

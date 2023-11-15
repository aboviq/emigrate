# emigrate

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

# emigrate

## 0.1.0

### Minor Changes

- ca3ab9e: Add template support for the "new" migration command
- 9c239e0: Automatically prefix plugin names when loading them if necessary. I.e. when specifying only "--plugin generate-js" Emigrate will load the @emigrate/plugin-generate-js plugin. It has a priority order that is: 1. the provided plugin name as is, 2. the name prefixed with "@emigrate/plugin-", 3. the name prefixed with "emigrate-plugin-"

### Patch Changes

- Updated dependencies [cdafd05]
- Updated dependencies [9c239e0]
- Updated dependencies [1634094]
  - @emigrate/plugin-tools@0.1.0

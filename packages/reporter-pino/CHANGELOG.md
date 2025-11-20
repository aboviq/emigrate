# @emigrate/reporter-pino

## 0.6.6

### Patch Changes

- Updated dependencies [4e181d9]
- Updated dependencies [d49da0c]
  - @emigrate/types@1.0.0

## 0.6.5

### Patch Changes

- d779286: Upgrade TypeScript to v5.5 and enable [isolatedDeclarations](https://devblogs.microsoft.com/typescript/announcing-typescript-5-5/#isolated-declarations)
  - @emigrate/types@0.12.2

## 0.6.4

### Patch Changes

- ca154fa: Minimize package size by excluding \*.tsbuildinfo files
- Updated dependencies [ca154fa]
  - @emigrate/types@0.12.2

## 0.6.3

### Patch Changes

- 081ab34: Make sure Pino outputs logs in Bun environments

## 0.6.2

### Patch Changes

- 1065322: Show correct status for migrations for the "list" and "new" commands

## 0.6.1

### Patch Changes

- db656c2: Enable NPM provenance
- Updated dependencies [db656c2]
  - @emigrate/types@0.12.1

## 0.6.0

### Minor Changes

- 86e0d52: Adapt to the new Reporter interface, i.e. the removal of the "remove" command related methods

### Patch Changes

- ef45be9: Show number of skipped migrations correctly in the command output
- Updated dependencies [94ad9fe]
  - @emigrate/types@0.12.0

## 0.5.0

### Minor Changes

- a4da353: Handle the new onAbort method

### Patch Changes

- Updated dependencies [ce15648]
  - @emigrate/types@0.11.0

## 0.4.3

### Patch Changes

- Updated dependencies [f9a16d8]
  - @emigrate/types@0.10.0

## 0.4.2

### Patch Changes

- Updated dependencies [a6c6e6d]
  - @emigrate/types@0.9.1

## 0.4.1

### Patch Changes

- 3a8b06b: Don't use the `bun` key in `exports` as that would mean we have to include both built files and source files in each package, which is a bit wasteful. Maybe reconsider in the future if we can package only source files.

## 0.4.0

### Minor Changes

- ce6946c: Emigrate supports Bun, make use of the `bun` key in package.json `exports`

### Patch Changes

- Updated dependencies [ce6946c]
  - @emigrate/types@0.9.0

## 0.3.1

### Patch Changes

- Updated dependencies [cae6d11]
- Updated dependencies [cae6d11]
- Updated dependencies [cae6d11]
  - @emigrate/types@0.8.0

## 0.3.0

### Minor Changes

- 1434be5: Include the Emigrate CLI's version number in each log

## 0.2.1

### Patch Changes

- Updated dependencies [bad4e25]
  - @emigrate/plugin-tools@0.7.0

## 0.2.0

### Minor Changes

- 09181f2: Only log the relative file path to the migration instead of the full metadata object

### Patch Changes

- 5307e87: Only log info about locked migrations in the "up" command, as "list" doesn't do any locking
- Updated dependencies [a79f8e8]
- Updated dependencies [a79f8e8]
  - @emigrate/plugin-tools@0.6.0

## 0.1.1

### Patch Changes

- Updated dependencies [703e6f0]
- Updated dependencies [c1d5597]
  - @emigrate/plugin-tools@0.5.0

## 0.1.0

### Minor Changes

- 3619d86: Implement the first version of the Pino reporter package

### Patch Changes

- Updated dependencies [20ed2e8]
- Updated dependencies [d916043]
  - @emigrate/plugin-tools@0.4.1

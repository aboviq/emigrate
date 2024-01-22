# @emigrate/mysql

## 0.2.4

### Patch Changes

- Updated dependencies [ce15648]
  - @emigrate/types@0.11.0
  - @emigrate/plugin-tools@0.9.4

## 0.2.3

### Patch Changes

- Updated dependencies [f9a16d8]
  - @emigrate/types@0.10.0
  - @emigrate/plugin-tools@0.9.3

## 0.2.2

### Patch Changes

- Updated dependencies [a6c6e6d]
  - @emigrate/types@0.9.1
  - @emigrate/plugin-tools@0.9.2

## 0.2.1

### Patch Changes

- 3a8b06b: Don't use the `bun` key in `exports` as that would mean we have to include both built files and source files in each package, which is a bit wasteful. Maybe reconsider in the future if we can package only source files.
- Updated dependencies [3a8b06b]
  - @emigrate/plugin-tools@0.9.1

## 0.2.0

### Minor Changes

- ce6946c: Emigrate supports Bun, make use of the `bun` key in package.json `exports`

### Patch Changes

- Updated dependencies [ce6946c]
  - @emigrate/plugin-tools@0.9.0
  - @emigrate/types@0.9.0

## 0.1.3

### Patch Changes

- Updated dependencies [cae6d11]
- Updated dependencies [cae6d11]
- Updated dependencies [cae6d11]
  - @emigrate/types@0.8.0
  - @emigrate/plugin-tools@0.8.0

## 0.1.2

### Patch Changes

- Updated dependencies [bad4e25]
  - @emigrate/plugin-tools@0.7.0

## 0.1.1

### Patch Changes

- a79f8e8: Serialization of errors now happens inside storage plugins because it makes more sense and the types are easier to work with this way
- Updated dependencies [a79f8e8]
- Updated dependencies [a79f8e8]
  - @emigrate/plugin-tools@0.6.0

## 0.1.0

### Minor Changes

- 334e209: Implement the first version of the MySQL plugin package. It's three plugins in one: a storage plugin for storing migration history in a MySQL database, a loader plugin for executing migration files written in plain sql and a generator plugin for generating migration file skeletons with the .sql extension.

### Patch Changes

- 703e6f0: Fix issue with closing the connection pool too early
- Updated dependencies [703e6f0]
- Updated dependencies [c1d5597]
  - @emigrate/plugin-tools@0.5.0

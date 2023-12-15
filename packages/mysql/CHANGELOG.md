# @emigrate/mysql

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

# @emigrate/mysql

## 0.1.0

### Minor Changes

- 334e209: Implement the first version of the MySQL plugin package. It's three plugins in one: a storage plugin for storing migration history in a MySQL database, a loader plugin for executing migration files written in plain sql and a generator plugin for generating migration file skeletons with the .sql extension.

### Patch Changes

- 703e6f0: Fix issue with closing the connection pool too early
- Updated dependencies [703e6f0]
- Updated dependencies [c1d5597]
  - @emigrate/plugin-tools@0.5.0

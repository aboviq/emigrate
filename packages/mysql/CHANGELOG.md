# @emigrate/mysql

## 0.3.3

### Patch Changes

- 26240f4: Make sure we can initialize multiple running instances of Emigrate using @emigrate/mysql concurrently without issues with creating the history table (for instance in a Kubernetes environment and/or with a Percona cluster).
- d779286: Upgrade TypeScript to v5.5 and enable [isolatedDeclarations](https://devblogs.microsoft.com/typescript/announcing-typescript-5-5/#isolated-declarations)
- 26240f4: Either lock all or none of the migrations to run to make sure they run in order when multiple instances of Emigrate runs concurrently (for instance in a Kubernetes environment)
- Updated dependencies [d779286]
  - @emigrate/plugin-tools@0.9.8
  - @emigrate/types@0.12.2

## 0.3.2

### Patch Changes

- 57498db: Unreference all connections when run using Bun, to not keep the process open unnecessarily long

## 0.3.1

### Patch Changes

- ca154fa: Minimize package size by excluding \*.tsbuildinfo files
- Updated dependencies [ca154fa]
  - @emigrate/plugin-tools@0.9.7
  - @emigrate/types@0.12.2

## 0.3.0

### Minor Changes

- 4442604: Automatically create the database if it doesn't exist, and the user have the permissions to do so

### Patch Changes

- aef2d7c: Avoid "CREATE TABLE IF NOT EXISTS" as it's too locking in a clustered database when running it concurrently

## 0.2.8

### Patch Changes

- 17feb2d: Only unreference connections in a Bun environment as it crashes Node for some reason, without even throwing an error that is

## 0.2.7

### Patch Changes

- 198aa54: Unreference all connections automatically so that they don't hinder the process from exiting. This is especially needed in Bun environments as it seems to handle sockets differently regarding this matter than NodeJS.

## 0.2.6

### Patch Changes

- db656c2: Enable NPM provenance
- Updated dependencies [db656c2]
  - @emigrate/plugin-tools@0.9.6
  - @emigrate/types@0.12.1

## 0.2.5

### Patch Changes

- f8a5cc7: Make sure the storage initialization crashes when a database connection can't be established
- Updated dependencies [94ad9fe]
  - @emigrate/types@0.12.0
  - @emigrate/plugin-tools@0.9.5

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

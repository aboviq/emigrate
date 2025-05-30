# @emigrate/postgres

## 0.3.2

### Patch Changes

- d779286: Upgrade TypeScript to v5.5 and enable [isolatedDeclarations](https://devblogs.microsoft.com/typescript/announcing-typescript-5-5/#isolated-declarations)
- Updated dependencies [d779286]
  - @emigrate/plugin-tools@0.9.8
  - @emigrate/types@0.12.2

## 0.3.1

### Patch Changes

- ca154fa: Minimize package size by excluding \*.tsbuildinfo files
- Updated dependencies [ca154fa]
  - @emigrate/plugin-tools@0.9.7
  - @emigrate/types@0.12.2

## 0.3.0

### Minor Changes

- 4442604: Automatically create the database if it doesn't exist, and the user have the permissions to do so

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

## 0.1.0

### Minor Changes

- 17c4723: Implement the first version of the @emigrate/postgres plugin

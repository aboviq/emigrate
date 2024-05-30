# @emigrate/plugin-generate-js

## 0.3.7

### Patch Changes

- Updated dependencies [ca154fa]
  - @emigrate/plugin-tools@0.9.7
  - @emigrate/types@0.12.2

## 0.3.6

### Patch Changes

- Updated dependencies [db656c2]
  - @emigrate/plugin-tools@0.9.6
  - @emigrate/types@0.12.1

## 0.3.5

### Patch Changes

- Updated dependencies [94ad9fe]
  - @emigrate/types@0.12.0
  - @emigrate/plugin-tools@0.9.5

## 0.3.4

### Patch Changes

- Updated dependencies [ce15648]
  - @emigrate/types@0.11.0
  - @emigrate/plugin-tools@0.9.4

## 0.3.3

### Patch Changes

- Updated dependencies [f9a16d8]
  - @emigrate/types@0.10.0
  - @emigrate/plugin-tools@0.9.3

## 0.3.2

### Patch Changes

- Updated dependencies [a6c6e6d]
  - @emigrate/types@0.9.1
  - @emigrate/plugin-tools@0.9.2

## 0.3.1

### Patch Changes

- 3a8b06b: Don't use the `bun` key in `exports` as that would mean we have to include both built files and source files in each package, which is a bit wasteful. Maybe reconsider in the future if we can package only source files.
- Updated dependencies [3a8b06b]
  - @emigrate/plugin-tools@0.9.1

## 0.3.0

### Minor Changes

- ce6946c: Emigrate supports Bun, make use of the `bun` key in package.json `exports`

### Patch Changes

- Updated dependencies [ce6946c]
  - @emigrate/plugin-tools@0.9.0
  - @emigrate/types@0.9.0

## 0.2.7

### Patch Changes

- Updated dependencies [cae6d11]
- Updated dependencies [cae6d11]
- Updated dependencies [cae6d11]
  - @emigrate/types@0.8.0
  - @emigrate/plugin-tools@0.8.0

## 0.2.6

### Patch Changes

- Updated dependencies [bad4e25]
  - @emigrate/plugin-tools@0.7.0

## 0.2.5

### Patch Changes

- Updated dependencies [a79f8e8]
- Updated dependencies [a79f8e8]
  - @emigrate/plugin-tools@0.6.0

## 0.2.4

### Patch Changes

- Updated dependencies [703e6f0]
- Updated dependencies [c1d5597]
  - @emigrate/plugin-tools@0.5.0

## 0.2.3

### Patch Changes

- Updated dependencies [20ed2e8]
- Updated dependencies [d916043]
  - @emigrate/plugin-tools@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies [5e8572b]
- Updated dependencies [8e87ade]
- Updated dependencies [60ae3b8]
- Updated dependencies [672fae1]
- Updated dependencies [d8a6a24]
- Updated dependencies [acb0b4f]
  - @emigrate/plugin-tools@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [8f35812]
  - @emigrate/plugin-tools@0.3.0

## 0.2.0

### Minor Changes

- 9f5abf7: Simplify plugin interfaces by getting rid of the "type" string, in preparation for having packages that contains multiple different plugins

### Patch Changes

- 3e0ff07: Specify files to include in published NPM package
- Updated dependencies [1799b6e]
- Updated dependencies [3e0ff07]
- Updated dependencies [23a323c]
- Updated dependencies [62bd5a4]
- Updated dependencies [81fde2e]
- Updated dependencies [9f5abf7]
  - @emigrate/plugin-tools@0.2.0

## 0.1.1

### Patch Changes

- 50fce0a: Add some simple README's for each package and add homepage, repository and bugs URLs to each package.json file
- Updated dependencies [50fce0a]
  - @emigrate/plugin-tools@0.1.1

## 0.1.0

### Minor Changes

- ce4693d: First version. A simple JavaScript migration file generator.

### Patch Changes

- Updated dependencies [cdafd05]
- Updated dependencies [9c239e0]
- Updated dependencies [1634094]
  - @emigrate/plugin-tools@0.1.0

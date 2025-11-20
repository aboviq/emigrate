# @emigrate/storage-fs

## 0.4.8

### Patch Changes

- Updated dependencies [4e181d9]
- Updated dependencies [d49da0c]
  - @emigrate/types@1.0.0

## 0.4.7

### Patch Changes

- ca154fa: Minimize package size by excluding \*.tsbuildinfo files
- Updated dependencies [ca154fa]
  - @emigrate/types@0.12.2

## 0.4.6

### Patch Changes

- db656c2: Enable NPM provenance
- Updated dependencies [db656c2]
  - @emigrate/types@0.12.1

## 0.4.5

### Patch Changes

- Updated dependencies [94ad9fe]
  - @emigrate/types@0.12.0

## 0.4.4

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

## 0.3.3

### Patch Changes

- Updated dependencies [cae6d11]
- Updated dependencies [cae6d11]
- Updated dependencies [cae6d11]
  - @emigrate/types@0.8.0

## 0.3.2

### Patch Changes

- Updated dependencies [bad4e25]
  - @emigrate/plugin-tools@0.7.0

## 0.3.1

### Patch Changes

- a79f8e8: Serialization of errors now happens inside storage plugins because it makes more sense and the types are easier to work with this way
- Updated dependencies [a79f8e8]
- Updated dependencies [a79f8e8]
  - @emigrate/plugin-tools@0.6.0

## 0.3.0

### Minor Changes

- c1d5597: Handle the serialized errors coming from Emigrate, so no need to serialize errors ourselves
- 703e6f0: Implement an empty "end" method for cleaning up

### Patch Changes

- Updated dependencies [703e6f0]
- Updated dependencies [c1d5597]
  - @emigrate/plugin-tools@0.5.0

## 0.2.1

### Patch Changes

- Updated dependencies [20ed2e8]
- Updated dependencies [d916043]
  - @emigrate/plugin-tools@0.4.1

## 0.2.0

### Minor Changes

- 7d8ac9b: Adapt to the new plugin structure and rename from "@emigrate/plugin-storage-fs" to just "@emigrate/storage-fs"
- e79dd4b: Serialize errors recursively if they have a "cause" set to an Error instance
- d8a6a24: Implement the "remove" command for removing migration entries from the history

### Patch Changes

- Updated dependencies [5e8572b]
- Updated dependencies [8e87ade]
- Updated dependencies [60ae3b8]
- Updated dependencies [672fae1]
- Updated dependencies [d8a6a24]
- Updated dependencies [acb0b4f]
  - @emigrate/plugin-tools@0.4.0

## 0.1.1

### Patch Changes

- e5eec7c: Throw a more descriptive error when a file lock couldn't be acquired
- Updated dependencies [8f35812]
  - @emigrate/plugin-tools@0.3.0

## 0.1.0

### Minor Changes

- 0c49249: Implement a first version of the File System Storage plugin for simple migration setups

### Patch Changes

- Updated dependencies [1799b6e]
- Updated dependencies [3e0ff07]
- Updated dependencies [23a323c]
- Updated dependencies [62bd5a4]
- Updated dependencies [81fde2e]
- Updated dependencies [9f5abf7]
  - @emigrate/plugin-tools@0.2.0

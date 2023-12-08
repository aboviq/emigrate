# @emigrate/storage-fs

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

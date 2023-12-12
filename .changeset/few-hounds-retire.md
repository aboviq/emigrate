---
'@emigrate/plugin-tools': patch
'@emigrate/storage-fs': patch
'@emigrate/mysql': patch
'@emigrate/cli': patch
---

Serialization of errors now happens inside storage plugins because it makes more sense and the types are easier to work with this way

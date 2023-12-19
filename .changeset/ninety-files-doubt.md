---
'@emigrate/plugin-generate-js': patch
'@emigrate/reporter-pino': patch
'@emigrate/plugin-tools': patch
'@emigrate/storage-fs': patch
'@emigrate/postgres': patch
'@emigrate/mysql': patch
---

Don't use the `bun` key in `exports` as that would mean we have to include both built files and source files in each package, which is a bit wasteful. Maybe reconsider in the future if we can package only source files.

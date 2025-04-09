---
'@emigrate/plugin-tools': minor
'@emigrate/cli': minor
---

Loader plugins are now allowed to return `undefined` to signal to Emigrate to skip to the next loader plugin. This way multiple loader plugins are able to load migration files with the same file extension and it is up to the loader plugins themselves to figure out if they are able to load a certain migration file or not.

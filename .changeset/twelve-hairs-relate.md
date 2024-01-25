---
'@emigrate/cli': minor
---

Add support for passing relative paths to migration files as the `--from` and `--to` CLI options. This is very useful from terminals that support autocomplete for file paths. It also makes it possible to copy the path to a migration file from Emigrate's output and use that as either `--from` and `--to` directly.

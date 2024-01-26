---
'@emigrate/cli': minor
---

Completely rework how the "remove" command is run, this is to make it more similar to the "up" and "list" command as now it will also use the `onMigrationStart`, `onMigrationSuccess` and `onMigrationError` reporter methods when reporting the command progress. It's also in preparation for adding `--from` and `--to` CLI options for the "remove" command, similar to how the same options work for the "up" command.

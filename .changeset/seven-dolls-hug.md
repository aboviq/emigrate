---
'@emigrate/cli': patch
'@emigrate/reporter-pino': patch
---

Only log info about locked migrations in the "up" command, as "list" doesn't do any locking

---
'@emigrate/cli': patch
---

Don't pass the EmigrateError instance to the storage for each failed migration but only the real cause. This is so that errors from failed migrations are not wrapped twice in EmigrateError instances when presenting failed migrations during an "up" dry-run or the "list" command.

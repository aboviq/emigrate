---
'@emigrate/types': minor
---

Remove the "remove" command specific reporter methods. So instead of using `onMigrationRemoveStart`, `onMigrationRemoveSuccess` and `onMigrationRemoveError` the `onMigrationStart`, `onMigrationSuccess` and `onMigrationError` methods should be used and the reporter can still format the output differently depending on the current command (which it receives in the `onInit` method). This is a BREAKING CHANGE.

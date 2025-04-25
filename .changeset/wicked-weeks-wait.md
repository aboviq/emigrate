---
'@emigrate/cli': major
---

Remove the "reporter" option from the "new" command. It now has its own custom default reporter. This makes more sense as you usually don't want to change the reporter for the "new" command, but only for the other commands (e.g. to the "pino" reporter in a production environment). With this change the "EmigrateConfig" type has been changed to reflect this, so that the "new" command has a different type than the other commands.

---
'@emigrate/cli': patch
---

Ignore migration history entries not belonging to the current migration directory when considering what to list or execute. This way a project can have multiple folders with different kind of migration sets or multiple projects can share the same migration history without any of them conflicting or blocking each other in case of failed migrations.

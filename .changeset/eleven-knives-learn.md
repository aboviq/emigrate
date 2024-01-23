---
'@emigrate/cli': patch
---

Handle migration history entries without file extensions for migration files with periods in their names that are not part of the file extension. Previously Emigrate would attempt to re-run these migrations, but now it will correctly ignore them. E.g. the migration history contains an entry for "migration.file.name" and the migration file is named "migration.file.name.js" it will not be re-run.

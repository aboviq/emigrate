---
'@emigrate/plugin-tools': major
'@emigrate/postgres': major
'@emigrate/mysql': major
'@emigrate/types': major
'@emigrate/cli': major
'@emigrate/docs': major
---

Generator plugins are no more. Template plugins is the new thing. A generator plugin was responsible both for generating the contents of new migration files and their filenames, a template plugin only generates the contents of new files. A template plugin can provide multiple templates where each template have a corresponding file extension. Multiple template plugins can have templates with the same extension and in a coming change the user will be able to chose which template to use when that's the case. This new type of plugin opens up new potential use cases like automatically generating migration files based on diffing two database schemas for instance. A template plugin can provide templates as either strings, or sync or async functions returning strings.

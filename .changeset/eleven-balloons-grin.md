---
'@emigrate/types': major
'@emigrate/cli': major
---

Remove the `directory` property from the ReporterInitParameters. This is to make it easier to adapt Emigrate to do migrations that are not file based. It also makes Emigrate more flexible in case future versions will allow running migrations from different locations at the same time.

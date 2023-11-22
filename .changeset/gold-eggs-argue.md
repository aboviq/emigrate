---
'@emigrate/plugin-tools': minor
'@emigrate/cli': minor
---

Move storages and reporters out from the plugin option into their own separate options (i.e. "--reporter" and "--storage" respectively). This makes it easier to change the interfaces of storages and reporters, and it's also more similar to other tools.

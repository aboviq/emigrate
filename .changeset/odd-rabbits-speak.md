---
'@emigrate/plugin-tools': major
---

The plugin utility functions getOrLoadPlugins and getOrLoad no longer reverses the input array. This makes it easier to reason about the loading order as the first specified plugin has the highest priority and any default plugin should always be put last in the array.

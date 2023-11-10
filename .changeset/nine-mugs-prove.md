---
'emigrate': minor
---

Automatically prefix plugin names when loading them if necessary. I.e. when specifying only "--plugin generate-js" Emigrate will load the @emigrate/plugin-generate-js plugin. It has a priority order that is: 1. the provided plugin name as is, 2. the name prefixed with "@emigrate/plugin-", 3. the name prefixed with "emigrate-plugin-"

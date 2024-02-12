---
'@emigrate/mysql': patch
---

Only unreference connections in a Bun environment as it crashes Node for some reason, without even throwing an error that is

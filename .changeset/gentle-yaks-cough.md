---
'@emigrate/mysql': patch
---

Unreference all connections when run using Bun, to not keep the process open unnecessarily long

---
'@emigrate/cli': patch
---

Use setTimeout/setInterval from "node:timers" so that .unref() correctly works with Bun

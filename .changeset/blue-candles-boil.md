---
'@emigrate/cli': patch
---

Cleanup AbortSignal listeners when they are not needed to avoid MaxListenersExceededWarning when migrating many migrations at once

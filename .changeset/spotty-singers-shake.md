---
'@emigrate/mysql': patch
---

Unreference all connections automatically so that they don't hinder the process from exiting. This is especially needed in Bun environments as it seems to handle sockets differently regarding this matter than NodeJS.

---
'@emigrate/mysql': patch
---

Avoid "CREATE TABLE IF NOT EXISTS" as it's too locking in a clustered database when running it concurrently

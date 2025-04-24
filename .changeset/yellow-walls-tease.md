---
'@emigrate/mysql': patch
---

Either lock all or none of the migrations to run to make sure they run in order when multiple instances of Emigrate runs concurrently (for instance in a Kubernetes environment)

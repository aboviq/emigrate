---
'@emigrate/mysql': patch
---

Make sure we can initialize multiple running instances of Emigrate using @emigrate/mysql concurrently without issues with creating the history table (for instance in a Kubernetes environment and/or with a Percona cluster).

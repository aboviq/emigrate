---
'@emigrate/cli': minor
---

Handle process interruptions gracefully, e.g. due to receiving a SIGINT or SIGTERM signal. If a migration is currently running when the process is about to shutdown it will have a maximum of 10 more seconds to finish before being deserted (there's no way to cancel a promise sadly, and many database queries are not easy to abort either). The 10 second respite length can be customized using the --abort-respite CLI option or the abortRespite config.

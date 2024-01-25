---
'@emigrate/cli': minor
---

When the `--from` or `--to` CLI options are used the given migration name (or path to migration file) must exist. This is a BREAKING CHANGE from before. The reasoning is that by forcing the migrations to exist you avoid accidentally running migrations you don't intend to, because a simple typo could have the effect that many unwanted migrations is executed so it's better to show an error if that's the case.

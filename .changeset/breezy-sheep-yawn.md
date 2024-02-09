---
'@emigrate/cli': minor
---

Make it possible to write the Emigrate configuration file in TypeScript and load it using `tsx` in a NodeJS environment by importing packages provided using the `--import` CLI option before loading the configuration file. This makes it possible to run Emigrate in production with a configuration file written in TypeScript without having the `typescript` package installed.

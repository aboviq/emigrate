---
'@emigrate/plugin-tools': patch
---

Try importing plugins (and reporters) using prefixes before importing without, this is to avoid issue with accidentaly importing other non-emigrate related packages. E.g. setting the reporter to "pino" would import the "pino" package without this fix and will import "@emigrate/reporter-pino" with this fix.

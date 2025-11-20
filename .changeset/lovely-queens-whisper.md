---
'@emigrate/cli': major
---

The "new" command is now smarter and more beginner friendly and have overall better UX by prompting for information about the migration file to create, like its name, file extension and template. In non-interactive mode, i.e. where Emigrate can't prompt, it will now fail instead of creating an empty migration file when not all information is provided, unless the `--yes/-y` CLI flag is provided that is. So for users using Emigrate's "new" command in non-interactive mode this is a breaking change.

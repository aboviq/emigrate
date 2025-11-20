# @emigrate/docs

## 2.0.0

### Major Changes

- d49da0c: Generator plugins are no more. Template plugins is the new thing. A generator plugin was responsible both for generating the contents of new migration files and their filenames, a template plugin only generates the contents of new files. A template plugin can provide multiple templates where each template have a corresponding file extension. Multiple template plugins can have templates with the same extension and in a coming change the user will be able to chose which template to use when that's the case. This new type of plugin opens up new potential use cases like automatically generating migration files based on diffing two database schemas for instance. A template plugin can provide templates as either strings, or sync or async functions returning strings.

### Minor Changes

- a9cd349: Add support for a "prefix" option. With the prefix option it's possible to customize the prefix of new migration files. Emigrate comes with a set of built-in prefixes and it can also be customized using any function as the prefix option in the configuration file.
- a9cd349: Add support for a "joiner" option. The specified joiner is used as a separator between the migration file's prefix and its name, and it is also used as a replacement for illegal filename characters if any. The default joiner is "\_".

## 1.0.0

### Major Changes

- 1d33d65: Rename the URL path "/commands/" to "/cli/" to make it more clear that those pages are the documentation for the CLI. This change is a BREAKING CHANGE because it changes the URL path of the pages.

### Minor Changes

- 0c597fd: Add a separate page for the Emigrate CLI itself, with all the commands as sub pages

## 0.4.0

### Minor Changes

- b62c692: Add documentation for the built-in "json" reporter
- b62c692: The "default" reporter is now named "pretty"
- e7ec75d: Add note in FAQ on using Emigrate for existing databases

### Patch Changes

- c838ffb: Add note on how to write Emigrate's config using TypeScript in a production environment without having `typescript` installed.

## 0.3.0

### Minor Changes

- f6761fe: Document the changes to the "remove" command, specifically that it also accepts relative file paths now
- 9109238: Document the changes to the "up" command's `--from` and `--to` options, specifically that they can take relative file paths and that the given migration must exist.

## 0.2.0

### Minor Changes

- a4da353: Document the --abort-respite CLI option and the corresponding abortRespite config

## 0.1.0

### Minor Changes

- cbc35bd: Add first version of the [Baseline guide](https://emigrate.dev/guides/baseline)
- cbc35bd: Document the new --limit, --from and --to options for the ["up" command](https://emigrate.dev/cli/up/)

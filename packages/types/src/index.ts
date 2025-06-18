export type Awaitable<T> = T | PromiseLike<T>;

export type StringOrModule<T> = string | T | (() => Awaitable<T>) | (() => Awaitable<{ default: T }>);

export type MigrationStatus = 'failed' | 'done' | 'pending';

export type SerializedError = Record<string, unknown>;

export type FailedMigrationHistoryEntry = {
  name: string;
  status: 'failed';
  date: Date;
  error: SerializedError;
};

export type NonFailedMigrationHistoryEntry = {
  name: string;
  status: Exclude<MigrationStatus, 'failed'>;
  date: Date;
};

export type MigrationHistoryEntry = FailedMigrationHistoryEntry | NonFailedMigrationHistoryEntry;

export type Storage = {
  /**
   * Acquire a lock on the given migrations.
   *
   * To best support concurrent migrations (e.g. when multiple services are deployed at the same time and want to migrate the same database)
   * the plugin should try to lock all migrations at once (i.e. in a transaction) and ignore migrations that are already locked (or done).
   * The successfully locked migrations should be returned and are the migrations that will be executed.
   *
   * If one of the migrations to lock is in a failed state, the plugin should throw an error to abort the migration attempt.
   *
   * @returns The migrations that were successfully locked.
   */
  lock(migrations: MigrationMetadata[]): Promise<MigrationMetadata[]>;
  /**
   * The unlock method is called after all migrations have been executed or when the process is interrupted (e.g. by a SIGTERM or SIGINT signal).
   *
   * Depending on the plugin implementation, the unlock method is usually a no-op for already succeeded or failed migrations.
   *
   * @param migrations The previously successfully locked migrations that should now be unlocked.
   */
  unlock(migrations: MigrationMetadata[]): Promise<void>;

  /**
   * Remove a migration from the history.
   *
   * This is used to remove a migration from the history which is needed for failed migrations to be re-executed.
   *
   * @param migration The migration that should be removed from the history.
   */
  remove(migration: MigrationMetadata): Promise<void>;
  /**
   * Get the history of previously executed migrations.
   *
   * For failed migrations, the error property should be set.
   * Emigrate will not sort the history entries, so the plugin should return the entries in the order they were executed.
   * The order doesn't affect the execution of migrations, but it does affect the order in which the history is displayed in the CLI.
   * Migrations that have not yet been executed will always be run in alphabetical order.
   *
   * The history has two purposes:
   * 1. To determine which migrations have already been executed.
   * 2. To list the migration history in the CLI.
   */
  getHistory(): AsyncIterable<MigrationHistoryEntry>;
  /**
   * Called when a migration has been successfully executed.
   *
   * @param migration The name of the migration that should be marked as done.
   */
  onSuccess(migration: MigrationMetadataFinished): Promise<void>;
  /**
   * Called when a migration has failed.
   *
   * The passed error will be serialized so it's easily storable it in the history.
   * If the original Error instance is needed it's available as the `error` property on the finished migration.
   *
   * @param migration The name of the migration that should be marked as failed.
   * @param error The error that caused the migration to fail. Serialized for easy storage.
   */
  onError(migration: MigrationMetadataFinished, error: SerializedError): Promise<void>;
  /**
   * Called when the command is finished or aborted (e.g. by a SIGTERM or SIGINT signal).
   *
   * Use this to clean up any resources like database connections or file handles.
   */
  end(): Promise<void>;
};

export type EmigrateStorage = {
  initializeStorage(): Promise<Storage>;
};

export type InitializeStorageFunction = EmigrateStorage['initializeStorage'];

export type MigrationFunction = () => Awaitable<void>;

export type MigrationMetadata = {
  /**
   * The name of the migration file
   *
   * @example 20210901123456000_create_users_table.js
   */
  name: string;
  /**
   * The directory where the migration file is located, relative to the current working directory
   *
   * @example migrations
   */
  directory: string;
  /**
   * The full absolute path to the migration file
   *
   * @example /home/user/project/migrations/20210901123456000_create_users_table.js
   */
  filePath: string;
  /**
   * The relative path to the migration file, relative to the current working directory
   *
   * @example migrations/20210901123456000_create_users_table.js
   */
  relativeFilePath: string;
  /**
   * The current working directory (the same as process.cwd())
   */
  cwd: string;
  /**
   * The extension of the migration file, with a leading period
   *
   * @example .js
   */
  extension: string;
};

export type FailedMigrationMetadata = MigrationMetadata & {
  status: 'failed';
  duration: number;
  error: Error;
};

export type SkippedMigrationMetadata = MigrationMetadata & {
  status: 'skipped' | 'pending';
};

export type SuccessfulMigrationMetadata = MigrationMetadata & {
  status: 'done';
  duration: number;
};

export type MigrationMetadataFinished =
  | FailedMigrationMetadata
  | SkippedMigrationMetadata
  | SuccessfulMigrationMetadata;

export const isFinishedMigration = (
  migration: MigrationMetadata | MigrationMetadataFinished,
): migration is MigrationMetadataFinished => {
  return 'status' in migration;
};

export const isFailedMigration = (
  migration: MigrationMetadata | MigrationMetadataFinished,
): migration is FailedMigrationMetadata => {
  return 'status' in migration && migration.status === 'failed';
};

export type LoaderPlugin = {
  /**
   * The file extensions that this plugin can load.
   */
  loadableExtensions: string[];
  /**
   * Used to load a migration file, i.e. transform it into a function that can be executed.
   *
   * The plugin can return undefined if it decides that the migration is not loadable.
   * For instance if many loader plugins can load the same file extension, but only one
   * of them can load a specific file depending on its content or metadata.
   *
   * @param migration Some metadata about the migration file that should be loaded.
   * @returns A function that will execute the migration or undefined if the plugin decided the migration is not loadable.
   */
  loadMigration(migration: MigrationMetadata): Awaitable<MigrationFunction | undefined>;
};

export type MigrationLoader = LoaderPlugin['loadMigration'];

export type TemplatePlugin = {
  /**
   * The different templates that this plugin provides.
   */
  templates: Template[];
};

export type Template = {
  /**
   * An optional template description that will be shown to the user when they are prompted to select a template.
   */
  description?: string;
  /**
   * The migration file extension that this template generates.
   *
   * The first template that matches the extension provided to the "new" command will be used (or `.js` which is the default).
   *
   * @example .js
   */
  extension: string;
  /**
   * The template to use for the new migration file.
   *
   * Any occurrences of the string `{{name}}` in the template string or the returned string from
   * the template function will be replaced with the name of the migration.
   */
  template: string | ((name: string) => Awaitable<string>);
};

export type ReporterInitParameters = {
  /**
   * The version of the emigrate CLI that is being used
   *
   * @example 1.0.0
   */
  version: string;
  /**
   * The command that is being executed
   */
  command: 'up' | 'new' | 'list' | 'remove';
  /**
   * The current working directory (the same as process.cwd())
   */
  cwd: string;
  /**
   * Specifies whether the migration process is a dry run or not.
   *
   * Will only be true when the command is 'up' and the --dry option is specified.
   */
  dry: boolean;
  /**
   * Forcibly enable or disable colors in the output.
   *
   * If set to true, the reporter should use colors in the output.
   * If set to false, the reporter should not use colors in the output.
   */
  color?: boolean;
};

export type EmigrateReporter = Partial<{
  /**
   * Called when the reporter is initialized, which is the first method that is called when a command is executed.
   */
  onInit(parameters: ReporterInitParameters): Awaitable<void>;
  /**
   * Called when the current command (in practice the "up" command) is aborted.
   *
   * This is called when the process is interrupted, e.g. by a SIGTERM or SIGINT signal, or an unhandled error occurs.
   *
   * @param reason The reason why the command was aborted.
   */
  onAbort(reason: Error): Awaitable<void>;
  /**
   * Called when all pending migrations that should be executed have been collected.
   *
   * @param migrations The pending migrations that will be executed.
   */
  onCollectedMigrations(migrations: MigrationMetadata[]): Awaitable<void>;
  /**
   * Called when the migrations have been successfully locked.
   *
   * Usually the migrations passed to this method are the same as the migrations passed to the onCollectedMigrations method,
   * but in case of a concurrent migration attempt, some or all migrations might already be locked by another process.
   *
   * @param migrations The migrations that have been successfully locked so they can be executed.
   */
  onLockedMigrations(migrations: MigrationMetadata[]): Awaitable<void>;
  /**
   * Called when a new migration file has been generated.
   *
   * This is only called when the command is 'new'.
   */
  onNewMigration(migration: MigrationMetadata, content: string): Awaitable<void>;
  /**
   * Called when a migration is about to be executed.
   *
   * Will be called for each migration when the command is "up",
   * or before removing each migration from the history when the command is "remove".
   *
   * @param migration Information about the migration that is about to be executed/removed.
   */
  onMigrationStart(migration: MigrationMetadata): Awaitable<void>;
  /**
   * Called when a migration has been successfully executed.
   *
   * Will be called after a successful migration when the command is "up",
   * or after a successful removal of a migration from the history when the command is "remove",
   * or for each successful migration from the history when the command is "list".
   *
   * @param migration Information about the migration that was executed.
   */
  onMigrationSuccess(migration: SuccessfulMigrationMetadata): Awaitable<void>;
  /**
   * Called when a migration has failed.
   *
   * Will be called after a failed migration when the command is "up",
   * or after a failed removal of a migration from the history when the command is "remove",
   * or for each failed migration from the history when the command is "list" (will be at most one in this case).
   *
   * @param migration Information about the migration that failed.
   * @param error The error that caused the migration to fail.
   */
  onMigrationError(migration: FailedMigrationMetadata, error: Error): Awaitable<void>;
  /**
   * Called when a migration is skipped
   *
   * Will be called when a migration is skipped because a previous migration failed,
   * it couldn't be successfully locked, or in case of a dry run when the command is "up".
   * When the command is "list" this will be called for each pending migration (i.e. those that have not run yet).
   * When the command is "remove" this will be called when the removal of some migrations are skipped
   * because the removal of a previous migration failed.
   *
   * @param migration Information about the migration that was skipped.
   */
  onMigrationSkip(migration: SkippedMigrationMetadata): Awaitable<void>;
  /**
   * Called as a final step after all migrations have been executed, listed or removed.
   *
   * This is called either after all migrations have been listed successfully for the "list" command
   * or for the "up" command when they are executed successfully, at the end of a dry run, or when a migration has failed.
   * It is also called after migrations have been removed from the history with the "remove" command.
   * It is also called after a migration file has been generated with the "new" command.
   *
   * @param migrations Information about all migrations that were executed or listed, their status and any error that occurred.
   * @param error If the migration process failed, this will be the error that caused the failure.
   */
  onFinished(migrations: MigrationMetadataFinished[], error?: Error): Awaitable<void>;
}>;

export type Plugin = LoaderPlugin | TemplatePlugin;

type PluginTypeMap = {
  loader: LoaderPlugin;
  template: TemplatePlugin;
};

export type PluginType = keyof PluginTypeMap;

export type PluginFromType<T extends PluginType> = PluginTypeMap[T];

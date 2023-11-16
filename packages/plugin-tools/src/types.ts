export type MigrationStatus = 'failed' | 'done';

export type MigrationHistoryEntry = {
  name: string;
  status: MigrationStatus;
  date: Date;
  error?: unknown;
};

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
  lock(migrations: string[]): Promise<string[]>;
  /**
   * The unlock method is called after all migrations have been executed or when the process is interrupted (e.g. by a SIGTERM or SIGINT signal).
   *
   * Depending on the plugin implementation, the unlock method is usually a no-op for already succeeded or failed migrations.
   *
   * @param migrations The previously successfully locked migrations that should now be unlocked.
   */
  unlock(migrations: string[]): Promise<void>;
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
  onSuccess(migration: string): Promise<void>;
  /**
   * Called when a migration has failed.
   *
   * @param migration The name of the migration that should be marked as failed.
   * @param error The error that caused the migration to fail.
   */
  onError(migration: string, error: Error): Promise<void>;
};

export type StoragePlugin = {
  initializeStorage(): Promise<Storage>;
};

export type InitializeStorageFunction = StoragePlugin['initializeStorage'];

export type MigrationFile = {
  /**
   * The complete filename of the migration file, including the extension.
   *
   * Migrations that have not yet been executed will be run in alphabetical order, so preferably prefix the filename with a timestamp (and avoid unix timestamp and prefer something more human readable).
   */
  filename: string;
  /**
   * The content of the migration file.
   */
  content: string;
};

export type GeneratorPlugin = {
  /**
   * Used to generate a new migration file.
   *
   * @param name The name of the migration that should be generated (provided as arguments to the CLI)
   * @returns The generated migration file.
   */
  generateMigration(name: string): Promise<MigrationFile>;
};

export type GenerateMigrationFunction = GeneratorPlugin['generateMigration'];

export type MigrationFunction = () => Promise<void>;

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
   * The extension of the migration file
   *
   * @example js
   */
  extension: string;
};

export type LoaderPlugin = {
  /**
   * The file extensions that this plugin can load.
   */
  loadableExtensions: string[];
  /**
   * Used to load a migration file, i.e. transform it into a function that can be executed.
   *
   * @param migration Some metadata about the migration file that should be loaded.
   * @returns A function that will execute the migration.
   */
  loadMigration(migration: MigrationMetadata): Promise<MigrationFunction>;
};

export type Plugin = StoragePlugin | GeneratorPlugin | LoaderPlugin;

export type PluginType = 'storage' | 'generator' | 'loader';

export type PluginFromType<T extends PluginType> = T extends 'storage'
  ? StoragePlugin
  : T extends 'generator'
    ? GeneratorPlugin
    : T extends 'loader'
      ? LoaderPlugin
      : never;

import type { MigrationIdentifier, MigrationState, RunnableMigration } from './migrations.js';
import type { SerializedError } from './utils.js';

export type EmigrateStorage = {
  /**
   * The name of the storage plugin
   */
  name: string;

  /**
   * Initialize the storage plugin.
   *
   * Called at the beginning of a migration command.
   *
   * Is optional.
   */
  init?(): Promise<void>;

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
  lock(migrations: ReadonlyArray<RunnableMigration>): Promise<RunnableMigration[]>;

  /**
   * The unlock method is called after all migrations have been executed or when the process is interrupted (e.g. by a SIGTERM or SIGINT signal).
   *
   * Depending on the plugin implementation, the unlock method is usually a no-op for already succeeded or failed migrations.
   *
   * @param migrations The previously successfully locked migrations that should now be unlocked.
   */
  unlock(migrations: ReadonlyArray<RunnableMigration>): Promise<void>;

  /**
   * Remove a migration from the history.
   *
   * This is used to remove a migration from the history which is needed for failed migrations to be re-executed.
   *
   * @param migration The migration that should be removed from the history.
   */
  remove(migration: RunnableMigration): Promise<void>;

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
  getHistory(): AsyncIterable<{ identifier: MigrationIdentifier; state: MigrationState }>;

  /**
   * Called when a migration has been executed.
   *
   * @param migration The migration that should be logged as executed.
   * @param error An optional error if the migration failed. Serialized for easy storage.
   */
  log(migration: RunnableMigration, error?: SerializedError): Promise<void>;

  /**
   * Called for pending migrations that couldn't be locked, instead of executing them.
   *
   * This is important for concurrent migration runs (e.g. in clustered environments where multiple instances might try to run migrations at the same time).
   * The first instance to acquire the lock will execute the migrations, while the others will wait for the migrations to be done.
   * And if a migration fails, those waiting for the migration should also throw an error.
   * This way the system remains consistent and no instance proceeds with an incomplete migration state,
   * i.e. the whole deployment should fail if any instance encounters a migration failure.
   *
   * Usually implemented by polling the migration state until it is no longer locked.
   *
   * If not implemented, pending migrations that couldn't be locked will simply be skipped.
   * I.e. in concurrent migration runs, only the instance that acquired the lock will run the migrations,
   * while the others will skip them and continue as if the migrations were already executed.
   * This might lead to crashes or inconsistent states if the application expects certain migrations to be executed.
   *
   * @param migration The migration that should be waited for.
   */
  wait?: (migration: RunnableMigration) => Promise<void>;

  /**
   * Called when the command is finished or aborted (e.g. by a SIGTERM or SIGINT signal).
   *
   * Use this to clean up any resources like database connections or file handles.
   *
   * Is optional.
   */
  end?: () => Promise<void>;
};

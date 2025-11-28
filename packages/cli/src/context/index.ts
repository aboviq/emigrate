import { getConsoleSink, jsonLinesFormatter } from '@logtape/logtape';
import { getConfig } from '../config/get.js';
import { mergeConfig } from '../config/merge.js';
import {
  MigrationNotLoadedError,
  MigrationNotRunError,
  MigrationRunError,
  MigrationWaitError,
  MissingStorageError,
} from '../errors.js';
import {
  configureLogging,
  defineLoggingConfig,
  getDefaultLogger,
  getLoggingConfig,
  getPluginCategory,
  mergeLoggingConfig,
} from '../logger/index.js';
import { getHooksRunner, runHook, type HooksRunner } from '../plugins/hooks.js';
import { getOrLoadPlugin } from '../plugins/load.js';
import type { EmigrateCommand, EmigrateConfig, EmigrateResolvedConfig } from '../types/config.js';
import type { Logger, LogLevel } from '../types/logging.js';
import type { EmigratePlugin } from '../types/plugins.js';
import type { EmigrateStorage } from '../types/storage.js';
import {
  MigrationIdentifier,
  type CollectedMigration,
  type FinishedMigration,
  type LoadedMigration,
  type MigrationState,
  type RunnableMigration,
} from '../types/migrations.js';
import { DEFAULT_RESPITE_SECONDS } from '../defaults.js';
import { exec } from '../utils/exec.js';
import { toError, toSerializedError } from '../utils/errors.js';
import { createFailsafeStorage } from '../plugins/storage.js';
import type { FailsafeStorage } from '../types/internal.js';
import path from 'node:path';

interface ContextOptions {
  /**
   * The command to run
   */
  command: EmigrateCommand;
  /**
   * Inline configuration to merge with the config file
   *
   * The inline config has higher priority than the config file.
   *
   * @default {}
   */
  config?: EmigrateConfig;
  /**
   * The current working directory to use when loading the config file
   *
   * @default process.cwd()
   */
  cwd?: string;
  /**
   * Force support for TypeScript config files
   *
   * This will import the config file as if it were a JavaScript file,
   * i.e. it will only work in environments that support importing TypeScript files natively (like Bun, Deno or NodeJS >=v22.6).
   */
  forceTypeScriptConfigSupport?: boolean;
  /**
   * An optional abort signal to cancel long-running operations
   *
   * Provided by the CLI and aborted on SIGINT/SIGTERM
   */
  abortSignal?: AbortSignal;
}

interface EmigrateContext {
  /**
   * The command being run
   */
  readonly command: EmigrateCommand;
  /**
   * The resolved Emigrate configuration currently in use
   */
  readonly config: EmigrateResolvedConfig;
  /**
   * All migrations available in this context.
   *
   * It's up to the consumer to decide which migrations to execute, skip or wait for.
   * I.e. the migrations map may contain migrations that are already done or failed, as well as pending migrations.
   */
  readonly migrations: ReadonlyMap<MigrationIdentifier, RunnableMigration>;
  readonly logger: Logger;
  /**
   * Sets up the current command
   *
   * Will run the `emigrate:command:setup` hook on all plugins.
   */
  setup: () => Promise<void>;
  /**
   * Executes a migration
   *
   * Will only execute the migration if it is pending and it has been locked for execution.
   * If the migration is not locked, it will be waited for instead.
   *
   * Automatically logs the migration result to storage (if the command is "up") and updates the migration state.
   * Also handles errors and abort signals and will skip execution if the migration is not pending or if an error has already occurred.
   *
   * Will only execute the real migration function for the "up" command.
   * For all other commands, the dry-run migration function is used, which is a no-op if not explicitly set by a plugin.
   *
   * @param migration The migration to execute
   * @returns `true` if the migration was executed successfully, `false` otherwise
   */
  execute: (migration: RunnableMigration) => Promise<boolean>;

  /**
   * Only log a migration as done without executing it
   *
   * Will only log the migration if it is pending and it has been locked for execution.
   *
   * Automatically updates the migration state to 'done' and logs it to the storage (if the command is "up").
   * Also handles errors and abort signals and will skip logging if the migration is not pending or if an error has already occurred.
   *
   * @param migration The migration to log
   * @returns `true` if the migration was logged successfully or if the command is not "up", `false` otherwise
   */
  log: (migration: RunnableMigration) => Promise<boolean>;

  /**
   * Skip a migration manually
   *
   * Should be used by commands that want to skip a migration because of some filtering criteria (e.g. from/to/limit or other).
   *
   * @param migration The migration to skip
   * @returns Always returns `false` to indicate that the migration was not executed
   */
  skip: (migration: RunnableMigration) => Promise<boolean>;
  /**
   * Mark a migration as finished
   *
   * This can be used by commands that only want to list migrations and not actually execute them.
   *
   * @param migration The migration to mark as finished
   * @returns `false` if the migration is in a failed state, `true` otherwise
   */
  finish: (migration: RunnableMigration) => Promise<boolean>;
  /**
   * Remove a migration from the migration history
   *
   * This will call the storage's `remove` method, and should be used to be able to retry failed migrations.
   *
   * @param migration The migration to remove
   * @returns `true` if the migration was removed successfully, `false` otherwise
   */
  remove: (migration: RunnableMigration) => Promise<boolean>;
  /**
   * Lock migrations for execution
   *
   * This will call the storage's `lock` method to attempt to lock the given migrations for execution.
   *
   * @param migrations The migrations to lock
   */
  lock: (migrations: RunnableMigration[]) => Promise<void>;
  /**
   * Abort the current command
   *
   * @param reason The reason for the abort of the current command
   */
  abort: (reason: Error) => Promise<void>;
  /**
   * Complete the command
   *
   * This should be used by commands when they have finished processing all migrations.
   *
   * Will run the `emigrate:command:done` hook on all plugins.
   *
   * @returns `true` if all migrations were successful, `false` otherwise
   */
  done: () => Promise<boolean>;
}

const logger = getDefaultLogger();

const getDefaultLoggingConfig = (logLevel: LogLevel) => {
  return defineLoggingConfig({
    sinks: {
      'emigrate:main': getConsoleSink({ formatter: jsonLinesFormatter }),
    },
    loggers: [
      { category: ['logtape', 'meta'], sinks: [] },
      { category: 'emigrate', lowestLevel: logLevel, sinks: ['emigrate:main'] },
    ],
  });
};

export const createEmigrateContext = async ({
  command,
  cwd = process.cwd(),
  config: inlineConfig = {},
  forceTypeScriptConfigSupport = false,
  abortSignal,
}: ContextOptions): Promise<EmigrateContext> => {
  const emigrateConfig = await loadAndMergeConfig(cwd, inlineConfig, forceTypeScriptConfigSupport);

  await configureLoggingForContext(emigrateConfig);

  const { resolvedConfig, storage, hooksRunner } = await resolveConfig(emigrateConfig, cwd, command, abortSignal);
  const { migrations } = await getMigrations(hooksRunner, storage, command);

  const runtime = buildRuntimeState();
  const lifecycle = createLifecycleFunctions({
    command,
    resolvedConfig,
    storage,
    hooksRunner,
    migrations,
    abortSignal,
    runtime,
  });

  return {
    command,
    config: resolvedConfig,
    migrations,
    logger,
    ...lifecycle,
  };
};

// Helpers

async function loadAndMergeConfig(
  cwd: string,
  inlineConfig: EmigrateConfig,
  forceTypeScriptConfigSupport: boolean,
): Promise<EmigrateConfig> {
  const userConfig = await getConfig(cwd, forceTypeScriptConfigSupport);

  return mergeConfig(userConfig, inlineConfig);
}

async function configureLoggingForContext(emigrateConfig: EmigrateConfig): Promise<void> {
  const logLevel = emigrateConfig.logLevel ?? 'info';
  const loggingConfig = getDefaultLoggingConfig(logLevel);
  const currentLoggingConfig = getLoggingConfig();

  if (currentLoggingConfig) {
    await configureLogging({
      reset: true,
      ...mergeLoggingConfig(currentLoggingConfig, loggingConfig),
    });
  } else {
    await configureLogging(loggingConfig);
  }
}

function buildRuntimeState() {
  return {
    error: undefined as Error | undefined,
    hasLocked: false,
    finishedMigrations: new Map<MigrationIdentifier, FinishedMigration>(),
    lockedMigrations: new Set<RunnableMigration>(),
  };
}

function createLifecycleFunctions({
  command,
  resolvedConfig,
  storage,
  hooksRunner,
  migrations,
  abortSignal,
  runtime,
}: {
  command: EmigrateCommand;
  resolvedConfig: EmigrateResolvedConfig;
  storage: FailsafeStorage;
  hooksRunner: HooksRunner;
  migrations: ReadonlyMap<MigrationIdentifier, RunnableMigration>;
  abortSignal?: AbortSignal;
  runtime: ReturnType<typeof buildRuntimeState>;
}) {
  async function setup() {
    await hooksRunner('emigrate:command:setup', { migrations });

    const [, initError] = await storage.init();

    runtime.error ??= initError;
  }

  async function finish(migration: RunnableMigration, state: MigrationState = migration.state) {
    if (runtime.finishedMigrations.has(migration.identifier)) {
      return state.status !== 'failed';
    }

    runtime.error ??= state.error;

    const finishedMigration: FinishedMigration = {
      identifier: migration.identifier,
      meta: migration.meta,
      state,
    };

    runtime.finishedMigrations.set(migration.identifier, finishedMigration);

    await hooksRunner('emigrate:migration:done', { migration: finishedMigration });

    return state.status !== 'failed';
  }

  async function skip(migration: RunnableMigration) {
    await finish(migration, migration.state.status === 'pending' ? { status: 'skip' } : migration.state);

    return false;
  }

  async function wait(migration: RunnableMigration): Promise<boolean> {
    if (await abortIfSignaled()) {
      return false;
    }

    // If not pending or there's already an error, skip waiting for further migrations
    if (migration.state.status !== 'pending' || runtime.error) {
      return skip(migration);
    }

    await hooksRunner('emigrate:migration:wait', { migration, abortSignal });

    const [, waitError] = await storage.wait(migration);

    if (waitError) {
      runtime.error ??= MigrationWaitError.create(migration, waitError);
    }

    await finish(migration, waitError ? { status: 'failed', error: waitError } : { status: 'done' });

    return !waitError;
  }

  async function execute(migration: RunnableMigration, noExecution?: boolean): Promise<boolean> {
    if (!runtime.hasLocked) {
      throw new Error('Migrations must be locked before executing any migration');
    }

    // If not locked, wait for it instead
    if (!runtime.lockedMigrations.has(migration)) {
      return wait(migration);
    }

    if (await abortIfSignaled()) {
      return false;
    }

    // If not pending or there's already an error, skip executing further migrations
    if (migration.state.status !== 'pending' || runtime.error) {
      return skip(migration);
    }

    await hooksRunner('emigrate:migration:execute', { migration, abortSignal });

    const [, executeError] = await exec(async () => (noExecution ? undefined : migration.execute()), {
      abortRespite: resolvedConfig.abortRespite,
      abortSignal,
    });

    if (executeError) {
      runtime.error ??= MigrationRunError.create(migration, executeError);
    }

    await finish(migration, executeError ? { status: 'failed', error: executeError } : { status: 'done' });

    // Don't log migration results for non-"up" commands
    if (command !== 'up') {
      return !executeError;
    }

    const [, logError] = await storage.log(migration, executeError ? toSerializedError(executeError) : undefined);

    runtime.error ??= logError;

    return !executeError && !logError;
  }

  async function log(migration: RunnableMigration): Promise<boolean> {
    return execute(migration, true);
  }

  async function remove(migration: RunnableMigration): Promise<boolean> {
    if (await abortIfSignaled()) {
      return false;
    }

    if (migration.state.status !== 'done' && migration.state.status !== 'failed') {
      throw MigrationNotRunError.create(migration);
    }

    const [, removeError] = await storage.remove(migration);

    await finish(migration, removeError ? { status: 'failed', error: removeError } : { status: 'removed' });

    return !removeError;
  }

  async function lock(toLock: RunnableMigration[]): Promise<void> {
    if (runtime.hasLocked) {
      throw new Error('Migrations have already been locked in this context');
    }

    runtime.hasLocked = true;

    // If there's already an error, don't attempt to lock any migrations
    if (runtime.error) {
      return;
    }

    logger.debug(`Acquiring lock for ${toLock.length} migrations for command "${command}"`, () => ({
      migrations: toLock.map((m) => m.identifier),
    }));

    if (command !== 'up') {
      toLock.forEach((m) => runtime.lockedMigrations.add(m));

      logger.debug(`All migrations locked for command "${command}"`, () => ({
        migrations: toLock.map((m) => m.identifier),
      }));

      return;
    }

    const [locked, lockError] = await storage.lock(toLock);

    runtime.error ??= lockError;

    if (locked) {
      for (const lockedMigration of locked) {
        // In case the storage has lost the variable references we need to
        // find the original migration object to keep references intact
        const migration = toLock.find((m) => m.identifier === lockedMigration.identifier);

        if (migration) {
          runtime.lockedMigrations.add(migration);
        }
      }

      logger.debug(`Locked ${runtime.lockedMigrations.size} migrations for command "${command}"`, () => ({
        migrations: [...runtime.lockedMigrations].map((m) => m.identifier),
      }));
    }
  }

  async function unlock(): Promise<void> {
    if (runtime.lockedMigrations.size === 0 || command !== 'up') {
      return;
    }

    const toUnlock = [...runtime.lockedMigrations];

    // Clear locked migrations immediately to avoid double unlock calls
    runtime.lockedMigrations.clear();

    const [, unlockError] = await storage.unlock(toUnlock);

    runtime.error ??= unlockError;
  }

  async function abort(reason: Error): Promise<void> {
    runtime.error ??= reason;

    for (const migration of runtime.lockedMigrations.size > 0 ? runtime.lockedMigrations : migrations.values()) {
      if ((command === 'up' || command === 'dry-run') && migration.state.status === 'done') {
        continue;
      }

      await skip(migration);
    }

    await unlock();
  }

  async function done(): Promise<boolean> {
    await unlock();

    const [, endError] = await storage.end();

    runtime.error ??= endError;

    if (abortSignal?.aborted) {
      runtime.error ??= toError(abortSignal.reason);
    }

    // Ensure finished migrations are ordered as per the original migrations map
    const orderedIdentifiers = [...migrations.keys()];
    const finishedMigrationsInOrder = new Map<MigrationIdentifier, FinishedMigration>(
      [...runtime.finishedMigrations].sort(([a], [b]) => orderedIdentifiers.indexOf(a) - orderedIdentifiers.indexOf(b)),
    );

    await hooksRunner('emigrate:command:done', {
      migrations: finishedMigrationsInOrder,
      error: runtime.error,
    });

    return !runtime.error;
  }

  async function abortIfSignaled(): Promise<boolean> {
    if (!abortSignal?.aborted) {
      return false;
    }

    await abort(toError(abortSignal.reason));

    return true;
  }

  return { setup, execute, log, skip, remove, lock, unlock, abort, done, finish };
}

async function resolveConfig(
  emigrateConfig: EmigrateConfig,
  cwd: string,
  command: EmigrateCommand,
  abortSignal?: AbortSignal,
) {
  let storage: EmigrateStorage | undefined;
  const resolvedPlugins: Array<EmigratePlugin> = [];
  const loadedPluginNames = new Set<string>();

  // We need an ordinary for-loop here to allow plugins to add new plugins during setup
  for (let index = 0; index < (emigrateConfig.plugins ?? []).length; index++) {
    const plugin = await getOrLoadPlugin(emigrateConfig.plugins?.[index], cwd);

    if (!plugin) {
      continue;
    }

    // Avoid loading the same plugin multiple times
    if (loadedPluginNames.has(plugin.name)) {
      continue;
    }

    loadedPluginNames.add(plugin.name);
    resolvedPlugins.push(plugin);

    const setPluginLogLevel = async (logLevel: LogLevel) => {
      const currentLoggingConfig = getLoggingConfig()!;

      await configureLogging({
        reset: true,
        ...mergeLoggingConfig(currentLoggingConfig, {
          loggers: [
            { category: ['emigrate', getPluginCategory(plugin)], lowestLevel: logLevel, sinks: ['emigrate:main'] },
          ],
        }),
      });
    };

    await runHook({
      plugin,
      hookName: 'emigrate:config:setup',
      // Params is a function here so that we always get the latest config/storage values if they are modified by plugins
      params() {
        return {
          config: emigrateConfig,
          command,
          updateConfig(newConfig) {
            emigrateConfig = mergeConfig(emigrateConfig, newConfig);

            return emigrateConfig;
          },
          async setLogLevel(logLevel) {
            await setPluginLogLevel(logLevel);
          },
          setStorage(newStorage) {
            if (storage) {
              logger.warn(
                `Storage was already set to "${storage.name}" by another plugin, overwriting with storage "${newStorage.name}" from plugin "${plugin.name}"`,
              );
            }

            storage = newStorage;
          },
        };
      },
    });
  }

  storage ??= await emigrateConfig.storage;

  if (!storage) {
    logger.error('No storage configured. Please provide a storage configuration in the config file or via a plugin.');
    throw new MissingStorageError('No storage configured');
  }

  const resolvedConfig: EmigrateResolvedConfig = {
    storage,
    plugins: resolvedPlugins,
    logLevel: emigrateConfig.logLevel ?? 'info',
    color: emigrateConfig.color ?? true,
    abortRespite: emigrateConfig.abortRespite ?? DEFAULT_RESPITE_SECONDS,
  };

  const hooksRunner = getHooksRunner(resolvedConfig, command);

  await hooksRunner('emigrate:config:done', {});

  const safeStorage = createFailsafeStorage(storage, {
    abortRespite: resolvedConfig.abortRespite,
    abortSignal,
  });

  return { resolvedConfig, storage: safeStorage, hooksRunner };
}

async function getMigrations(hooksRunner: HooksRunner, storage: FailsafeStorage, command: EmigrateCommand) {
  const collectedMigrations = new Map<MigrationIdentifier, CollectedMigration>();
  const loadedMigrations = new Map<MigrationIdentifier, LoadedMigration>();
  const loadedDryRunMigrations = new Map<MigrationIdentifier, LoadedMigration>();

  await hooksRunner('emigrate:migrations:collect', {
    collectedMigrations,
    collectMigration(migration) {
      collectedMigrations.set(migration.identifier, migration);

      return collectedMigrations;
    },
  });

  await hooksRunner('emigrate:migrations:collected', {
    migrations: collectedMigrations,
  });

  for (const [identifier, collectedMigration] of collectedMigrations) {
    await hooksRunner('emigrate:migrations:load', {
      migration: collectedMigration,
      loadedMigrations,
      loadedDryRunMigrations,
      setMigrationFunction(migrationFunction) {
        loadedMigrations.set(identifier, { ...collectedMigration, execute: migrationFunction });

        return loadedMigrations;
      },
      setDryRunMigrationFunction(migrationFunction) {
        loadedDryRunMigrations.set(identifier, { ...collectedMigration, execute: migrationFunction });

        return loadedDryRunMigrations;
      },
    });
  }

  // Verify that all collected migrations have been loaded
  for (const [identifier, collectedMigration] of collectedMigrations) {
    if (!loadedMigrations.has(identifier)) {
      logger.error(
        `Migration "${identifier}" was collected but not loaded. Make sure all collected migrations are loaded by plugins.`,
        {
          migration: collectedMigration,
        },
      );

      throw MigrationNotLoadedError.create(collectedMigration);
    }

    if (!loadedDryRunMigrations.has(identifier)) {
      logger.debug(
        `Migration "${identifier}" was collected but no dry-run migration was loaded. Setting dry-run migration function to a no-op.`,
        {
          migration: collectedMigration,
        },
      );

      loadedDryRunMigrations.set(identifier, {
        ...collectedMigration,
        execute: async () => {
          /* no-op */
        },
      });
    }
  }

  // Clear collected migrations to free up memory
  collectedMigrations.clear();

  await hooksRunner('emigrate:migrations:loaded', {
    migrations: loadedMigrations,
    dryRunMigrations: loadedDryRunMigrations,
  });

  const migrationStates = new Map<MigrationIdentifier, MigrationState>();

  // Get states from storage
  for await (const entry of storage.getHistory()) {
    // Fast path for exact identifier matches (this is the common case, and the only case for projects running only Emigrate since inception)
    if (loadedMigrations.has(entry.identifier)) {
      migrationStates.set(entry.identifier, entry.state);
      continue;
    }

    // Handle cases where the logged migration identifier does not include the file extension
    // which is the case with some other migration tools that Emigrate is compatible with
    for (const identifier of loadedMigrations.keys()) {
      if (identifier.startsWith(entry.identifier)) {
        const extension = path.extname(identifier);

        if (extension && entry.identifier + extension === identifier) {
          migrationStates.set(identifier, entry.state);
          break;
        }
      }
    }
  }

  const migrations = new Map<MigrationIdentifier, RunnableMigration>(
    // Only use the real migrations for the "up" command
    [...(command === 'up' ? loadedMigrations : loadedDryRunMigrations)].map(([identifier, loadedMigration]) => [
      identifier,
      { ...loadedMigration, state: { ...(migrationStates.get(identifier) ?? { status: 'pending' }) } },
    ]),
  );

  // Clear temporary maps to free up memory
  loadedMigrations.clear();
  loadedDryRunMigrations.clear();
  migrationStates.clear();

  return { migrations };
}

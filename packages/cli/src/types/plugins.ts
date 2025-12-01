/* eslint-disable @typescript-eslint/naming-convention */
import type { EmigrateCommand, EmigrateConfig, EmigrateResolvedConfig } from './config.js';
import type { Logger, LogLevel } from './logging.js';
import type {
  CollectedMigration,
  FinishedMigration,
  LoadedMigration,
  MigrationFunction,
  MigrationIdentifier,
  RunnableMigration,
} from './migrations.js';
import type { Simplify } from './simplify.js';
import type { EmigrateStorage } from './storage.js';
import type { Awaitable, DeepPartial } from './utils.js';

export type EmigratePlugin = {
  name: string;
  hooks: {
    [K in keyof Emigrate.PluginHooks]?: Emigrate.PluginHooks[K];
  } & Partial<Record<string, unknown>>;
};

export type BasePluginHooks = {
  'emigrate:config:setup': (options: {
    command: EmigrateCommand;
    config: EmigrateConfig;
    logger: Logger;
    updateConfig: (newConfig: Simplify<DeepPartial<Omit<EmigrateConfig, 'logLevel'>>>) => EmigrateConfig;
    setLogLevel: (logLevel: LogLevel) => Promise<void>;
    setStorage: (storage: EmigrateStorage) => void;
  }) => Awaitable<void>;
  'emigrate:config:done': (options: { config: EmigrateResolvedConfig; logger: Logger }) => Awaitable<void>;
  'emigrate:migrations:collect': (options: {
    config: EmigrateResolvedConfig;
    logger: Logger;
    collectedMigrations: ReadonlyMap<MigrationIdentifier, CollectedMigration>;
    collectMigration: (migration: CollectedMigration) => ReadonlyMap<MigrationIdentifier, CollectedMigration>;
  }) => Awaitable<void>;
  'emigrate:migrations:collected': (options: {
    config: EmigrateResolvedConfig;
    logger: Logger;
    migrations: ReadonlyMap<MigrationIdentifier, CollectedMigration>;
  }) => Awaitable<void>;
  'emigrate:migrations:load': (options: {
    config: EmigrateResolvedConfig;
    logger: Logger;
    migration: CollectedMigration;
    loadedMigrations: ReadonlyMap<MigrationIdentifier, LoadedMigration>;
    loadedDryRunMigrations: ReadonlyMap<MigrationIdentifier, LoadedMigration>;
    setMigrationFunction: (migrationFunction: MigrationFunction) => ReadonlyMap<MigrationIdentifier, LoadedMigration>;
    setDryRunMigrationFunction: (
      migrationFunction: MigrationFunction,
    ) => ReadonlyMap<MigrationIdentifier, LoadedMigration>;
  }) => Awaitable<void>;
  'emigrate:migrations:loaded': (options: {
    config: EmigrateResolvedConfig;
    logger: Logger;
    migrations: ReadonlyMap<MigrationIdentifier, LoadedMigration>;
    dryRunMigrations: ReadonlyMap<MigrationIdentifier, LoadedMigration>;
  }) => Awaitable<void>;
  'emigrate:command:setup': (options: {
    command: EmigrateCommand;
    config: EmigrateResolvedConfig;
    logger: Logger;
    migrations: ReadonlyMap<MigrationIdentifier, RunnableMigration>;
  }) => Awaitable<void>;
  'emigrate:migration:wait': (options: {
    config: EmigrateResolvedConfig;
    logger: Logger;
    migration: RunnableMigration;
    abortSignal?: AbortSignal;
  }) => Awaitable<void>;
  'emigrate:migration:execute': (options: {
    config: EmigrateResolvedConfig;
    logger: Logger;
    migration: RunnableMigration;
    abortSignal?: AbortSignal;
  }) => Awaitable<void>;
  'emigrate:migration:done': (options: {
    config: EmigrateResolvedConfig;
    logger: Logger;
    migration: FinishedMigration;
  }) => Awaitable<void>;
  'emigrate:command:done': (options: {
    command: EmigrateCommand;
    config: EmigrateResolvedConfig;
    logger: Logger;
    migrations: ReadonlyMap<MigrationIdentifier, FinishedMigration>;
    error?: Error;
  }) => Awaitable<void>;
};

export type HookParameters<
  Hook extends keyof EmigratePlugin['hooks'],
  Fn = EmigratePlugin['hooks'][Hook],
> = Fn extends (...args: infer Args) => any ? Args[0] : never;

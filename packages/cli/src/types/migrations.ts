import type { Awaitable } from './utils.js';

export type MigrationIdentifier = string;

export type CollectedMigration = {
  identifier: MigrationIdentifier;
  meta: Emigrate.MigrationMetadata;
};

export type LoadedMigration = {
  identifier: MigrationIdentifier;
  meta: Emigrate.MigrationMetadata;
  execute: MigrationFunction;
};

export type RunnableMigration = {
  identifier: MigrationIdentifier;
  meta: Emigrate.MigrationMetadata;
  execute: MigrationFunction;
  state: MigrationState;
};

export type FinishedMigration = {
  identifier: MigrationIdentifier;
  meta: Emigrate.MigrationMetadata;
  state: MigrationState;
};

export type MigrationState =
  | { status: 'skip' | 'pending' | 'done' | 'removed'; error?: never }
  | { status: 'failed'; error: Error };

export type MigrationFunction = () => Awaitable<void>;

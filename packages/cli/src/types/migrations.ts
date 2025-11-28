import type { Awaitable } from './utils.js';

export type MigrationIdentifier = string;

export interface CollectedMigration {
  identifier: MigrationIdentifier;
  meta: Emigrate.MigrationMetadata;
}

export interface LoadedMigration {
  identifier: MigrationIdentifier;
  meta: Emigrate.MigrationMetadata;
  execute: MigrationFunction;
}

export interface RunnableMigration {
  identifier: MigrationIdentifier;
  meta: Emigrate.MigrationMetadata;
  execute: MigrationFunction;
  state: MigrationState;
}

export interface FinishedMigration {
  identifier: MigrationIdentifier;
  meta: Emigrate.MigrationMetadata;
  state: MigrationState;
}

export type MigrationState =
  | { status: 'skip' | 'pending' | 'done' | 'removed'; error?: never }
  | { status: 'failed'; error: Error };

export type MigrationFunction = () => Awaitable<void>;

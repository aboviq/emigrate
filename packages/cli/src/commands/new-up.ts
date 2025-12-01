/* eslint-disable no-await-in-loop */
import { createEmigrateContext } from '../context/index.js';
import { MigrationHistoryError } from '../errors.js';
import type { EmigrateConfig } from '../types/config.js';
import type { RunnableMigration } from '../types/migrations.js';
import type { Simplify } from '../types/simplify.js';

type ExtraFlags = {
  cwd?: string;
  dry?: boolean;
  limit?: number;
  from?: string;
  to?: string;
  noExecution?: boolean;
  abortSignal?: AbortSignal;
};

type UpOptions = Simplify<EmigrateConfig & ExtraFlags>;

export const upCommand = async ({
  dry,
  from,
  to,
  limit,
  abortSignal,
  noExecution,
  ...config
}: UpOptions): Promise<boolean> => {
  const context = await createEmigrateContext({ config, abortSignal, command: dry ? 'dry-run' : 'up' });

  await context.setup();

  const toRun: RunnableMigration[] = [];

  context.logger.debug(`Starting '${dry ? 'dry-run' : 'up'}' command`, () => ({
    migrations: [...context.migrations.values()],
  }));

  for (const migration of context.migrations.values()) {
    if (migration.state.status === 'done') {
      continue;
    }

    if (migration.state.status === 'failed') {
      await context.abort(MigrationHistoryError.create(migration));
      break;
    }

    if (from && migration.identifier < from) {
      await context.skip(migration);
      continue;
    }

    if (to && migration.identifier > to) {
      await context.skip(migration);
      continue;
    }

    if (limit !== undefined && toRun.length >= limit) {
      await context.skip(migration);
      continue;
    }

    toRun.push(migration);
  }

  await context.lock(toRun);

  for (const migration of toRun) {
    await (noExecution ? context.log(migration) : context.execute(migration));
  }

  return context.done();
};

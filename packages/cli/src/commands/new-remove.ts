/* eslint-disable no-await-in-loop */
import { createEmigrateContext } from '../context/index.js';
import { MigrationNotRunError, OptionNeededError } from '../errors.js';
import type { EmigrateConfig } from '../types/config.js';
import type { Simplify } from '../types/simplify.js';

type ExtraFlags = {
  cwd?: string;
  force?: boolean;
  abortSignal?: AbortSignal;
  name: string;
};

type RemoveOptions = Simplify<EmigrateConfig & ExtraFlags>;

export const removeCommand = async ({ force, abortSignal, name, ...config }: RemoveOptions): Promise<boolean> => {
  const context = await createEmigrateContext({ config, abortSignal, command: 'remove' });

  await context.setup();

  context.logger.debug(`Starting 'remove' command`, () => ({
    migrations: [...context.migrations.values()],
  }));

  for (const migration of context.migrations.values()) {
    // Ignore migrations that don't match the specified name
    if (migration.identifier !== name) {
      continue;
    }

    // Migration not in history (pending state)
    if (migration.state.status === 'pending') {
      await context.abort(MigrationNotRunError.create(migration));
      break;
    }

    // Migration is done, but force is not specified
    if (migration.state.status === 'done' && !force) {
      await context.abort(
        OptionNeededError.fromOption(
          'force',
          `The migration "${migration.identifier}" is not in a failed state. Use the "force" option to force its removal`,
        ),
      );
      break;
    }

    await context.remove(migration);
    break;
  }

  return context.done();
};

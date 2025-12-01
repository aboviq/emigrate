/* eslint-disable no-await-in-loop */
import { createEmigrateContext } from '../context/index.js';
import type { EmigrateConfig } from '../types/config.js';
import type { Simplify } from '../types/simplify.js';

type ExtraFlags = {
  cwd?: string;
  abortSignal?: AbortSignal;
};

type ListOptions = Simplify<EmigrateConfig & ExtraFlags>;

export const listCommand = async ({ abortSignal, ...config }: ListOptions): Promise<boolean> => {
  const context = await createEmigrateContext({ config, abortSignal, command: 'list' });

  await context.setup();

  context.logger.debug(`Starting 'list' command`, () => ({
    migrations: [...context.migrations.values()],
  }));

  for (const migration of context.migrations.values()) {
    await context.finish(migration);
  }

  return context.done();
};

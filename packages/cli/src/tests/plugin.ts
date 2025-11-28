import { mock } from 'node:test';
import type { BasePluginHooks } from '../types/plugins.js';
import { assertErrorEqualEnough, type Mocked } from './utils.js';
import assert from 'node:assert';

type MockedFinished = [string, 'done' | 'skip'] | [string, 'failed', Error];

export type MockedPlugin = { name: string; hooks: Mocked<BasePluginHooks> };

export const getMockedPlugin = (): MockedPlugin => {
  return {
    name: 'emigrate-plugin-mock',
    hooks: {
      'emigrate:config:setup': mock.fn(),
      'emigrate:config:done': mock.fn(),
      'emigrate:migrations:collect': mock.fn(),
      'emigrate:migrations:collected': mock.fn(),
      'emigrate:migrations:load': mock.fn(),
      'emigrate:migrations:loaded': mock.fn(),
      'emigrate:command:setup': mock.fn(),
      'emigrate:migration:execute': mock.fn(),
      'emigrate:migration:wait': mock.fn(),
      'emigrate:migration:done': mock.fn(),
      'emigrate:command:done': mock.fn(),
    },
  };
};

export const assertCommandDone = (plugin: MockedPlugin, finished: MockedFinished[]): void => {
  assert.strictEqual(
    plugin.hooks['emigrate:command:done'].mock.callCount(),
    1,
    'Unexpected number of command done calls',
  );

  const call = plugin.hooks['emigrate:command:done'].mock.calls[0];

  const finishedMigrations = [...(call?.arguments[0].migrations.values() ?? [])].map((m) =>
    m.state.status === 'failed' ? [m.identifier, 'failed', m.state.error] : [m.identifier, m.state.status],
  );

  assert.deepStrictEqual(finishedMigrations, finished, 'Finished migrations do not match');
};

export const assertCommandFailed = (plugin: MockedPlugin, error: Error): void => {
  assert.strictEqual(
    plugin.hooks['emigrate:command:done'].mock.callCount(),
    1,
    'Unexpected number of command done calls',
  );

  const call = plugin.hooks['emigrate:command:done'].mock.calls[0];

  assertErrorEqualEnough(call?.arguments[0].error, error, 'Command error does not match');
};

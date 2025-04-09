import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import { type Plugin } from '@emigrate/types';
import { getMockedReporter } from '../test-utils.js';
import newCommand from './new.js';

const originalMkdir = fs.mkdir;
const originalWriteFile = fs.writeFile;
const originalReadFile = fs.readFile;
const mkdir = mock.fn<(typeof fs)['mkdir']>();
const writeFile = mock.fn<(typeof fs)['writeFile']>();
const readFile = mock.fn<(typeof fs)['readFile']>();

describe('new', () => {
  beforeEach(() => {
    fs.mkdir = mkdir;
    fs.writeFile = writeFile;
    fs.readFile = readFile;
  });

  afterEach(() => {
    fs.mkdir = originalMkdir;
    fs.writeFile = originalWriteFile;
    fs.readFile = originalReadFile;

    mkdir.mock.resetCalls();
    writeFile.mock.resetCalls();
    readFile.mock.resetCalls();
  });

  it('generates a JavaScript template using ESM syntax by default', async () => {
    const { run } = getNewCommand();

    await run('create a new table');

    assert.equal(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.equal(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.js$/);
    assert.equal(
      writeFile.mock.calls[0]?.arguments[1],
      `/**
 * create a new table
 */
export default async () => {

};
`,
    );
  });

  it('can pick another default template by setting another extension', async () => {
    const { run } = getNewCommand();

    await run('create a new table', { extension: '.cjs' });

    assert.equal(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.equal(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.cjs$/);
    assert.equal(
      writeFile.mock.calls[0]?.arguments[1],
      `/**
 * create a new table
 */
module.exports = async () => {

};
`,
    );
  });

  it('generates an empty migration when giving an extension without a default template or template plugin', async () => {
    const { run } = getNewCommand();

    await run('create a new table', { extension: '.xml' });

    assert.equal(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.equal(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.xml$/);
    assert.equal(writeFile.mock.calls[0]?.arguments[1], '');
  });

  it('generates a migration based on a template from a plugin using .js extension by default', async () => {
    const { run } = getNewCommand([{ templates: [{ extension: '.js', template: '// This is a migration file' }] }]);

    await run('create a new table');

    assert.equal(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.equal(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.js$/);
    assert.equal(writeFile.mock.calls[0]?.arguments[1], '// This is a migration file');
  });

  it('generates a migration based on a template from a plugin using the given extension', async () => {
    const { run } = getNewCommand([
      {
        templates: [
          { extension: '.js', template: '// This is a migration file' },
          { extension: '.xml', template: '<xml></xml>' },
        ],
      },
    ]);

    await run('create a new table', { extension: '.xml' });

    assert.equal(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.equal(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.xml$/);
    assert.equal(writeFile.mock.calls[0]?.arguments[1], '<xml></xml>');
  });

  it('generates a migration based on the given template file no matter the plugins', async () => {
    readFile.mock.mockImplementationOnce((path: string) => `// Migration file: ${path}`);

    const { run } = getNewCommand([
      {
        templates: [
          { extension: '.js', template: '// This is a migration file' },
          { extension: '.xml', template: '<xml></xml>' },
        ],
      },
    ]);

    await run('create a new table', { template: 'my-file.js' });

    assert.equal(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.equal(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.js$/);
    assert.equal(writeFile.mock.calls[0]?.arguments[1], '// Migration file: /emigrate/my-file.js');
  });

  it('generates a migration based on the given template and extension', async () => {
    readFile.mock.mockImplementationOnce((path: string) => `// Migration file: ${path}`);

    const { run } = getNewCommand([
      {
        templates: [
          { extension: '.js', template: '// This is a migration file' },
          { extension: '.xml', template: '<xml></xml>' },
        ],
      },
    ]);

    await run('create a new table', { template: 'my-file.js', extension: '.ts' });

    assert.equal(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.equal(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.ts$/);
    assert.equal(writeFile.mock.calls[0]?.arguments[1], '// Migration file: /emigrate/my-file.js');
  });

  it('can use template files without extensions and then default to .js for the migration file', async () => {
    readFile.mock.mockImplementationOnce((path: string) => `// Migration file: ${path}`);

    const { run } = getNewCommand([
      {
        templates: [
          { extension: '.js', template: '// This is a migration file' },
          { extension: '.xml', template: '<xml></xml>' },
        ],
      },
    ]);

    await run('create a new table', { template: 'my-file' });

    assert.equal(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.equal(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.js$/);
    assert.equal(writeFile.mock.calls[0]?.arguments[1], '// Migration file: /emigrate/my-file');
  });

  it('can use template files without extensions and use the provided extension for the migration file', async () => {
    readFile.mock.mockImplementationOnce((path: string) => `// Migration file: ${path}`);

    const { run } = getNewCommand([
      {
        templates: [
          { extension: '.js', template: '// This is a migration file' },
          { extension: '.xml', template: '<xml></xml>' },
        ],
      },
    ]);

    await run('create a new table', { template: 'my-file', extension: '.ts' });

    assert.equal(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.equal(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.ts$/);
    assert.equal(writeFile.mock.calls[0]?.arguments[1], '// Migration file: /emigrate/my-file');
  });
});

function getNewCommand(plugins?: Plugin[]) {
  const reporter = getMockedReporter();

  const run = async (
    name: string,
    options?: Omit<Parameters<typeof newCommand>[0], 'cwd' | 'directory' | 'reporter' | 'plugins'>,
  ) => {
    return newCommand(
      {
        cwd: '/emigrate',
        directory: 'migrations',
        reporter,
        plugins: plugins ?? [],
        ...options,
      },
      name,
    );
  };

  return {
    reporter,
    run,
  };
}

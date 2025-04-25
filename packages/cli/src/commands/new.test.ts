import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import { type Plugin } from '@emigrate/types';
import { getMockedNewCommandReporter, toMigrations } from '../test-utils.js';
import { BadOptionError } from '../errors.js';
import prefixes from '../prefixes.js';
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
    const { run } = getNewCommand([]);

    await run('create a new table');

    assert.strictEqual(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.strictEqual(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.js$/);
    assert.strictEqual(
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
    const { run } = getNewCommand([]);

    await run('create a new table', { extension: '.cjs' });

    assert.strictEqual(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.strictEqual(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.cjs$/);
    assert.strictEqual(
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
    const { run } = getNewCommand([]);

    await run('create a new table', { extension: '.xml' });

    assert.strictEqual(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.strictEqual(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.xml$/);
    assert.strictEqual(writeFile.mock.calls[0]?.arguments[1], '');
  });

  it('generates a migration based on a template from a plugin using .js extension by default', async () => {
    const { run } = getNewCommand([], [{ templates: [{ extension: '.js', template: '// This is a migration file' }] }]);

    await run('create a new table');

    assert.strictEqual(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.strictEqual(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.js$/);
    assert.strictEqual(writeFile.mock.calls[0]?.arguments[1], '// This is a migration file');
  });

  it('generates a migration based on a template from a plugin using the given extension', async () => {
    const { run } = getNewCommand(
      [],
      [
        {
          templates: [
            { extension: '.js', template: '// This is a migration file' },
            { extension: '.xml', template: '<xml></xml>' },
          ],
        },
      ],
    );

    await run('create a new table', { extension: '.xml' });

    assert.strictEqual(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.strictEqual(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.xml$/);
    assert.strictEqual(writeFile.mock.calls[0]?.arguments[1], '<xml></xml>');
  });

  it('generates a migration based on the given template file no matter the plugins', async () => {
    readFile.mock.mockImplementationOnce((path: string) => `// Migration file: ${path}`);

    const { run } = getNewCommand(
      [],
      [
        {
          templates: [
            { extension: '.js', template: '// This is a migration file' },
            { extension: '.xml', template: '<xml></xml>' },
          ],
        },
      ],
    );

    await run('create a new table', { template: 'my-file.js' });

    assert.strictEqual(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.strictEqual(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.js$/);
    assert.strictEqual(writeFile.mock.calls[0]?.arguments[1], '// Migration file: /emigrate/my-file.js');
  });

  it('generates a migration based on the given template and extension', async () => {
    readFile.mock.mockImplementationOnce((path: string) => `// Migration file: ${path}`);

    const { run } = getNewCommand(
      [],
      [
        {
          templates: [
            { extension: '.js', template: '// This is a migration file' },
            { extension: '.xml', template: '<xml></xml>' },
          ],
        },
      ],
    );

    await run('create a new table', { template: 'my-file.js', extension: '.ts' });

    assert.strictEqual(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.strictEqual(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.ts$/);
    assert.strictEqual(writeFile.mock.calls[0]?.arguments[1], '// Migration file: /emigrate/my-file.js');
  });

  it('can use template files without extensions and then default to .js for the migration file', async () => {
    readFile.mock.mockImplementationOnce((path: string) => `// Migration file: ${path}`);

    const { run } = getNewCommand(
      [],
      [
        {
          templates: [
            { extension: '.js', template: '// This is a migration file' },
            { extension: '.xml', template: '<xml></xml>' },
          ],
        },
      ],
    );

    await run('create a new table', { template: 'my-file' });

    assert.strictEqual(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.strictEqual(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.js$/);
    assert.strictEqual(writeFile.mock.calls[0]?.arguments[1], '// Migration file: /emigrate/my-file');
  });

  it('can use template files without extensions and use the provided extension for the migration file', async () => {
    readFile.mock.mockImplementationOnce((path: string) => `// Migration file: ${path}`);

    const { run } = getNewCommand(
      [],
      [
        {
          templates: [
            { extension: '.js', template: '// This is a migration file' },
            { extension: '.xml', template: '<xml></xml>' },
          ],
        },
      ],
    );

    await run('create a new table', { template: 'my-file', extension: '.ts' });

    assert.strictEqual(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.strictEqual(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /_create_a_new_table\.ts$/);
    assert.strictEqual(writeFile.mock.calls[0]?.arguments[1], '// Migration file: /emigrate/my-file');
  });

  it('can use another word joiner than the default "_" for new migration files', async () => {
    const { run } = getNewCommand([]);

    await run('create a new table', { joiner: '-' });

    assert.strictEqual(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.strictEqual(writeFile.mock.callCount(), 1);
    assert.match(String(writeFile.mock.calls[0]?.arguments[0]), /-create-a-new-table\.js$/);
  });

  describe('prefix option', () => {
    it('can generate migration files without a prefix', async () => {
      const { run } = getNewCommand([]);

      await run('create a new table', { prefix: 'none' });

      assert.strictEqual(mkdir.mock.callCount(), 1);
      assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
      assert.strictEqual(writeFile.mock.callCount(), 1);
      assert.strictEqual(String(writeFile.mock.calls[0]?.arguments[0]), '/emigrate/migrations/create_a_new_table.js');
    });

    it('calculates the prefix from the previous migration file if using the "numeric" prefix', async () => {
      const { run } = getNewCommand(['0001_create_a_new_table.js', '0002_create_another_table.js']);

      await run('yet another table', { prefix: 'numeric' });

      assert.strictEqual(mkdir.mock.callCount(), 1);
      assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
      assert.strictEqual(writeFile.mock.callCount(), 1);
      assert.strictEqual(
        String(writeFile.mock.calls[0]?.arguments[0]),
        '/emigrate/migrations/0003_yet_another_table.js',
      );
    });

    it('starts with the prefix "0001" when using the "numeric" prefix and there are no previous migrations', async () => {
      const { run } = getNewCommand([]);

      await run('create a table', { prefix: 'numeric' });

      assert.strictEqual(mkdir.mock.callCount(), 1);
      assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
      assert.strictEqual(writeFile.mock.callCount(), 1);
      assert.strictEqual(String(writeFile.mock.calls[0]?.arguments[0]), '/emigrate/migrations/0001_create_a_table.js');
    });

    it('can take a function returning a string as the prefix option', async () => {
      const { run } = getNewCommand([]);

      let i = 0;
      await run('create a table', { prefix: () => String(++i) });

      assert.strictEqual(i, 1);
      assert.strictEqual(mkdir.mock.callCount(), 1);
      assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
      assert.strictEqual(writeFile.mock.callCount(), 1);
      assert.strictEqual(String(writeFile.mock.calls[0]?.arguments[0]), '/emigrate/migrations/1_create_a_table.js');
    });

    it("throws a BadOptionError if the given prefix function doesn't return a string", async () => {
      const { run } = getNewCommand([]);

      let i = 0;

      try {
        await run('create a table', {
          // @ts-expect-error It needs to be the wrong type for the test
          prefix: () => ++i,
        });

        assert.fail('Expected BadOptionError to be thrown');
      } catch (error) {
        assert.deepStrictEqual(error, BadOptionError.fromOption('prefix', 'Prefix generator must return a string'));
      }
    });

    it('can find and use the right prefix generator given its name', async () => {
      const { run } = getNewCommand([]);

      const expected = prefixes.isoLocal();

      await run('create a table', { prefix: 'iso-local' });

      assert.strictEqual(
        String(writeFile.mock.calls[0]?.arguments[0]),
        `/emigrate/migrations/${expected}_create_a_table.js`,
      );
    });
  });
});

function getNewCommand(migrationFiles: string[], plugins?: Plugin[]) {
  const reporter = getMockedNewCommandReporter();

  const run = async (
    name: string,
    options?: Omit<Parameters<typeof newCommand>[0], 'cwd' | 'directory' | 'reporter' | 'plugins' | 'getMigrations'>,
  ) => {
    return newCommand(
      {
        cwd: '/emigrate',
        directory: 'migrations',
        reporter,
        plugins: plugins ?? [],
        async getMigrations(cwd, directory) {
          return toMigrations(cwd, directory, migrationFiles);
        },
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

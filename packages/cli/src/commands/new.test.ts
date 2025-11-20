import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import { type MigrationMetadataFinished, type Plugin } from '@emigrate/types';
import { assertErrorEqualEnough, getMockedNewCommandReporter, toMigrations, type Mocked } from '../test-utils.js';
import { BadOptionError } from '../errors.js';
import prefixes from '../prefixes.js';
import type { NewCommandReporter } from '../reporters/new-command.js';
import { version } from '../get-package-info.js';
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
    const { reporter, run } = getNewCommand([]);

    await run('create a new table');

    assertPreconditionsFulfilled(reporter, {
      name: /_create_a_new_table\.js$/,
      extension: '.js',
      status: 'done',
      content: `/**
 * create a new table
 */
export default async () => {

};
`,
    });
  });

  it('can pick another default template by setting another extension', async () => {
    const { reporter, run } = getNewCommand([]);

    await run('create a new table', { extension: '.cjs' });

    assertPreconditionsFulfilled(reporter, {
      name: /_create_a_new_table\.cjs$/,
      extension: '.cjs',
      status: 'done',
      content: `/**
 * create a new table
 */
module.exports = async () => {

};
`,
    });
  });

  it('generates an empty migration when giving an extension without a default template or template plugin', async () => {
    const { reporter, run } = getNewCommand([]);

    await run('create a new table', { extension: '.xml' });

    assertPreconditionsFulfilled(reporter, {
      name: /_create_a_new_table\.xml$/,
      extension: '.xml',
      status: 'done',
      content: '',
    });
  });

  it('generates a migration based on a template from a plugin using .js extension by default', async () => {
    const { reporter, run } = getNewCommand(
      [],
      [{ templates: [{ extension: '.js', template: '// This is a migration file' }] }],
    );

    await run('create a new table');

    assertPreconditionsFulfilled(reporter, {
      name: /_create_a_new_table\.js$/,
      extension: '.js',
      status: 'done',
      content: '// This is a migration file',
    });
  });

  it('generates a migration based on a template from a plugin using the given extension', async () => {
    const { reporter, run } = getNewCommand(
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

    assertPreconditionsFulfilled(reporter, {
      name: /_create_a_new_table\.xml$/,
      extension: '.xml',
      status: 'done',
      content: '<xml></xml>',
    });
  });

  it('generates a migration based on the given template file no matter the plugins', async () => {
    readFile.mock.mockImplementationOnce((async (path: string) => `// Migration file: ${path}`) as typeof fs.readFile);

    const { reporter, run } = getNewCommand(
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

    assertPreconditionsFulfilled(reporter, {
      name: /_create_a_new_table\.js$/,
      extension: '.js',
      status: 'done',
      content: '// Migration file: /emigrate/my-file.js',
    });
  });

  it('generates a migration based on the given template and extension', async () => {
    readFile.mock.mockImplementationOnce((async (path: string) => `// Migration file: ${path}`) as typeof fs.readFile);

    const { reporter, run } = getNewCommand(
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

    assertPreconditionsFulfilled(reporter, {
      name: /_create_a_new_table\.ts$/,
      extension: '.ts',
      status: 'done',
      content: '// Migration file: /emigrate/my-file.js',
    });
  });

  it('can use template files without extensions and then default to .js for the migration file', async () => {
    readFile.mock.mockImplementationOnce((async (path: string) => `// Migration file: ${path}`) as typeof fs.readFile);

    const { reporter, run } = getNewCommand(
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

    assertPreconditionsFulfilled(reporter, {
      name: /_create_a_new_table\.js$/,
      extension: '.js',
      status: 'done',
      content: '// Migration file: /emigrate/my-file',
    });
  });

  it('can use template files without extensions and use the provided extension for the migration file', async () => {
    readFile.mock.mockImplementationOnce((async (path: string) => `// Migration file: ${path}`) as typeof fs.readFile);

    const { reporter, run } = getNewCommand(
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

    assertPreconditionsFulfilled(reporter, {
      name: /_create_a_new_table\.ts$/,
      extension: '.ts',
      status: 'done',
      content: '// Migration file: /emigrate/my-file',
    });
  });

  it('can use another word joiner than the default "_" for new migration files', async () => {
    const { reporter, run } = getNewCommand([]);

    await run('create a new table', { joiner: '-' });

    assertPreconditionsFulfilled(reporter, {
      name: /-create-a-new-table\.js$/,
      extension: '.js',
      status: 'done',
    });
  });

  describe('prefix option', () => {
    it('can generate migration files without a prefix', async () => {
      const { reporter, run } = getNewCommand([]);

      await run('create a new table', { prefix: 'none' });

      assertPreconditionsFulfilled(reporter, {
        name: /^create_a_new_table\.js$/,
        extension: '.js',
        status: 'done',
      });
    });

    it('calculates the prefix from the previous migration file if using the "numeric" prefix', async () => {
      const { reporter, run } = getNewCommand(['0001_create_a_new_table.js', '0002_create_another_table.js']);

      await run('yet another table', { prefix: 'numeric' });

      assertPreconditionsFulfilled(reporter, {
        name: /^0003_yet_another_table\.js$/,
        extension: '.js',
        status: 'done',
      });
    });

    it('starts with the prefix "0001" when using the "numeric" prefix and there are no previous migrations', async () => {
      const { reporter, run } = getNewCommand([]);

      await run('create a table', { prefix: 'numeric' });

      assertPreconditionsFulfilled(reporter, {
        name: /^0001_create_a_table\.js$/,
        extension: '.js',
        status: 'done',
      });
    });

    it('can take a function returning a string as the prefix option', async () => {
      const { reporter, run } = getNewCommand([]);

      let i = 0;
      await run('create a table', { prefix: () => String(++i) });

      assertPreconditionsFulfilled(reporter, {
        name: /^1_create_a_table\.js$/,
        extension: '.js',
        status: 'done',
      });
    });

    it("fails with a BadOptionError if the given prefix function doesn't return a string", async () => {
      const { reporter, run } = getNewCommand([]);

      let i = 0;

      await run('create a table', {
        // @ts-expect-error It needs to be the wrong type for the test
        prefix: () => ++i,
      });

      assertPreconditionsFailed(reporter, BadOptionError.fromOption('prefix', 'Prefix generator must return a string'));
    });

    it('can find and use the right prefix generator given its name', async () => {
      const { run } = getNewCommand([]);

      const expected = prefixes.isoLocal();

      const exitCode = await run('create a table', { prefix: 'iso-local' });

      assert.strictEqual(exitCode, 0, 'Exit code should be 0');
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
        yes: true,
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

function assertPreconditionsFulfilled(
  reporter: Mocked<NewCommandReporter>,
  expected: {
    name: RegExp;
    extension: string;
    status: MigrationMetadataFinished['status'];
    content?: string;
    error?: Error;
  },
  finishedError?: Error,
) {
  assert.strictEqual(reporter.onInit.mock.calls.length, 1);
  assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
    {
      cwd: '/emigrate',
      version,
    },
  ]);

  assert.strictEqual(reporter.onFinished.mock.calls.length, 1, 'Finished called once');
  const [, error] = reporter.onFinished.mock.calls[0]?.arguments ?? [];
  assertErrorEqualEnough(error, finishedError);

  assert.strictEqual(reporter.onNewMigration.mock.calls.length, 1, 'New migration called once');
  const [migration, content] = reporter.onNewMigration.mock.calls[0]?.arguments ?? [];
  assert.ok(migration, 'New migration called with the migration');
  assert.match(migration.name, expected.name, 'New migration called with the name');
  assert.strictEqual(migration.extension, expected.extension, 'New migration called with the extension');
  assert.strictEqual(migration.directory, 'migrations', 'New migration called with the directory');
  assert.strictEqual(migration.cwd, '/emigrate', 'New migration called with the cwd');
  assert.ok(migration.filePath.startsWith('/emigrate/migrations/'), 'New migration called with the correct path');

  if (expected.content !== undefined) {
    assert.strictEqual(content, expected.content, 'New migration called with the correct content');
  }

  if (expected.status === 'done') {
    assert.strictEqual(reporter.onMigrationSuccess.mock.calls.length, 1, 'Success called once');
    const [migration] = reporter.onMigrationSuccess.mock.calls[0]?.arguments ?? [];
    assert.ok(migration, 'Success called with the migration');
    assert.match(migration.name, expected.name, 'Success called with the name');
    assert.strictEqual(migration.extension, expected.extension, 'Success called with the extension');
    assert.strictEqual(migration.status, expected.status, 'Success called with the status');
    assert.strictEqual(mkdir.mock.callCount(), 1);
    assert.deepStrictEqual(mkdir.mock.calls[0]?.arguments, ['/emigrate/migrations', { recursive: true }]);
    assert.strictEqual(writeFile.mock.callCount(), 1);
    assert.strictEqual(
      String(writeFile.mock.calls[0]?.arguments[0]),
      migration.filePath,
      'fs.writeFile called with the correct path',
    );
    if (expected.content !== undefined) {
      assert.strictEqual(
        writeFile.mock.calls[0]?.arguments[1],
        expected.content,
        'fs.writeFile called with the correct content',
      );
    }
  } else if (expected.status === 'skipped') {
    assert.strictEqual(reporter.onMigrationSkip.mock.calls.length, 1, 'Skip called once');
    const [migration] = reporter.onMigrationSkip.mock.calls[0]?.arguments ?? [];
    assert.ok(migration, 'Success called with the migration');
    assert.match(migration.name, expected.name, 'Success called with the name');
    assert.strictEqual(migration.extension, expected.extension, 'Success called with the extension');
    assert.strictEqual(migration.status, expected.status, 'Success called with the status');
  } else if (expected.status === 'failed') {
    assert.strictEqual(reporter.onMigrationError.mock.calls.length, 1, 'Error called once');
    const [migration, error] = reporter.onMigrationError.mock.calls[0]?.arguments ?? [];
    assert.ok(migration, 'Success called with the migration');
    assert.match(migration.name, expected.name, 'Success called with the name');
    assert.strictEqual(migration.extension, expected.extension, 'Success called with the extension');
    assert.strictEqual(migration.status, expected.status, 'Success called with the status');
    assertErrorEqualEnough(error, expected.error);
  }
}

function assertPreconditionsFailed(reporter: Mocked<NewCommandReporter>, finishedError?: Error) {
  assert.strictEqual(reporter.onInit.mock.calls.length, 1);
  assert.deepStrictEqual(reporter.onInit.mock.calls[0]?.arguments, [
    {
      cwd: '/emigrate',
      version,
    },
  ]);

  assert.strictEqual(reporter.onFinished.mock.calls.length, 1, 'Finished called once');
  const [, error] = reporter.onFinished.mock.calls[0]?.arguments ?? [];
  assertErrorEqualEnough(error, finishedError);

  assert.strictEqual(reporter.onNewMigration.mock.calls.length, 0, 'New migration never called');
}

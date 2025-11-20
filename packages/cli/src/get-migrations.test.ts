import fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { getMigrations } from './get-migrations.js';

const originalOpendir = fs.opendir;
const opendirMock = mock.fn(originalOpendir);

describe('get-migrations', () => {
  beforeEach(() => {
    fs.opendir = opendirMock;
  });

  afterEach(() => {
    opendirMock.mock.restore();
    fs.opendir = originalOpendir;
  });

  it('should skip files with leading periods', async () => {
    // @ts-expect-error -- mocking --
    opendirMock.mock.mockImplementation(async function* () {
      yield* [
        { name: '.foo.js', isFile: () => true },
        { name: 'bar.js', isFile: () => true },
        { name: 'baz.js', isFile: () => true },
      ];
    });

    const migrations = await getMigrations('/cwd/', 'directory');

    assert.deepStrictEqual(migrations, [
      {
        name: 'bar.js',
        filePath: '/cwd/directory/bar.js',
        relativeFilePath: 'directory/bar.js',
        extension: '.js',
        directory: 'directory',
        cwd: '/cwd/',
      },
      {
        name: 'baz.js',
        filePath: '/cwd/directory/baz.js',
        relativeFilePath: 'directory/baz.js',
        extension: '.js',
        directory: 'directory',
        cwd: '/cwd/',
      },
    ]);
  });

  it('should skip files with leading underscores', async () => {
    // @ts-expect-error -- mocking --
    opendirMock.mock.mockImplementation(async function* () {
      yield* [
        { name: '_foo.js', isFile: () => true },
        { name: 'bar.js', isFile: () => true },
        { name: 'baz.js', isFile: () => true },
      ];
    });

    const migrations = await getMigrations('/cwd/', 'directory');

    assert.deepStrictEqual(migrations, [
      {
        name: 'bar.js',
        filePath: '/cwd/directory/bar.js',
        relativeFilePath: 'directory/bar.js',
        extension: '.js',
        directory: 'directory',
        cwd: '/cwd/',
      },
      {
        name: 'baz.js',
        filePath: '/cwd/directory/baz.js',
        relativeFilePath: 'directory/baz.js',
        extension: '.js',
        directory: 'directory',
        cwd: '/cwd/',
      },
    ]);
  });

  it('should skip files without file extensions', async () => {
    // @ts-expect-error -- mocking --
    opendirMock.mock.mockImplementation(async function* () {
      yield* [
        { name: 'foo', isFile: () => true },
        { name: 'bar.js', isFile: () => true },
        { name: 'baz.js', isFile: () => true },
      ];
    });

    const migrations = await getMigrations('/cwd/', 'directory');

    assert.deepStrictEqual(migrations, [
      {
        name: 'bar.js',
        filePath: '/cwd/directory/bar.js',
        relativeFilePath: 'directory/bar.js',
        extension: '.js',
        directory: 'directory',
        cwd: '/cwd/',
      },
      {
        name: 'baz.js',
        filePath: '/cwd/directory/baz.js',
        relativeFilePath: 'directory/baz.js',
        extension: '.js',
        directory: 'directory',
        cwd: '/cwd/',
      },
    ]);
  });

  it('should skip non-files', async () => {
    // @ts-expect-error -- mocking --
    opendirMock.mock.mockImplementation(async function* () {
      yield* [
        { name: 'foo.js', isFile: () => false },
        { name: 'bar.js', isFile: () => true },
        { name: 'baz.js', isFile: () => true },
      ];
    });

    const migrations = await getMigrations('/cwd/', 'directory');

    assert.deepStrictEqual(migrations, [
      {
        name: 'bar.js',
        filePath: '/cwd/directory/bar.js',
        relativeFilePath: 'directory/bar.js',
        extension: '.js',
        directory: 'directory',
        cwd: '/cwd/',
      },
      {
        name: 'baz.js',
        filePath: '/cwd/directory/baz.js',
        relativeFilePath: 'directory/baz.js',
        extension: '.js',
        directory: 'directory',
        cwd: '/cwd/',
      },
    ]);
  });

  it('should sort them in lexicographical order', async () => {
    // @ts-expect-error -- mocking --
    opendirMock.mock.mockImplementation(async function* () {
      yield* [
        { name: 'foo.js', isFile: () => true },
        { name: 'bar_data.js', isFile: () => true },
        { name: 'bar.js', isFile: () => true },
        { name: 'baz.js', isFile: () => true },
      ];
    });

    const migrations = await getMigrations('/cwd/', 'directory');

    assert.deepStrictEqual(migrations, [
      {
        name: 'bar.js',
        filePath: '/cwd/directory/bar.js',
        relativeFilePath: 'directory/bar.js',
        extension: '.js',
        directory: 'directory',
        cwd: '/cwd/',
      },
      {
        name: 'bar_data.js',
        filePath: '/cwd/directory/bar_data.js',
        relativeFilePath: 'directory/bar_data.js',
        extension: '.js',
        directory: 'directory',
        cwd: '/cwd/',
      },
      {
        name: 'baz.js',
        filePath: '/cwd/directory/baz.js',
        relativeFilePath: 'directory/baz.js',
        extension: '.js',
        directory: 'directory',
        cwd: '/cwd/',
      },
      {
        name: 'foo.js',
        filePath: '/cwd/directory/foo.js',
        relativeFilePath: 'directory/foo.js',
        extension: '.js',
        directory: 'directory',
        cwd: '/cwd/',
      },
    ]);
  });
});

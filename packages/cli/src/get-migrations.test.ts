import fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { getMigrations } from './get-migrations.js';

const originalReaddir = fs.readdir;
const readdirMock = mock.fn(originalReaddir);

describe('get-migrations', () => {
  beforeEach(() => {
    fs.readdir = readdirMock;
  });

  afterEach(() => {
    readdirMock.mock.restore();
    fs.readdir = originalReaddir;
  });

  it('should skip files with leading periods', async () => {
    readdirMock.mock.mockImplementation(async () => ['.foo.js', 'bar.js', 'baz.js']);

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
    readdirMock.mock.mockImplementation(async () => ['_foo.js', 'bar.js', 'baz.js']);

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
    readdirMock.mock.mockImplementation(async () => ['foo', 'bar.js', 'baz.js']);

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
    readdirMock.mock.mockImplementation(async () => ['foo.js', 'bar_data.js', 'bar.js', 'baz.js']);

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

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeMigrationName } from './index.js';

describe('sanitizeMigrationName', () => {
  it('should replace spaces with underscores', () => {
    assert.strictEqual(sanitizeMigrationName('foo bar'), 'foo_bar');
  });

  it('should replace disallowed filename characters with underscores', () => {
    assert.strictEqual(sanitizeMigrationName('foo>bar'), 'foo_bar');
    assert.strictEqual(sanitizeMigrationName('foo<bar'), 'foo_bar');
    assert.strictEqual(sanitizeMigrationName('foo?bar'), 'foo_bar');
    assert.strictEqual(sanitizeMigrationName('foo:bar'), 'foo_bar');
    assert.strictEqual(sanitizeMigrationName('foo/bar'), 'foo_bar');
    assert.strictEqual(sanitizeMigrationName('foo\\bar'), 'foo_bar');
    assert.strictEqual(sanitizeMigrationName('foo*bar'), 'foo_bar');
    assert.strictEqual(sanitizeMigrationName('foo|bar'), 'foo_bar');
    assert.strictEqual(sanitizeMigrationName('foo"bar'), 'foo_bar');
    assert.strictEqual(sanitizeMigrationName("foo'bar"), 'foo_bar');
  });

  it('should replace consecutive disallowed characters with only one underscore', () => {
    assert.strictEqual(sanitizeMigrationName('foo? :bar'), 'foo_bar');
  });

  it('should remove leading disallowed characters', () => {
    assert.strictEqual(sanitizeMigrationName('_? :*<>foo'), 'foo');
  });

  it('should remove trailing disallowed characters', () => {
    assert.strictEqual(sanitizeMigrationName('foo_? :*<>'), 'foo');
  });

  it('should lower case the filename', () => {
    assert.strictEqual(sanitizeMigrationName('Are you, Foo?'), 'are_you_foo');
  });
});

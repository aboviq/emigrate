import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeName } from './sanitize-name.js';

describe('sanitizeName', () => {
  it('should replace spaces with underscores by default', () => {
    assert.strictEqual(sanitizeName('foo bar'), 'foo_bar');
  });

  it('should replace spaces with the provided joiner', () => {
    assert.strictEqual(sanitizeName('foo bar', '-'), 'foo-bar');
  });

  it('should replace disallowed filename characters with underscores by default', () => {
    assert.strictEqual(sanitizeName('foo>bar'), 'foo_bar');
    assert.strictEqual(sanitizeName('foo<bar'), 'foo_bar');
    assert.strictEqual(sanitizeName('foo?bar'), 'foo_bar');
    assert.strictEqual(sanitizeName('foo:bar'), 'foo_bar');
    assert.strictEqual(sanitizeName('foo/bar'), 'foo_bar');
    assert.strictEqual(sanitizeName('foo\\bar'), 'foo_bar');
    assert.strictEqual(sanitizeName('foo*bar'), 'foo_bar');
    assert.strictEqual(sanitizeName('foo|bar'), 'foo_bar');
    assert.strictEqual(sanitizeName('foo"bar'), 'foo_bar');
    assert.strictEqual(sanitizeName("foo'bar"), 'foo_bar');
  });

  it('should replace disallowed filename characters with the provided joiner', () => {
    assert.strictEqual(sanitizeName('foo>bar', '-'), 'foo-bar');
    assert.strictEqual(sanitizeName('foo<bar', '-'), 'foo-bar');
    assert.strictEqual(sanitizeName('foo?bar', '-'), 'foo-bar');
    assert.strictEqual(sanitizeName('foo:bar', '-'), 'foo-bar');
    assert.strictEqual(sanitizeName('foo/bar', '-'), 'foo-bar');
    assert.strictEqual(sanitizeName('foo\\bar', '-'), 'foo-bar');
    assert.strictEqual(sanitizeName('foo*bar', '-'), 'foo-bar');
    assert.strictEqual(sanitizeName('foo|bar', '-'), 'foo-bar');
    assert.strictEqual(sanitizeName('foo"bar', '-'), 'foo-bar');
    assert.strictEqual(sanitizeName("foo'bar", '-'), 'foo-bar');
  });

  it('should replace consecutive disallowed characters with only one underscore by default', () => {
    assert.strictEqual(sanitizeName('foo? :bar'), 'foo_bar');
  });

  it('should replace consecutive disallowed characters with only one occurrence of the provided joiner', () => {
    assert.strictEqual(sanitizeName('foo? :bar', '-'), 'foo-bar');
  });

  it('should remove leading disallowed characters', () => {
    assert.strictEqual(sanitizeName('_? :*<>foo'), 'foo');
  });

  it('should remove trailing disallowed characters', () => {
    assert.strictEqual(sanitizeName('foo_? :*<>'), 'foo');
  });

  it('should keep upper cased letters in the filename', () => {
    assert.strictEqual(sanitizeName('Are you, Foo?'), 'Are_you_Foo');
  });
});

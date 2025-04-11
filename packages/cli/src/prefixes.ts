import type { MigrationMetadata } from '@emigrate/types';
import kebabCase from 'kebab-case';

export type PrefixGenerator = (name: string, lastMigration?: MigrationMetadata) => string;

/**
 * Get a numeric prefix generator with a specific length
 *
 * The generator will return a number that is one higher than the last migration's number.
 *
 * @param length The length of the numeric prefix
 * @returns A numeric prefix generator
 */
export const numeric =
  (length: number): PrefixGenerator =>
  (_, lastMigration) => {
    const number = Number.parseInt(lastMigration?.name ?? '0', 10) + 1;

    if (Number.isNaN(number)) {
      return '1'.padStart(length, '0');
    }

    return number.toString().padStart(length, '0');
  };

const timestamp = () => new Date().toISOString().split('.')[0]!.replaceAll(/[-:T]/g, '');

const timestampLocal = () => {
  const date = new Date();

  return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
    .toISOString()
    .split('.')[0]!
    .replaceAll(/[-:T]/g, '');
};

const iso = () => new Date().toISOString().split('.')[0]!.replaceAll(':', '.');

const isoLocal = () => {
  const date = new Date();

  return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
    .toISOString()
    .split('.')[0]!
    .replaceAll(':', '.');
};

const unix = () => Math.floor(Date.now() / 1000).toString();

const unixMs = () => Date.now().toString();

const none = () => '';

type Kebab<T extends string, A extends string = ''> = T extends `${infer F}${infer R}`
  ? Kebab<R, `${A}${F extends Lowercase<F> ? '' : '-'}${Lowercase<F>}`>
  : A;

type StandardPrefixGenerator = keyof StandardPrefixGenerators;

export type StandardPrefix = Kebab<StandardPrefixGenerator>;

export type StandardPrefixGenerators = {
  /**
   * Get a timestamp string in the format YYYYMMDDHHmmss based on the current UTC time
   *
   * @returns A timestamp string in the format YYYYMMDDHHmmss
   */
  timestamp: () => string;
  /**
   * Get a timestamp string in the format YYYYMMDDHHmmss based on the current local time
   *
   * @returns A timestamp string in the format YYYYMMDDHHmmss
   */
  timestampLocal: () => string;
  /**
   * Get a timestamp string in ISO format YYYY-MM-DDTHH.mm.ss based on the current UTC time
   *
   * @returns A timestamp string in the format YYYY-MM-DDTHH.mm.ss
   */
  iso: () => string;
  /**
   * Get a timestamp string in ISO format YYYY-MM-DDTHH.mm.ss based on the current local time
   *
   * @returns A timestamp string in the format YYYY-MM-DDTHH.mm.ss
   */
  isoLocal: () => string;
  /**
   * Get a unix timestamp in seconds since the epoch based on the current UTC time
   *
   * @returns A timestamp in seconds
   */
  unix: () => string;
  /**
   * Get a unix timestamp in milliseconds since the epoch based on the current UTC time
   *
   * @returns A timestamp in milliseconds
   */
  unixMs: () => string;
  /**
   * Get a four digit numeric prefix based on the last migration
   *
   * @returns A numeric prefix, e.g. "0001"
   */
  numeric: PrefixGenerator;
  /**
   * Don't use a prefix for the migration name
   */
  none: () => string;
};

const prefixes: StandardPrefixGenerators = {
  timestamp,
  timestampLocal,
  iso,
  isoLocal,
  unix,
  unixMs,
  numeric: numeric(4),
  none,
};

export default prefixes;

export const isStandardPrefix = (prefix?: unknown): prefix is StandardPrefix => {
  return typeof prefix === 'string' && kebabCase.reverse(prefix) in prefixes;
};

export const isValidPrefix = (prefix: unknown): prefix is StandardPrefix | PrefixGenerator | undefined => {
  return prefix === undefined || isStandardPrefix(prefix) || typeof prefix === 'function';
};

export const getPrefixGenerator = (prefix: StandardPrefix | PrefixGenerator): PrefixGenerator => {
  if (typeof prefix === 'function') {
    return prefix;
  }

  return prefixes[kebabCase.reverse(prefix) as StandardPrefixGenerator];
};

export const standardPrefixOptions: string[] = Object.keys(prefixes).map((prefix) => kebabCase(prefix));

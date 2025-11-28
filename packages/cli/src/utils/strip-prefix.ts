export const stripPrefix = (value: string, prefixes: string[]): string => {
  for (const prefix of prefixes) {
    if (value.startsWith(prefix)) {
      return value.slice(prefix.length);
    }
  }

  return value;
};

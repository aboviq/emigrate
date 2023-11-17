export const withLeadingPeriod = (string: string) => (string.startsWith('.') ? string : `.${string}`);

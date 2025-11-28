const toArray = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
};

export const mergeRecursively = (
  defaults: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...defaults };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === undefined) {
      continue;
    }

    const existingValue = result[key];

    if (existingValue === null || existingValue === undefined) {
      result[key] = value;
      continue;
    }

    if (Array.isArray(existingValue) || Array.isArray(value)) {
      result[key] = [...toArray(existingValue), ...toArray(value)];
      continue;
    }

    if (typeof existingValue === 'object' && typeof value === 'object') {
      result[key] = mergeRecursively(existingValue as Record<string, unknown>, value as Record<string, unknown>);
      continue;
    }

    result[key] = value;
  }

  return result;
};

/**
 * A utility function to sanitize a migration name so that it can be used as a filename
 *
 * @param name A migration name to sanitize
 * @param joiner The character to use to join words and replace illegal filename characters in the migration name
 * @returns A sanitized migration name that can be used as a filename
 */
export const sanitizeName = (name: string, joiner = '_'): string => {
  return name
    .replaceAll(/[\W/\\:|*?'"<>_]+/g, ' ')
    .trim()
    .replaceAll(' ', joiner);
};

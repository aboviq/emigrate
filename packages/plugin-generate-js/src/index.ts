import { getTimestampPrefix, sanitizeMigrationName } from '@emigrate/plugin-tools';
import { type GenerateMigrationFunction } from '@emigrate/types';

export const generateMigration: GenerateMigrationFunction = async (name) => {
  return {
    filename: `${getTimestampPrefix()}_${sanitizeMigrationName(name)}.js`,
    content: `// ${name}
export default async () => {

};
`,
  };
};

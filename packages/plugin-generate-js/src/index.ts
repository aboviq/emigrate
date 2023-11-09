import { createGeneratorPlugin, getTimestampPrefix, sanitizeMigrationName } from '@emigrate/plugin-tools';

export default createGeneratorPlugin(async (name) => {
  return {
    filename: `${getTimestampPrefix()}_${sanitizeMigrationName(name)}.js`,
    content: `// ${name}
export default async () => {

};
`,
  };
});

/* eslint-disable @typescript-eslint/naming-convention */
import type { TemplatePlugin } from '@emigrate/types';

export const DEFAULT_RESPITE_SECONDS = 10;

const commonJsTemplate = `
/**
 * {{name}}
 */
module.exports = async () => {

};
`.trimStart();

const esModuleTemplate = `
/**
 * {{name}}
 */
export default async () => {

};
`.trimStart();

export const DEFAULT_TEMPLATE_PLUGIN: TemplatePlugin = {
  templates: [
    {
      extension: '.js',
      description: 'JavaScript template (ESM)',
      template: esModuleTemplate,
    },
    {
      extension: '.ts',
      description: 'TypeScript template (ESM)',
      template: esModuleTemplate,
    },
    {
      extension: '.mjs',
      description: 'JavaScript template (ESM)',
      template: esModuleTemplate,
    },
    {
      extension: '.mts',
      description: 'TypeScript template (ESM)',
      template: esModuleTemplate,
    },
    {
      extension: '.cjs',
      description: 'JavaScript template (CJS)',
      template: commonJsTemplate,
    },
    {
      extension: '.cts',
      description: 'TypeScript template (CJS)',
      template: commonJsTemplate,
    },
  ],
};

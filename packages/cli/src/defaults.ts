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
      extension: '.cjs',
      template: commonJsTemplate,
    },
    {
      extension: '.js',
      template: esModuleTemplate,
    },
    {
      extension: '.mjs',
      template: esModuleTemplate,
    },
    {
      extension: '.cts',
      template: commonJsTemplate,
    },
    {
      extension: '.ts',
      template: esModuleTemplate,
    },
    {
      extension: '.mts',
      template: esModuleTemplate,
    },
  ],
};

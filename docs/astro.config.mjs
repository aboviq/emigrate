import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: 'Emigrate',
      social: {
        github: 'https://github.com/aboviq/emigrate',
      },
      editLink: {
        baseUrl: 'https://github.com/aboviq/emigrate/edit/main/docs/',
      },
      sidebar: [
        {
          label: 'Introduction',
          items: [
            {
              label: "What's Emigrate?",
              link: '/intro/whats-emigrate/',
            },
            {
              label: 'Quick Start',
              link: '/intro/quick-start/',
            },
          ],
        },
        {
          label: 'Plugins',
          items: [
            {
              label: 'Introduction',
              link: '/plugins/',
            },
            {
              label: 'Storage Plugins',
              collapsed: true,
              items: [
                { label: 'Introduction', link: '/plugins/storage/' },
                { label: 'File System', link: '/plugins/storage/file-system/' },
                { label: 'MySQL', link: '/plugins/storage/mysql/' },
              ],
            },
            {
              label: 'Loader Plugins',
              collapsed: true,
              items: [
                { label: 'Introduction', link: '/plugins/loaders/' },
                { label: 'Default Loader', link: '/plugins/loaders/default/' },
                { label: 'MySQL Loader', link: '/plugins/loaders/mysql/' },
              ],
            },
            {
              label: 'Reporters',
              collapsed: true,
              items: [
                { label: 'Introduction', link: '/plugins/reporters/' },
                { label: 'Default Reporter', link: '/plugins/reporters/default/', badge: 'WIP' },
                { label: 'Pino Reporter', link: '/plugins/reporters/pino/', badge: 'WIP' },
              ],
            },
          ],
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'reference' },
        },
      ],
    }),
  ],
});

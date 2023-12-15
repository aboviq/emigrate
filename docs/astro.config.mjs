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
          label: 'Getting Started',
          link: '/getting-started/',
        },
        {
          label: 'Storage Plugins',
          items: [
            { label: 'Introduction', link: '/storage/' },
            { label: 'File System', link: '/storage/file-system/' },
            { label: 'MySQL', link: '/storage/mysql/' },
          ],
        },
        {
          label: 'Loader Plugins',
          items: [
            { label: 'Introduction', link: '/loaders/' },
            { label: 'Default Loader', link: '/loaders/default/' },
            { label: 'MySQL Loader', link: '/loaders/mysql/' },
          ],
        },
        {
          label: 'Reporters',
          items: [
            { label: 'Introduction', link: '/reporters/' },
            { label: 'Default Reporter', link: '/reporters/default/', badge: 'WIP' },
            { label: 'Pino Reporter', link: '/reporters/pino/', badge: 'WIP' },
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

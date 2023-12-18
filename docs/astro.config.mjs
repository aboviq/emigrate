import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: 'Emigrate',
      favicon: '/favicon.ico',
      head: [
        {
          tag: 'link',
          attrs: {
            rel: 'apple-touch-icon',
            type: 'image/png',
            href: '/apple-touch-icon.png',
            sizes: '180x180',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'icon',
            type: 'image/png',
            href: '/favicon-32x32.png',
            sizes: '32x32',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'icon',
            type: 'image/png',
            href: '/favicon-16x16.png',
            sizes: '16x16',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'manifest',
            href: '/site.webmanifest',
          },
        },
      ],
      social: {
        github: 'https://github.com/aboviq/emigrate',
      },
      editLink: {
        baseUrl: 'https://github.com/aboviq/emigrate/edit/main/docs/',
      },
      components: {
        PageTitle: './src/components/PageTitle.astro',
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
            {
              label: 'FAQ',
              link: '/intro/faq/',
            },
          ],
        },
        {
          label: 'Commands',
          items: [
            {
              label: 'emigrate up',
              link: '/commands/up/',
            },
            {
              label: 'emigrate list',
              link: '/commands/list/',
            },
            {
              label: 'emigrate new',
              link: '/commands/new/',
            },
            {
              label: 'emigrate remove',
              link: '/commands/remove/',
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

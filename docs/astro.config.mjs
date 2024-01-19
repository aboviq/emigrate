import process from 'node:process';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

const base = process.env.ASTRO_BASE || '';

// https://astro.build/config
export default defineConfig({
  site: process.env.ASTRO_SITE ?? 'http://localhost:4321',
  base: base || undefined,
  integrations: [
    starlight({
      title: 'Emigrate',
      favicon: '/favicon.ico',
      customCss: ['./src/tailwind.css'],
      head: [
        {
          tag: 'link',
          attrs: {
            rel: 'apple-touch-icon',
            type: 'image/png',
            href: `${base}/apple-touch-icon.png`,
            sizes: '180x180',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'icon',
            type: 'image/png',
            href: `${base}/favicon-32x32.png`,
            sizes: '32x32',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'icon',
            type: 'image/png',
            href: `${base}/favicon-16x16.png`,
            sizes: '16x16',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'manifest',
            href: `${base}/site.webmanifest`,
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
          label: 'Guides',
          items: [
            {
              label: 'Using TypeScript',
              link: '/guides/typescript/',
            },
            {
              label: 'Baseline',
              link: '/guides/baseline/',
            },
          ],
        },
        {
          label: 'Plugins',
          items: [
            {
              label: 'Plugins Introduction',
              link: '/plugins/',
            },
            {
              label: 'Storage Plugins',
              collapsed: true,
              items: [
                {
                  label: 'Storage Plugins',
                  link: '/plugins/storage/',
                },
                {
                  label: 'File System',
                  link: '/plugins/storage/file-system/',
                },
                {
                  label: 'PostgreSQL',
                  link: '/plugins/storage/postgres/',
                },
                {
                  label: 'MySQL',
                  link: '/plugins/storage/mysql/',
                },
              ],
            },
            {
              label: 'Loader Plugins',
              collapsed: true,
              items: [
                {
                  label: 'Loader Plugins',
                  link: '/plugins/loaders/',
                },
                {
                  label: 'Default Loader',
                  link: '/plugins/loaders/default/',
                },
                {
                  label: 'PostgreSQL Loader',
                  link: '/plugins/loaders/postgres/',
                },
                {
                  label: 'MySQL Loader',
                  link: '/plugins/loaders/mysql/',
                },
              ],
            },
            {
              label: 'Reporters',
              collapsed: true,
              items: [
                {
                  label: 'Reporters',
                  link: '/plugins/reporters/',
                },
                {
                  label: 'Default Reporter',
                  link: '/plugins/reporters/default/',
                },
                {
                  label: 'Pino Reporter',
                  link: '/plugins/reporters/pino/',
                },
              ],
            },
            {
              label: 'Generator Plugins',
              collapsed: true,
              items: [
                {
                  label: 'Generator Plugins',
                  link: '/plugins/generators/',
                },
                {
                  label: 'JavaScript Generator',
                  link: '/plugins/generators/js/',
                },
                {
                  label: 'PostgreSQL Generator',
                  link: '/plugins/generators/postgres/',
                },
                {
                  label: 'MySQL Generator',
                  link: '/plugins/generators/mysql/',
                },
              ],
            },
          ],
        },
        {
          label: 'Reference',
          autogenerate: {
            directory: 'reference',
          },
        },
      ],
    }),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});

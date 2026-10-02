import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/* The site's public address. Link previews (LinkedIn, Slack, mail) need full
   addresses, so the build writes it in front of each page's og:image and adds
   its og:url. A custom domain later is a change here only. */
const SITE_URL = 'https://swwallowws.github.io';

function linkPreviews(): Plugin {
  return {
    name: 'link-previews',
    transformIndexHtml(html, ctx) {
      const page = ctx.path.replace(/index\.html$/, '');
      return html
        .replace(/(<meta property="og:image" content=")\//, `$1${SITE_URL}/`)
        .replace('</head>', `  <meta property="og:url" content="${SITE_URL}${page}" />\n  </head>`);
    },
  };
}

/* One HTML entry per page so every project has a real path
   (/voxmpe/, /tabridge/, ...) on a static host. Keep in sync with the
   `page` fields in src/data/projects.ts. */
const PAGES = ['voxmpe', 'stemscribe', 'rearranged', 'tabridge', 'ysad', 'session-notes', 'intentional'];

export default defineConfig({
  plugins: [linkPreviews()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...Object.fromEntries(PAGES.map((p) => [p, resolve(__dirname, p, 'index.html')])),
      },
    },
  },
});

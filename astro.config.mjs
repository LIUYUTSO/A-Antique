import { defineConfig } from 'astro/config';

// Static output. Deployed as Cloudflare Workers static assets (see wrangler.jsonc);
// no adapter is needed because nothing is rendered on demand.
export default defineConfig({
  site: 'https://a-antique.example',
  output: 'static',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});

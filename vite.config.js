import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { GARAGE, GARAGE_START } from './src/data/cars.js';

// Dev-only: renderlarni (katalog rasmlari) diskka saqlash uchun endpoint
const saveRenders = {
  name: 'save-renders',
  configureServer(server) {
    server.middlewares.use('/__save', (req, res) => {
      const url = new URL(req.url, 'http://x');
      const name = (url.searchParams.get('name') || '').replace(/[^a-z0-9_-]/gi, '');
      if (req.method !== 'POST' || !name) { res.statusCode = 400; return res.end('bad'); }
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const dir = path.resolve('public/renders');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${name}.webp`), Buffer.concat(chunks));
        res.end('ok');
      });
    });
  },
};

// Birinchi ko'rinadigan mashina modeli JS bilan bir vaqtda yuklana boshlaydi (preload) — sayt tezroq ochiladi
let base = '/';
const preloadHero = {
  name: 'preload-hero',
  configResolved(config) { base = config.base; },
  transformIndexHtml() {
    const manifest = JSON.parse(fs.readFileSync(path.resolve('public/models/manifest.json'), 'utf8'));
    const car = GARAGE[GARAGE_START];
    const file = car.file || car.id;
    const v = manifest[file]?.v;
    return [{
      tag: 'link',
      attrs: { rel: 'preload', href: `${base}models/${file}.glb${v ? `?v=${v}` : ''}`, as: 'fetch', crossorigin: 'anonymous', fetchpriority: 'high' },
      injectTo: 'head',
    }];
  },
};

// Saytning asosiy manzili: ijtimoiy tarmoqlar preview rasmni (og:image) faqat to'liq manzil bilan oladi
const SITE_URL = (process.env.SITE_URL || 'https://hmgroup-uz.vercel.app').replace(/\/$/, '');
const socialMeta = {
  name: 'social-meta',
  transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%SITE_URL%', SITE_URL) },
};

export default defineConfig({
  // GitHub Pages uchun: BASE_PATH=/HM-group/ (npm run deploy:github beradi); Vercel va lokalda — '/'
  base: process.env.BASE_PATH || '/',
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: { main: path.resolve('index.html') },
    },
    chunkSizeWarningLimit: 1500,
  },
  plugins: [saveRenders, socialMeta, preloadHero],
});

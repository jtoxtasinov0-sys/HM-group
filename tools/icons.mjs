// Sayt ikonkalari (favicon, telefon ekrani) — HM logotipidan: npm run icons
// Logotip shakli src/logo.js da. Natija public/ ga yoziladi.
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HM_W, HM_H, HM_D } from '../src/logo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BG = '#0F3266'; // logotip foni

/** Kvadrat ikonka: ko'k fon, o'rtada oq HM. mark — logo kengligi (ikonka ulushi) */
function iconSvg(size, { mark = 0.74, radius = 0 } = {}) {
  const s = (size * mark) / HM_W;
  const x = (size - HM_W * s) / 2;
  const y = (size - HM_H * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size * radius}" fill="${BG}"/>
    <path fill="#fff" transform="translate(${x} ${y}) scale(${s})" d="${HM_D}"/>
  </svg>`;
}

const ICONS = [
  { file: 'favicon-32.png', size: 32, radius: 0.22, mark: 0.8 },
  { file: 'apple-touch-icon.png', size: 180, mark: 0.66 }, // iOS burchaklarni o'zi yumaloqlaydi
  { file: 'icon-192.png', size: 192, mark: 0.66 },
  { file: 'icon-512.png', size: 512, mark: 0.6 }, // maskable: logo xavfsiz doira ichida
];

for (const { file, size, ...opt } of ICONS) {
  await sharp(Buffer.from(iconSvg(size, opt))).png().toFile(path.join(ROOT, 'public', file));
  console.log(`public/${file}`);
}

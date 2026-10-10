// HM Group — sotuvdagi mashinalar rasmlarini veb uchun siqish.
// Ishlatish: npm run photos                              (hammasi)
//            npm run photos -- mercedes-g63-amg          (faqat tanlanganlar)
// Manba: HM_Group_mashinalar/<dir>/*.jpg (src/data/stock.js) → public/cars/<id>/1.webp, 2.webp, ...
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STOCK } from '../src/data/stock.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'HM_Group_mashinalar');
const OUT_DIR = path.join(ROOT, 'public', 'cars');

// kartochka ~420px kvadrat (retina uchun x2): qisqa tomoni 900px dan oshmaydi
const SHORT = 900;

const only = process.argv.slice(2);
const list = only.length ? STOCK.filter((c) => only.includes(c.id)) : STOCK;

for (const car of list) {
  const src = path.join(SRC_DIR, car.dir);
  const files = fs.readdirSync(src).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  if (files.length !== car.photos) console.warn(`! ${car.id}: ${files.length} ta rasm (stock.js da photos: ${car.photos})`);
  const out = path.join(OUT_DIR, car.id);
  fs.mkdirSync(out, { recursive: true });
  let total = 0;
  for (const [i, f] of files.entries()) {
    const dest = path.join(out, `${i + 1}.webp`);
    await sharp(path.join(src, f))
      .rotate() // EXIF bo'yicha to'g'rilash (telefon rasmlari)
      .resize({ width: SHORT, height: SHORT, fit: 'outside', withoutEnlargement: true })
      .webp({ quality: 78, effort: 6 })
      .toFile(dest);
    total += fs.statSync(dest).size;
  }
  console.log(`${car.id.padEnd(28)} ${files.length} ta rasm  ${(total / 1024).toFixed(0)} KB`);
}

// HM Group — telefon uchun yengil modellar (public/models/m/<id>.glb).
// Kompyuterdagi siqilgan modellardan (public/models/<id>.glb) olinadi: uchburchaklar ~3 baravar kam,
// teksturalar 512 px gacha. Telefon ekranida farq ko'rinmaydi, fayl esa ~2–3 baravar yengil —
// tezroq yuklanadi, ochiladi va GPU'ga tushadi.
// Ishlatish: npm run models:mobile            (hammasi)
//            npm run models:mobile -- g63 ship (faqat tanlanganlar)
// npm run models modelni yangilasa, bu buyruqni ham qayta ishga tushiring.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, weld, simplifyPrimitive, prune, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CARS } from '../src/data/cars.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'public', 'models');
const OUT_DIR = path.join(SRC_DIR, 'm');
fs.mkdirSync(OUT_DIR, { recursive: true });

// maxTris — telefon versiyasidagi uchburchaklar; tex — eng katta tekstura (px)
const MODELS = {
  g63: { maxTris: 85000 }, maybach: { maxTris: 95000 }, ev9: { maxTris: 85000 }, urus: { maxTris: 85000 },
  ghost: { maxTris: 95000 }, rrsport: { maxTris: 85000 }, x6: { maxTris: 70000 }, escalade: { maxTris: 85000 },
  sportage: { maxTris: 80000 }, ship: { maxTris: 90000 },
};
const TEX = 512;

// kuzov bo'yog'i (lakli yuza): kichik xato bilan soddalashtiriladi va normallari qayta hisoblanadi — dog' qolmaydi
const paintOf = (id) => {
  const res = CARS.filter((c) => (c.file || c.id) === id).flatMap((c) => [c.paintRe, c.paint2Re]).filter(Boolean);
  return (name) => res.some((re) => re.test(name));
};

/** Silliq normallar (tools/optimize-models.mjs dagi kabi): soddalashtirilgan lakli yuzada xira dog' qolmasin */
function smoothNormals(prim) {
  const pos = prim.getAttribute('POSITION')?.getArray();
  const idx = prim.getIndices()?.getArray();
  const nrm = prim.getAttribute('NORMAL');
  if (!pos || !idx || !nrm) return;
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { n[v] += nx; n[v + 1] += ny; n[v + 2] += nz; }
  }
  const old = nrm.getArray();
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]);
    if (l > 1e-12) { n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; } else { n[i] = old[i]; n[i + 1] = old[i + 1]; n[i + 2] = old[i + 2]; }
  }
  nrm.setArray(n);
}

const primTris = (p) => (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});

const MANIFEST = path.join(SRC_DIR, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const only = process.argv.slice(2);
const ids = Object.keys(MODELS).filter((id) => !only.length || only.includes(id));

for (const id of ids) {
  const t0 = Date.now();
  const cfg = MODELS[id];
  const doc = await io.read(path.join(SRC_DIR, `${id}.glb`));
  const root = doc.getRoot();
  await doc.transform(dequantize());
  // tangentlar kerak emas (three.js normal xaritani ularsiz ham chizadi) — vertekslarni bo'lib, soddalashtirishga xalaqit beradi
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) if (p.getAttribute('TANGENT')) p.setAttribute('TANGENT', null);
  await doc.transform(weld());
  const prims = root.listMeshes().flatMap((m) => m.listPrimitives());
  const before = prims.reduce((s, p) => s + primTris(p), 0);
  const isPaint = paintOf(id);
  // bo'yoq ham, qolgan qismlar ham bir xil nisbatda; bo'yoqda xato chegarasi kichikroq
  const ratio = Math.min(1, cfg.maxTris / before);
  if (ratio < 1) for (const p of prims) {
    const paint = isPaint(p.getMaterial()?.getName() || '');
    simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio, error: paint ? 0.003 : 0.01 });
    if (primTris(p) === 0) { p.dispose(); continue; }
    if (paint) smoothNormals(p);
  }
  await doc.transform(
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX], quality: 80 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const out = path.join(OUT_DIR, `${id}.glb`);
  await io.write(out, doc);
  const after = root.listMeshes().flatMap((m) => m.listPrimitives()).reduce((s, p) => s + primTris(p), 0);
  const bytes = fs.statSync(out).size;
  const v = crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex').slice(0, 10);
  // o'lcham (box) kompyuter versiyasidan olinadi — joylashuv ikkalasida bir xil
  manifest[id].m = { tris: Math.round(after), bytes, v };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  console.log(`${id.padEnd(9)} ${String(Math.round(before)).padStart(7)} -> ${String(Math.round(after)).padStart(6)} tris | ${(manifest[id].bytes / 1e6).toFixed(2)} -> ${(bytes / 1e6).toFixed(2)} MB | ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// HM Group — 3D modellarni veb uchun optimallashtirish.
// Ishlatish: npm run models            (hammasi)
//            npm run models -- g63 ship (faqat tanlanganlar)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, flatten, join, weld, simplify, prune, textureCompress, meshopt, getBounds, resample,
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'models');
fs.mkdirSync(OUT_DIR, { recursive: true });

// length — haqiqiy uzunlik (metr). rotY — old tomonini +Z ga burish (gradus).
const MODELS = [
  { id: 'g63',      src: 'mercedes_benz_g-_class_amg_g_63.glb',          length: 4.87, rotY: 0,   maxTris: 240000 },
  { id: 'maybach',  src: 'mercedes-benz_maybach_s450.glb',               length: 5.47, rotY: 0,   maxTris: 300000 },
  { id: 'staria',   src: '2022_hyundai_staria_premium.glb',              length: 5.25, rotY: 0,   maxTris: 240000, error: 0.003 },
  { id: 'ev9',      src: '2024_kia_ev9_gt-line.glb',                     length: 5.01, rotY: 0,   maxTris: 240000, error: 0.004, tex: 512, keepTex: /^(disk|Tire|Grill|Plate|GT_Line_Badge|Light)$/ },
  { id: 'urus',     src: '2025_lamborghini_urus_se.glb',                 length: 5.12, rotY: 0,   maxTris: 240000 },
  { id: 'ghost',    src: 'rolls_royce_ghost__www.vecarz.com.glb',        length: 5.55, rotY: 0,   maxTris: 260000 },
  { id: 'rrsport',  src: '2023_land_rover_range_rover_sport.glb',        length: 4.95, rotY: 0,   maxTris: 240000 },
  { id: 'x6',       src: '2020_bmw_x6_xdrive40i.glb',                    length: 4.94, rotY: 0,   maxTris: 200000 },
  { id: 'escalade', src: '2021_cadillac_escalade_premium.glb',           length: 5.38, rotY: 0,   maxTris: 240000 },
  { id: 'sportage', src: 'kia_sportage.glb',                             length: 4.66, rotY: 0,   maxTris: 220000 },
  // M4 modeli juda og'ir (1.4M uchburchak / 38 MB) — saytga qo'shilmagan
  { id: 'ship',     src: 'cargo_ship_loaded.glb',                        length: null, rotY: 0,   maxTris: 200000, tex: 1024 },
];

const only = process.argv.slice(2);
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const list = only.length ? MODELS.filter((m) => only.includes(m.id)) : MODELS;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});

const countTris = (doc) => {
  let t = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices();
    t += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
  }
  return Math.round(t);
};

for (const cfg of list) {
  const t0 = Date.now();
  const src = path.join(ROOT, cfg.src);
  const doc = await io.read(src);
  const root = doc.getRoot();
  const before = countTris(doc);

  // Animatsiya / kamera / chiroqlar kerak emas
  root.listAnimations().forEach((a) => a.dispose());
  root.listCameras().forEach((c) => c.dispose());

  // Ko'rinmas (alpha = 0) yordamchi obyektlar o'lchamni buzadi — olib tashlaymiz
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial();
    const invisible = mat && mat.getAlphaMode() === 'BLEND' && mat.getBaseColorFactor()[3] === 0;
    const dropped = mat && cfg.dropMat && cfg.dropMat.test(mat.getName());
    if (invisible || dropped) prim.dispose();
  }

  await doc.transform(dedup(), flatten(), join({ keepNamed: false }));

  // Teksturasiz materiallarda UV/tangent kerak emas — ular vertekslarni bo'lib yuboradi
  // va soddalashtirishga xalaqit beradi.
  // keepTex: faqat shu materiallar teksturasini saqlaydi (ichki salon teksturalari tashqaridan ko'rinmaydi)
  if (cfg.keepTex) for (const mat of root.listMaterials()) {
    if (cfg.keepTex.test(mat.getName())) continue;
    mat.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null)
      .setOcclusionTexture(null).setEmissiveTexture(null);
  }

  const texturedMats = new Set();
  for (const tex of root.listTextures()) for (const p of tex.listParents()) {
    if (p.propertyType === 'Material') texturedMats.add(p);
    else for (const pp of p.listParents()) if (pp.propertyType === 'Material') texturedMats.add(pp);
  }
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const textured = texturedMats.has(prim.getMaterial());
    // tangentlarni three.js o'zi hisoblaydi — har doim olib tashlaymiz
    const drop = textured ? ['TEXCOORD_1', 'TANGENT'] : ['TEXCOORD_0', 'TEXCOORD_1', 'TANGENT'];
    for (const sem of drop) if (prim.getAttribute(sem)) prim.setAttribute(sem, null);
  }

  await doc.transform(weld());

  const tris = countTris(doc);
  const ratio = Math.min(1, cfg.maxTris / tris);
  if (ratio < 1) {
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: cfg.error || 0.0012 }));
  }

  // Normallashtirish: markazga, yerga (y=0), metr o'lchamiga, uzunlik +Z bo'ylab
  const scene = root.getDefaultScene() || root.listScenes()[0];
  const b = getBounds(scene);
  const sx = b.max[0] - b.min[0];
  const sz = b.max[2] - b.min[2];
  const alongX = sx > sz;
  const len = Math.max(sx, sz);
  const s = cfg.length ? cfg.length / len : 1;
  const cx = (b.max[0] + b.min[0]) / 2;
  const cz = (b.max[2] + b.min[2]) / 2;
  const wrap = doc.createNode('root');
  const kids = scene.listChildren();
  const inner = doc.createNode('center').setTranslation([-cx, -b.min[1], -cz]);
  kids.forEach((k) => { scene.removeChild(k); inner.addChild(k); });
  const deg = (alongX ? 90 : 0) + cfg.rotY;
  const r = (deg * Math.PI) / 180;
  wrap.setScale([s, s, s]).setRotation([0, Math.sin(r / 2), 0, Math.cos(r / 2)]);
  wrap.addChild(inner);
  scene.addChild(wrap);

  const nb = getBounds(scene);
  const box = { min: nb.min.map((v) => +v.toFixed(3)), max: nb.max.map((v) => +v.toFixed(3)) };

  await doc.transform(
    prune(),
    resample(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [cfg.tex || 1024, cfg.tex || 1024], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );

  const out = path.join(OUT_DIR, `${cfg.id}.glb`);
  await io.write(out, doc);
  const after = countTris(doc);
  // v — fayl mazmuni xeshi: sayt modelni ?v=... bilan so'raydi, shuning uchun brauzer keshi uzoq saqlay oladi
  const v = crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex').slice(0, 10);
  manifest[cfg.id] = { box, tris: after, bytes: fs.statSync(out).size, v };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  const size = (fs.statSync(out).size / 1e6).toFixed(2);
  console.log(`${cfg.id.padEnd(9)} ${String(before).padStart(8)} -> ${String(after).padStart(7)} tris | ${size} MB | scale ${s.toFixed(4)} ${alongX ? '(rotated)' : ''} | ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

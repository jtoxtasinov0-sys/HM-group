import * as THREE from 'three';
import { HM_W, HM_H, HM_D } from '../logo.js';

export const BRAND = {
  navy: '#1D3E69',
  deep: '#16335D',
  light: '#EEF2F8',
  white: '#FFFFFF',
};

export const FONT = 'Inter, "Segoe UI", Arial, sans-serif';

// willReadFrequently — canvas protsessor xotirasida chiziladi: getImageData GPU navbatini kutmaydi.
// Aks holda WebGL band paytida (sahna chizilayotganda) bitta getImageData sahifani soniyalab qotirardi.
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

/** Bir xil natija beradigan tekstura bir marta yasaladi (har chaqiruvda qayta chizilib, GPU'ga qayta yuklanmasin) */
function once(fn) {
  let v;
  return () => (v ??= fn());
}

function tex(c, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

const HM_PATH = new Path2D(HM_D);

/** "HM" logotipi (src/logo.js) — to'liq bo'yalgan. (cx, cy) — markaz, width — kengligi */
export function drawHM(ctx, cx, cy, width, color) {
  const s = width / HM_W;
  ctx.save();
  ctx.translate(cx - (HM_W * s) / 2, cy - (HM_H * s) / 2);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.fill(HM_PATH);
  ctx.restore();
}

/** HM belgisi ostida keng "GROUP" yozuvi (logo kengligiga cho'zilgan) */
function drawGroupWord(ctx, cx, y, width, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const word = 'GROUP';
  const letters = [...word].map((ch) => ctx.measureText(ch).width);
  const gap = (width - letters.reduce((a, b) => a + b, 0)) / (word.length - 1);
  let x = cx - width / 2;
  [...word].forEach((ch, i) => { ctx.fillText(ch, x, y); x += letters[i] + gap; });
  ctx.restore();
}

/** Mashina orqasidagi katta konturli nom (Taycan uslubida) */
export function makeOutlineTextTexture(text) {
  const [c, ctx] = canvas(2048, 512);
  ctx.clearRect(0, 0, 2048, 512);
  let size = 380;
  ctx.font = `600 ${size}px ${FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  while (ctx.measureText(text).width > 1920 && size > 120) {
    size -= 10;
    ctx.font = `600 ${size}px ${FONT}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.strokeText(text, 1024, 270);
  // shrift konturlari bir-birini kesib o'tadi — harf ichidagi chiziqlar o'chiriladi, faqat tashqi chegara qoladi
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillText(text, 1024, 270);
  return tex(c);
}

/** Platforma atrofidagi qora rezina halqa: radial bo'g'inlar (rasmdagi kabi segmentli) */
export function makeRubberTexture() {
  const [c, ctx] = canvas(1024, 1024);
  ctx.fillStyle = '#17181b';
  ctx.fillRect(0, 0, 1024, 1024);
  const img = ctx.getImageData(0, 0, 1024, 1024);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() - 0.5) * 10;
    img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 3;
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(512 + Math.cos(a) * 300, 512 + Math.sin(a) * 300);
    ctx.lineTo(512 + Math.cos(a) * 520, 512 + Math.sin(a) * 520);
    ctx.stroke();
  }
  return tex(c);
}

/** Yumshoq soya (mashina tagiga) */
export function makeShadowTexture() {
  // alphaMap sifatida ishlatiladi: oq — to'liq soya, qora — shaffof
  const [c, ctx] = canvas(256, 512);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 512);
  ctx.filter = 'blur(22px)';
  ctx.fillStyle = '#9a9a9a';
  ctx.beginPath(); ctx.roundRect(46, 50, 164, 412, 60); ctx.fill();
  ctx.filter = 'blur(8px)';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(70, 92, 116, 328, 40); ctx.fill();
  ctx.filter = 'none';
  return tex(c, { srgb: false });
}

/** Aylanma platforma usti: konsentrik ingichka chiziqlar */
export function makeTurntableTexture() {
  const [c, ctx] = canvas(1024, 1024);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.strokeStyle = 'rgba(150,160,175,0.16)';
  for (let r = 40; r < 512; r += 18) {
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(512, 512, r, 0, Math.PI * 2); ctx.stroke();
  }
  return tex(c);
}

/** Konteyner yon tomonidagi brend yozuvlar */
export function makeContainerDecal() {
  // yon panel nisbati ~2.48:1
  const [c, ctx] = canvas(2480, 1000);
  ctx.clearRect(0, 0, 2480, 1000);
  ctx.fillStyle = '#ffffff';
  // logo: HM belgisi + GROUP
  drawHM(ctx, 980, 430, 1060, '#ffffff');
  drawGroupWord(ctx, 980, 790, 1060, 118, '#ffffff');
  ctx.textBaseline = 'middle';
  // kichik texnik yozuvlar
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  ctx.font = `500 52px ${FONT}`;
  ctx.fillText('HMGU 250 815 6', 1820, 110);
  ctx.font = `400 34px ${FONT}`;
  ctx.fillText('22G1   KOREA → WORLD', 1820, 178);
  wearPaint(ctx, 2480, 1000, 71);
  return tex(c);
}

/** Bo'yalgan yozuvni eskirtiradi: mayda ko'chgan joylar va tirnalishlar (shaffof qilib "yeyadi") */
function wearPaint(ctx, w, h, seed) {
  const r = rand(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < (w * h) / 900; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.5})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
  }
  for (let i = 0; i < 40; i++) {
    const x = r() * w, y = r() * h, len = 20 + r() * 120;
    ctx.strokeStyle = `rgba(0,0,0,${0.3 + r() * 0.5})`;
    ctx.lineWidth = 1 + r() * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y + (r() - 0.5) * 20); ctx.stroke();
  }
  // pastki qismda bo'yoq ko'proq yeyilgan
  const g = ctx.createLinearGradient(0, h * 0.7, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, h * 0.7, w, h * 0.3);
  ctx.restore();
}

/** CSC xavfsizlik plastinkasi (eshikdagi kichik metall taxtacha) */
export function makeCscPlateTexture() {
  const [c, ctx] = canvas(512, 320);
  ctx.fillStyle = '#c9cdd2'; ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = '#3b4148'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, 496, 304);
  ctx.fillStyle = '#2b3036';
  ctx.font = `600 34px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.fillText('CSC SAFETY APPROVAL', 30, 26);
  ctx.font = `400 22px ${FONT}`;
  ['KR-HMG 2501 / 25', 'DATE MANUFACTURED  01 / 2025', 'IDENTIFICATION No.  HMGU 250815 6', 'MAX GROSS  30 480 KG', 'ALLOWABLE STACKING  192 000 KG', 'RACKING TEST LOAD  15 240 KG']
    .forEach((l, i) => ctx.fillText(l, 30, 80 + i * 36));
  for (const [x, y] of [[24, 24], [488, 24], [24, 296], [488, 296]]) { ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); }
  return tex(c);
}

export function makeContainerDoorDecal() {
  const [c, ctx] = canvas(1024, 1024);
  ctx.clearRect(0, 0, 1024, 1024);
  ctx.fillStyle = '#ffffff';
  ctx.font = `500 64px ${FONT}`;
  ctx.textBaseline = 'top';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  ctx.fillText('HMGU 250815 6', 90, 90);
  ctx.font = `400 34px ${FONT}`;
  const lines = ['MAX.GROSS  30,480 KG', 'TARE        2,230 KG', 'NET        28,250 KG', 'CU.CAP.     33.2 CU.M'];
  lines.forEach((l, i) => ctx.fillText(l, 90, 200 + i * 52));
  drawHM(ctx, 790, 840, 300, '#fff');
  wearPaint(ctx, 1024, 1024, 72);
  return tex(c);
}

// =====================================================================================
// Protsedural (real ko'rinishli) teksturalar: bo'yoq, zang, iflos, beton, panellar.
// Hammasi kodda chiziladi — qo'shimcha fayl yuklanmaydi. Tasodifiylik urug'li (seed),
// shuning uchun har safar bir xil natija chiqadi.
// =====================================================================================

/** Urug'li tasodifiy son generatori (mulberry32) */
export function rand(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Takrorlanuvchi (tileable) value-noise fbm maydoni, 0..1 */
export function noiseField(w, h, { cells = 6, octaves = 4, seed = 1, gain = 0.5 } = {}) {
  const out = new Float32Array(w * h);
  const r = rand(seed);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cx = cells << o, cy = Math.max(1, Math.round((cells * h) / w)) << o;
    const grid = new Float32Array(cx * cy);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * cy, y0 = Math.floor(fy), y1 = (y0 + 1) % cy;
      let ty = fy - y0; ty = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * cx, x0 = Math.floor(fx), x1 = (x0 + 1) % cx;
        let tx = fx - x0; tx = tx * tx * (3 - 2 * tx);
        const a = grid[y0 * cx + x0], b = grid[y0 * cx + x1], c = grid[y1 * cx + x0], d = grid[y1 * cx + x1];
        const top = a + (b - a) * tx;
        out[y * w + x] += amp * (top + (c + (d - c) * tx - top) * ty);
      }
    }
    total += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Maydonni rangli canvasga: fn(qiymat, u, v) → [r, g, b, a] (0..255) */
function fieldCanvas(field, w, h, fn) {
  const [c, ctx] = canvas(w, h);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = fn(field[i], x / w, y / h);
      img.data[i * 4] = p[0]; img.data[i * 4 + 1] = p[1]; img.data[i * 4 + 2] = p[2]; img.data[i * 4 + 3] = p[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Balandlik canvasidan (oq — baland) normal xarita yasaydi */
export function heightToNormal(src, strength = 2, { wrap = true } = {}) {
  const w = src.width, h = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H[i] = sd[i * 4] / 255;
  const [c, ctx] = canvas(w, h);
  const img = ctx.createImageData(w, h);
  const at = (x, y) => {
    if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = Math.min(w - 1, Math.max(0, x)); y = Math.min(h - 1, Math.max(0, y)); }
    return H[y * w + x];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      // canvas'da y pastga, UV'da v yuqoriga (flipY) — yashil kanal shunga mos
      img.data[i] = (-dx / l * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Yumshoq blur: kichraytirib-kattalashtirish (ctx.filter'siz ham ishlaydi) */
function softBlur(src, k = 4) {
  const w = src.width, h = src.height;
  const [s, sctx] = canvas(Math.max(1, Math.round(w / k)), Math.max(1, Math.round(h / k)));
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(src, 0, 0, s.width, s.height);
  const [c, ctx] = canvas(w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s, 0, 0, w, h);
  return c;
}

/**
 * Eskirgan bo'yoq: dog'lar, yomg'ir izlari, pastda iflos, zang nuqtalari, tirnalishlar.
 * ridges — gofra qirralari (u, 0..1): bo'yoq qirralarda biroz yeyilgan.
 * Qaytaradi: { map, roughnessMap }
 */
export function makeWeatheredPaint({ base = '#1D3E69', w = 1024, h = 512, seed = 3, ridges = [], streaks = 1, rust = 1, grime = 1 } = {}) {
  const r = rand(seed);
  const [c, ctx] = canvas(w, h);
  const [rc, rctx] = canvas(w, h);
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  rctx.fillStyle = 'rgb(112,112,112)'; rctx.fillRect(0, 0, w, h);

  // 1) katta dog'lar (rang notekisligi, quyoshda o'chgan joylar)
  const n1 = noiseField(128, 64, { cells: 5, octaves: 5, seed: seed + 1 });
  ctx.drawImage(fieldCanvas(n1, 128, 64, (v) => (v > 0.5 ? [255, 255, 255, (v - 0.5) * 70] : [0, 0, 0, (0.5 - v) * 90])), 0, 0, w, h);
  rctx.drawImage(fieldCanvas(n1, 128, 64, (v) => [255, 255, 255, Math.max(0, v - 0.45) * 90]), 0, 0, w, h);

  // 2) qirralarda yeyilgan bo'yoq
  for (const u of ridges) {
    const x = u * w;
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x - 1, 0, 2, h);
    rctx.fillStyle = 'rgba(255,255,255,0.08)'; rctx.fillRect(x - 1, 0, 2, h);
  }

  // 3) yomg'ir izlari — tepadan pastga oqqan iflos
  const nS = Math.round(260 * streaks * (w / 1024));
  for (let i = 0; i < nS; i++) {
    const x = r() * w, y0 = r() < 0.7 ? r() * h * 0.08 : r() * h * 0.6;
    const len = h * (0.15 + r() * 0.75), sw = 1 + r() * r() * 7;
    const dark = r() < 0.8;
    const a = dark ? 0.05 + r() * 0.12 : 0.03 + r() * 0.05;
    const col = dark ? '38,30,24' : '200,206,214';
    const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(x, y0, sw, len);
    const rg = rctx.createLinearGradient(0, y0, 0, y0 + len);
    rg.addColorStop(0, `rgba(255,255,255,${a * 1.4})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
    rctx.fillStyle = rg; rctx.fillRect(x, y0, sw, len);
  }

  // 4) pastki qismda iflos (yer changi), shovqin bilan
  if (grime > 0) {
    const n2 = noiseField(128, 64, { cells: 8, octaves: 4, seed: seed + 2 });
    ctx.drawImage(fieldCanvas(n2, 128, 64, (v, u, t) => {
      const k = Math.max(0, (t - 0.62) / 0.38);
      return [52, 42, 32, Math.min(255, k * k * (0.4 + v) * 190 * grime)];
    }), 0, 0, w, h);
    rctx.drawImage(fieldCanvas(n2, 128, 64, (v, u, t) => [255, 255, 255, Math.max(0, (t - 0.62) / 0.38) * 120 * grime]), 0, 0, w, h);
  }

  // 5) zang: pastki/ustki chetlarda va tasodifiy joylarda, ostidan zang izi oqadi
  const nR = Math.round(70 * rust * (w / 1024));
  for (let i = 0; i < nR; i++) {
    const edge = r();
    const y = edge < 0.45 ? h * (0.9 + r() * 0.1) : edge < 0.7 ? h * r() * 0.06 : r() * h;
    const x = r() * w, rad = 1.5 + r() * r() * 10;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(70,32,14,0.85)'); g.addColorStop(0.5, 'rgba(122,58,24,0.5)'); g.addColorStop(1, 'rgba(122,58,24,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    rctx.fillStyle = 'rgba(255,255,255,0.55)'; rctx.beginPath(); rctx.arc(x, y, rad * 0.8, 0, Math.PI * 2); rctx.fill();
    if (y < h * 0.85 && r() < 0.6) {
      const len = 10 + r() * 60;
      const sg = ctx.createLinearGradient(0, y, 0, y + len);
      sg.addColorStop(0, 'rgba(120,58,26,0.35)'); sg.addColorStop(1, 'rgba(120,58,26,0)');
      ctx.fillStyle = sg; ctx.fillRect(x - rad * 0.3, y, Math.max(1, rad * 0.6), len);
    }
  }

  // 6) tirnalishlar (bo'yoq ostidan metall ko'rinadi)
  const nT = Math.round(40 * rust * (w / 1024));
  for (let i = 0; i < nT; i++) {
    const x = r() * w, y = h * (0.55 + r() * 0.45), len = 6 + r() * 50, ang = (r() - 0.5) * 0.6;
    ctx.strokeStyle = `rgba(190,196,204,${0.12 + r() * 0.2})`; ctx.lineWidth = 0.6 + r();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke();
  }

  return { map: tex(c), roughnessMap: tex(rc, { srgb: false }) };
}

/** Umumiy "ishlatilgan metall" iflos teksturasi (takrorlanuvchi, oq asosda — rang materialdan) */
export function makeGrimeTexture(seed = 11) {
  const w = 512, h = 512;
  const n = noiseField(w / 2, h / 2, { cells: 4, octaves: 5, seed });
  const [c, ctx] = canvas(w, h);
  ctx.drawImage(fieldCanvas(n, w / 2, h / 2, (v) => { const k = 205 + v * 50; return [k, k, k + 2, 255]; }), 0, 0, w, h);
  const r = rand(seed + 1);
  for (let i = 0; i < 120; i++) {
    const x = r() * w, y = r() * h, len = 20 + r() * 160, sw = 1 + r() * 4;
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, `rgba(60,52,44,${0.05 + r() * 0.1})`); g.addColorStop(1, 'rgba(60,52,44,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, sw, len);
  }
  return tex(c, { repeat: true });
}

/** Konteyner ichidagi yog'och (fanera) pol: taxtalar, qora boltlar, eskirgan dog'lar */
export function makePlywoodTexture() {
  const w = 512, h = 1024;
  const [c, ctx] = canvas(w, h);
  const r = rand(21);
  const planks = 8;
  for (let p = 0; p < planks; p++) {
    const x = (p / planks) * w, pw = w / planks;
    const tone = 0.85 + r() * 0.3;
    ctx.fillStyle = `rgb(${Math.round(128 * tone)},${Math.round(88 * tone)},${Math.round(58 * tone)})`;
    ctx.fillRect(x, 0, pw, h);
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = `rgba(${r() < 0.5 ? '70,44,26' : '170,124,84'},${0.08 + r() * 0.14})`;
      ctx.lineWidth = 0.5 + r() * 1.5;
      const gx = x + r() * pw;
      ctx.beginPath(); ctx.moveTo(gx, 0);
      for (let y = 0; y <= h; y += 64) ctx.lineTo(gx + Math.sin(y * 0.01 + i) * 2.5, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(20,12,6,0.85)'; ctx.fillRect(x, 0, 1.5, h);
    for (let y = 40; y < h; y += 128) { ctx.fillStyle = 'rgba(25,25,25,0.9)'; ctx.beginPath(); ctx.arc(x + pw / 2, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
  }
  const n = noiseField(64, 128, { cells: 3, octaves: 4, seed: 22 });
  ctx.drawImage(fieldCanvas(n, 64, 128, (v) => [30, 20, 10, Math.max(0, v - 0.45) * 220]), 0, 0, w, h);
  return tex(c, { repeat: true });
}

/**
 * Beton plitalar (hovli / port): chok chiziqlari, yoriqlar, moy dog'lari, mayda toshlar.
 * Bitta tekstura bitta plitani bildiradi (takrorlanadi). Qaytaradi: { map, roughnessMap, normalMap }
 */
export function makeConcreteTextures({ seed = 31, tone = 150 } = {}) {
  const S = 1024;
  const r = rand(seed);
  const [c, ctx] = canvas(S, S);
  const [hc, hctx] = canvas(S, S);  // balandlik
  const [rc, rctx] = canvas(S, S);  // g'adir-budirlik
  const n = noiseField(256, 256, { cells: 4, octaves: 6, seed });
  ctx.drawImage(fieldCanvas(n, 256, 256, (v) => { const k = tone - 28 + v * 56; return [k, k, k + 3, 255]; }), 0, 0, S, S);
  hctx.drawImage(fieldCanvas(n, 256, 256, (v) => { const k = 110 + v * 40; return [k, k, k, 255]; }), 0, 0, S, S);
  rctx.fillStyle = 'rgb(225,225,225)'; rctx.fillRect(0, 0, S, S);

  // mayda toshlar / g'ovaklar
  const img = ctx.getImageData(0, 0, S, S), himg = hctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (r() - 0.5) * 26;
    img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v;
    himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = himg.data[i] + v * 0.9;
  }
  ctx.putImageData(img, 0, 0); hctx.putImageData(himg, 0, 0);

  // moy / suv dog'lari
  for (let i = 0; i < 14; i++) {
    const x = r() * S, y = r() * S, rad = 20 + r() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(30,28,26,${0.12 + r() * 0.2})`); g.addColorStop(1, 'rgba(30,28,26,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    const rg = rctx.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, 'rgba(0,0,0,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    rctx.fillStyle = rg; rctx.beginPath(); rctx.arc(x, y, rad, 0, Math.PI * 2); rctx.fill();
  }
  // shina izlari
  for (let i = 0; i < 6; i++) {
    const y = r() * S, w2 = 26 + r() * 20;
    const g = ctx.createLinearGradient(0, y - w2, 0, y + w2);
    g.addColorStop(0, 'rgba(25,25,25,0)'); g.addColorStop(0.5, `rgba(25,25,25,${0.05 + r() * 0.07})`); g.addColorStop(1, 'rgba(25,25,25,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y - w2, S, w2 * 2);
  }
  // yoriqlar — tasodifiy yurish
  ctx.lineCap = hctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    let x = r() * S, y = r() * S, a = r() * Math.PI * 2;
    const steps = 30 + Math.floor(r() * 60);
    ctx.beginPath(); hctx.beginPath(); ctx.moveTo(x, y); hctx.moveTo(x, y);
    for (let s = 0; s < steps; s++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 6; y += Math.sin(a) * 6; ctx.lineTo(x, y); hctx.lineTo(x, y); }
    ctx.strokeStyle = 'rgba(40,40,42,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    hctx.strokeStyle = 'rgba(30,30,30,0.9)'; hctx.lineWidth = 2; hctx.stroke();
  }
  // plitalar orasidagi kengayish choki (chetlarda — takrorlanganda to'r hosil bo'ladi)
  ctx.fillStyle = 'rgba(52,52,54,0.95)'; ctx.fillRect(0, 0, S, 5); ctx.fillRect(0, 0, 5, S);
  hctx.fillStyle = '#000'; hctx.fillRect(0, 0, S, 5); hctx.fillRect(0, 0, 5, S);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(0, 5, S, 2); ctx.fillRect(5, 0, 2, S);

  return {
    map: tex(c, { repeat: true, aniso: 16 }),
    roughnessMap: tex(rc, { srgb: false, repeat: true }),
    normalMap: tex(heightToNormal(softBlur(hc, 1.5), 3), { srgb: false, repeat: true, aniso: 16 }),
  };
}

/**
 * Port steklaridagi 40 futlik konteyner yon tomoni: oq asos (rang instansiyadan), qovurg'alar
 * normal xaritada, iflos va zang rangli xaritada.
 */
export const makeStackTextures = once(() => {
  const w = 1024, h = 256;
  const ribs = 44;
  const ridges = [];
  for (let i = 0; i < ribs; i++) ridges.push((i + 0.27) / ribs, (i + 0.73) / ribs);
  const { map, roughnessMap } = makeWeatheredPaint({ base: '#e6e8eb', w, h, seed: 41, ridges, streaks: 1.4, rust: 1.2 });
  // qovurg'alar balandligi: trapetsiya profili
  const [hc, hctx] = canvas(w, h);
  for (let x = 0; x < w; x++) {
    const t = ((x / w) * ribs) % 1;
    const k = t < 0.2 ? 0 : t < 0.35 ? (t - 0.2) / 0.15 : t < 0.65 ? 1 : t < 0.8 ? 1 - (t - 0.65) / 0.15 : 0;
    const v = Math.round(60 + k * 150);
    hctx.fillStyle = `rgb(${v},${v},${v})`; hctx.fillRect(x, 0, 1, h);
  }
  // ustki va pastki relslar
  hctx.fillStyle = '#fff'; hctx.fillRect(0, 0, w, 10); hctx.fillRect(0, h - 14, w, 14);
  return { map, roughnessMap, normalMap: tex(heightToNormal(hc, 4, { wrap: false }), { srgb: false }) };
});

/**
 * Sayqallangan beton pol (showroom): choksiz, bulutsimon nozik dog'lar, mayda toshchalar,
 * yaltiroqlik notekis (akslar joy-joyida xiraroq). Bitta tekstura ~8 m (takrorlanadi).
 */
export function makePolishedFloorTextures() {
  const S = 1024;
  const r = rand(81);
  const big = noiseField(256, 256, { cells: 3, octaves: 5, seed: 82 });
  const mid = noiseField(256, 256, { cells: 14, octaves: 3, seed: 83 });
  const [c, ctx] = canvas(S, S);
  ctx.drawImage(fieldCanvas(big, 256, 256, (v, u, t) => {
    const m = mid[Math.floor(t * 256) * 256 + Math.floor(u * 256)];
    const k = 208 + (v - 0.5) * 22 + (m - 0.5) * 7;
    return [k, k + 3, k + 7, 255];
  }), 0, 0, S, S);
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (r() - 0.5) * 7 + (r() < 0.004 ? -22 : 0);
    img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v;
  }
  ctx.putImageData(img, 0, 0);
  const rough = fieldCanvas(mid, 256, 256, (v, u, t) => {
    const b = big[Math.floor(t * 256) * 256 + Math.floor(u * 256)];
    const k = 40 + v * 34 + b * 26;
    return [k, k, k, 255];
  });
  const [rc, rctx] = canvas(S, S);
  rctx.drawImage(rough, 0, 0, S, S);
  return { map: tex(c, { repeat: true, aniso: 16 }), roughnessMap: tex(rc, { srgb: false, repeat: true }) };
}

/**
 * Silliq gips devor: nozik dog'lar, shift ostida yengil soya, pastga qarab biroz to'q-ko'kish tus
 * va pol bilan tutashgan joyda soya (AO). Tekstura gorizontal takrorlanadi, vertikal — butun devor.
 */
export function makePlasterWallTexture() {
  const W = 512, H = 1024;
  const n = noiseField(128, 256, { cells: 4, octaves: 5, seed: 91 });
  const c = fieldCanvas(n, 128, 256, (v, u, t) => {
    let k = 229 + (v - 0.5) * 8;
    k -= 16 * Math.max(0, 1 - t / 0.05);                 // shift ostidagi soya
    const low = Math.max(0, (t - 0.35) / 0.65);
    k -= 26 * low * low;                                    // pastga qarab to'qroq
    k -= 18 * Math.max(0, (t - 0.965) / 0.035);             // pol bilan tutashuv
    return [k - 3 * low, k, k + 4 + 4 * low, 255];
  });
  const [o, octx] = canvas(W, H);
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(c, 0, 0, W, H);
  return tex(o, { repeat: true });
}

/**
 * Downlight devorni yoritganda hosil bo'ladigan "nur yelpig'ichi" (wall-wash scallop):
 * tepasi yoysimon chegarali yorqin dog', pastga kengayib so'nadi. Qora fon — additive aralashtiriladi.
 */
export function makeScallopTexture() {
  const W = 256, H = 512;
  const [c, ctx] = canvas(W, H);
  const img = ctx.createImageData(W, H);
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < H; y++) {
    const t = y / H;
    for (let x = 0; x < W; x++) {
      const u = (x / W) * 2 - 1;
      const top = 0.07 + 0.42 * u * u;                       // yuqori yoy chegarasi
      const half = 0.2 + 0.75 * t;                           // pastga kengayadi
      let k = sm(top - 0.015, top + 0.05, t) * (1 - sm(half * 0.55, half, Math.abs(u)));
      k *= Math.exp(-Math.max(0, t - top) * 2.6);            // pastga so'nadi
      k += 0.35 * Math.exp(-Math.pow((t - top - 0.03) / 0.03, 2)) * (1 - sm(0.2, 0.5, Math.abs(u))) * (t > top ? 1 : 0); // yorqin "qalpoq"
      const v = Math.min(255, k * 255);
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(softBlur(c, 2.5), { repeat: true });
}

/**
 * Alyumin roll-darvoza (rolstavni) plastinkalari: har biri ~7.7 sm, qavariq profil, orasida
 * qorong'i tirqish, gorizontal cho'tkalangan metall. Tekstura 1 m balandlikni bildiradi.
 * Qaytaradi: { map, normalMap, roughnessMap }
 */
export function makeShutterTextures() {
  const W = 256, H = 512, slats = 13;
  const r = rand(97);
  const [c, ctx] = canvas(W, H);
  const [hc, hctx] = canvas(W, H);
  const [rc, rctx] = canvas(W, H);
  for (let y = 0; y < H; y++) {
    const t = ((y / H) * slats) % 1;                         // plastinka ichida (tepadan)
    let k, h, ro;
    if (t < 0.07) { k = 70; h = 0; ro = 150; }                // tirqish
    else {
      const s = (t - 0.07) / 0.93;
      h = Math.sin(s * Math.PI);
      // tepaga qaragan qismi yorug'roq (shiftdagi yorug'lik), pastki qismi soyada
      k = 176 + 34 * Math.cos(s * Math.PI * 0.9) * 0.6 + 18 * h;
      if (Math.abs(s - 0.52) < 0.03) k -= 18;                 // o'rtadagi qovurg'a
      ro = 92;
    }
    ctx.fillStyle = `rgb(${Math.round(k - 3)},${Math.round(k)},${Math.round(k + 5)})`; ctx.fillRect(0, y, W, 1);
    const hv = Math.round(40 + h * 200);
    hctx.fillStyle = `rgb(${hv},${hv},${hv})`; hctx.fillRect(0, y, W, 1);
    rctx.fillStyle = `rgb(${ro},${ro},${ro})`; rctx.fillRect(0, y, W, 1);
  }
  // cho'tkalangan metall chiziqlari
  for (let i = 0; i < 900; i++) {
    const y = r() * H, x = r() * W, len = 30 + r() * 180;
    ctx.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.03 + r() * 0.05})` : `rgba(0,0,0,${0.03 + r() * 0.05})`;
    ctx.fillRect(x, y, len, 1);
  }
  return {
    map: tex(c, { repeat: true, aniso: 16 }),
    normalMap: tex(heightToNormal(hc, 3), { srgb: false, repeat: true, aniso: 16 }),
    roughnessMap: tex(rc, { srgb: false, repeat: true }),
  };
}

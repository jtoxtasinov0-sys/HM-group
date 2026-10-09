import * as THREE from 'three';

export const BRAND = {
  navy: '#1D3E69',
  deep: '#16335D',
  light: '#EEF2F8',
  white: '#FFFFFF',
};

const FONT = 'Montserrat, "Segoe UI", Arial, sans-serif';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

/** "HM" belgisi — ingichka geometrik chiziqlar (logo bilan bir xil) */
export function drawHM(ctx, cx, cy, size, color, lineWidth) {
  const s = size / 46; // logo 46 birlik kenglikda
  ctx.save();
  ctx.translate(cx - 23 * s, cy - 14 * s);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  // H
  ctx.moveTo(0, 0); ctx.lineTo(0, 28 * s);
  ctx.moveTo(0, 14 * s); ctx.lineTo(16 * s, 14 * s);
  ctx.moveTo(16 * s, 0); ctx.lineTo(16 * s, 28 * s);
  // M
  ctx.moveTo(26 * s, 28 * s); ctx.lineTo(26 * s, 0); ctx.lineTo(36 * s, 18 * s); ctx.lineTo(46 * s, 0); ctx.lineTo(46 * s, 28 * s);
  ctx.stroke();
  ctx.restore();
}

/** Devordagi yorug' logo: doira + HM + GROUP yozuvi */
export function makeWallLogoTexture() {
  const [c, ctx] = canvas(2048, 1024);
  ctx.clearRect(0, 0, 2048, 1024);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(1024, 400, 300, 0, Math.PI * 2); ctx.stroke();
  drawHM(ctx, 1024, 400, 330, '#fff', 16);
  ctx.fillStyle = '#fff';
  ctx.font = `300 112px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '42px';
  ctx.fillText('HM GROUP', 1024 + 21, 860);
  return tex(c);
}

/** Mashina orqasidagi katta konturli nom (Taycan uslubida) */
export function makeOutlineTextTexture(text) {
  const [c, ctx] = canvas(2048, 512);
  ctx.clearRect(0, 0, 2048, 512);
  let size = 380;
  ctx.font = `200 ${size}px ${FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '18px';
  while (ctx.measureText(text).width > 1920 && size > 120) {
    size -= 10;
    ctx.font = `200 ${size}px ${FONT}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeText(text, 1024, 270);
  return tex(c);
}

/** Pol plitkasi: katta plitalar orasida ingichka choklar */
export function makeFloorTexture() {
  const [c, ctx] = canvas(1024, 1024);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1024, 1024);
  // plitalarning nozik farqi
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const v = 244 + Math.round(Math.random() * 9);
    ctx.fillStyle = `rgb(${v},${v},${v + 1})`;
    ctx.fillRect(x * 512 + 2, y * 512 + 2, 508, 508);
  }
  ctx.fillStyle = '#c6ccd4';
  ctx.fillRect(0, 0, 1024, 2); ctx.fillRect(0, 512, 1024, 2);
  ctx.fillRect(0, 0, 2, 1024); ctx.fillRect(512, 0, 2, 1024);
  return tex(c, { repeat: true });
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
  ctx.strokeStyle = '#ffffff';
  // logo doira
  ctx.lineWidth = 11;
  ctx.beginPath(); ctx.arc(760, 500, 215, 0, Math.PI * 2); ctx.stroke();
  drawHM(ctx, 760, 500, 230, '#ffffff', 15);
  ctx.textBaseline = 'middle';
  ctx.font = `300 250px ${FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  ctx.fillText('HM', 1060, 420);
  ctx.font = `300 112px ${FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '30px';
  ctx.fillText('GROUP', 1068, 640);
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
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#fff';
  ctx.beginPath(); ctx.arc(820, 820, 110, 0, Math.PI * 2); ctx.stroke();
  drawHM(ctx, 820, 820, 120, '#fff', 8);
  wearPaint(ctx, 1024, 1024, 72);
  return tex(c);
}

/** Rolling eshik plastinkalari */
export function makeShutterTexture() {
  const [c, ctx] = canvas(256, 1024);
  for (let y = 0; y < 1024; y += 64) {
    const g = ctx.createLinearGradient(0, y, 0, y + 64);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#e4e8ee');
    g.addColorStop(0.92, '#c8ced8');
    g.addColorStop(1, '#8f99a6');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, 256, 64);
  }
  return tex(c, { repeat: true });
}

/** Asfalt / port maydoni */
export function makeGroundTexture() {
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);
  const img = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 215 + Math.random() * 40;
    img.data[i] = img.data[i + 1] = v; img.data[i + 2] = v + 3;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, { repeat: true });
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
export function makeStackTextures() {
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
}

/** Halo yoritilgan logo uchun yumshoq nur (logoning orqasida devorga tushadi) */
export function makeLogoGlowTexture() {
  const [c, ctx] = canvas(1024, 512);
  ctx.clearRect(0, 0, 1024, 512);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 22;
  ctx.beginPath(); ctx.arc(512, 200, 150, 0, Math.PI * 2); ctx.stroke();
  drawHM(ctx, 512, 200, 165, '#fff', 30);
  ctx.fillStyle = '#fff';
  ctx.font = `400 58px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '21px';
  ctx.fillText('HM GROUP', 512 + 10, 430);
  const b = softBlur(softBlur(c, 10), 6);
  // keng, yumshoq "halo" + yaqinroq porlash
  const [o, octx] = canvas(1024, 512);
  octx.drawImage(softBlur(b, 18), 0, 0);
  octx.globalAlpha = 0.9;
  octx.drawImage(b, 0, 0);
  return tex(o);
}

/**
 * Zamonaviy seksiyali garaj darvozasi: antratsit metall panellar, gorizontal qovurg'alar,
 * bitta qatorda xira oynali derazalar (tashqaridan kunduzgi yorug'lik tushadi).
 * Qaytaradi: { map, normalMap, roughnessMap, emissiveMap }
 */
export function makeSectionalDoorTextures({ panels = 8, windowsRow = 1, windows = 6 } = {}) {
  const W = 1024, H = 834;
  const ph = H / panels;
  const r = rand(51);
  const [c, ctx] = canvas(W, H);
  const [hc, hctx] = canvas(W, H);
  const [rc, rctx] = canvas(W, H);
  const [ec, ectx] = canvas(W, H);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, W, H);

  // asos: antratsit, gorizontal "cho'tkalangan" chiziqlar
  ctx.fillStyle = '#3b4148'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) {
    const y = r() * H, x = r() * W, len = 40 + r() * 260;
    ctx.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.012 + r() * 0.02})` : `rgba(0,0,0,${0.02 + r() * 0.03})`;
    ctx.fillRect(x, y, len, 1);
  }
  hctx.fillStyle = 'rgb(128,128,128)'; hctx.fillRect(0, 0, W, H);
  rctx.fillStyle = 'rgb(100,100,100)'; rctx.fillRect(0, 0, W, H);

  for (let p = 0; p < panels; p++) {
    const y0 = p * ph;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + ph);
    g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.06)');
    ctx.fillStyle = g; ctx.fillRect(0, y0, W, ph);
    // panel choki: chuqur ariq (soyasi tepada, yorug' qirrasi pastda)
    ctx.fillStyle = 'rgba(8,10,12,0.9)'; ctx.fillRect(0, y0, W, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(0, y0 + 3, W, 1.5);
    hctx.fillStyle = '#000'; hctx.fillRect(0, y0, W, 4);
    // ikkita sayoz qovurg'a
    for (const k of [1 / 3, 2 / 3]) {
      const y = y0 + ph * k;
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, y - 1, W, 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(0, y + 0.5, W, 1);
      hctx.fillStyle = 'rgb(96,96,96)'; hctx.fillRect(0, y - 1.5, W, 3);
    }
  }
  // derazalar qatori
  if (windowsRow >= 0) {
    const y0 = windowsRow * ph;
    const margin = W * 0.07, gap = W * 0.03;
    const ww = (W - margin * 2 - gap * (windows - 1)) / windows, wh = ph * 0.46;
    const wy = y0 + (ph - wh) / 2;
    for (let i = 0; i < windows; i++) {
      const wx = margin + i * (ww + gap);
      ctx.fillStyle = '#121518'; ctx.beginPath(); ctx.roundRect(wx - 5, wy - 5, ww + 10, wh + 10, 6); ctx.fill();
      const gg = ctx.createLinearGradient(0, wy, 0, wy + wh);
      gg.addColorStop(0, '#eef3f8'); gg.addColorStop(1, '#c9d3dd');
      ctx.fillStyle = gg; ctx.fillRect(wx, wy, ww, wh);
      const eg = ectx.createLinearGradient(0, wy, 0, wy + wh);
      eg.addColorStop(0, '#ffffff'); eg.addColorStop(1, '#b8c4d0');
      ectx.fillStyle = eg; ectx.fillRect(wx, wy, ww, wh);
      hctx.fillStyle = 'rgb(200,200,200)'; hctx.fillRect(wx - 5, wy - 5, ww + 10, wh + 10);
      hctx.fillStyle = 'rgb(150,150,150)'; hctx.fillRect(wx, wy, ww, wh);
      rctx.fillStyle = 'rgb(30,30,30)'; rctx.fillRect(wx, wy, ww, wh);
    }
  }
  // pastki rezina zichlagich va chetdagi profillar
  ctx.fillStyle = '#0d0f11'; ctx.fillRect(0, H - 8, W, 8);
  hctx.fillStyle = 'rgb(160,160,160)'; hctx.fillRect(0, H - 8, W, 8);
  for (const x of [0, W - 10]) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, 0, 10, H); }

  return {
    map: tex(c, { aniso: 16 }),
    normalMap: tex(heightToNormal(softBlur(hc, 1.2), 5, { wrap: false }), { srgb: false, aniso: 16 }),
    roughnessMap: tex(rc, { srgb: false }),
    emissiveMap: tex(ec),
  };
}

/**
 * Oq vertikal ariqchali ("fluted") devor paneli — markaziy devor uchun. Tepadagi LED chiziq
 * devorni silab yoritadi (wall-washer). 1 m kenglik (takrorlanadi).
 */
export function makeFlutedWallTextures() {
  const W = 256, H = 1024;
  const flutes = 12; // ~8 sm
  const fw = W / flutes;
  const [c, ctx] = canvas(W, H);
  const [hc, hctx] = canvas(W, H);
  for (let i = 0; i < flutes; i++) {
    const x0 = i * fw;
    for (let x = 0; x < fw; x++) {
      const t = x / fw;
      const sh = Math.sin(t * Math.PI);
      const k = Math.round(236 + sh * 10 - (t > 0.5 ? (t - 0.5) * 18 : 0));
      ctx.fillStyle = `rgb(${k},${k},${k + 2})`; ctx.fillRect(x0 + x, 0, 1, H);
      const hv = Math.round(70 + sh * 160);
      hctx.fillStyle = `rgb(${hv},${hv},${hv})`; hctx.fillRect(x0 + x, 0, 1, H);
    }
    ctx.fillStyle = 'rgba(120,128,140,0.35)'; ctx.fillRect(x0, 0, 1, H);
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.35, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,66,76,0.16)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  return {
    map: tex(c, { repeat: true }),
    normalMap: tex(heightToNormal(hc, 2.5), { srgb: false, repeat: true }),
  };
}

/**
 * Katta formatli devor panellari (oq galereya): ingichka choklar, panellarning nozik tus farqi,
 * devor pastida va tepasida yumshoq soya. Tekstura 6 m × shift balandligini bildiradi.
 */
export function makeWallPanelTexture() {
  const W = 1024, H = 1024;
  const cols = 5, rows = 3;
  const r = rand(61);
  const [c, ctx] = canvas(W, H);
  const pw = W / cols, ph = H / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = 236 + Math.round(r() * 6);
      ctx.fillStyle = `rgb(${k},${k + 1},${k + 3})`; ctx.fillRect(i * pw, j * ph, pw, ph);
    }
  }
  ctx.fillStyle = 'rgba(150,158,170,0.9)';
  for (let i = 0; i < cols; i++) ctx.fillRect(i * pw, 0, 2, H);
  for (let j = 0; j < rows; j++) ctx.fillRect(0, j * ph, W, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < cols; i++) ctx.fillRect(i * pw + 2, 0, 1, H);
  for (let j = 0; j < rows; j++) ctx.fillRect(0, j * ph + 2, W, 1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(70,78,90,0.10)'); g.addColorStop(0.12, 'rgba(70,78,90,0)');
  g.addColorStop(0.8, 'rgba(70,78,90,0)'); g.addColorStop(1, 'rgba(70,78,90,0.16)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  return tex(c, { repeat: true });
}

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

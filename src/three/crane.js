import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeGrimeTexture, drawHM, FONT } from './textures.js';
import { HM_W, HM_H } from '../logo.js';

/**
 * Konteyner krani (STS — "ship-to-shore") — haqiqiy port kranining tuzilishi:
 * 4 ta quti kesimli oyoq, portal to'sinlari, X-bog'lovchilar, ikki parallel strela to'sini
 * (qovurg'alar, yo'lak, sariq panjaralar, relslar bilan), A-rama va tortqilar, mashina xonasi,
 * zinapoya minorasi, g'ildirak aravalari, aravacha (trolley) va operator kabinasi.
 *
 * Bir xil materialli bo'laklar bitta geometriyaga birlashtiriladi — kam draw call.
 */

const TILE = 4; // tekstura necha metrda takrorlanadi

/** Quti geometriyasi, UV'lari metr bo'yicha (tekstura cho'zilmaydi) */
export function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0] / TILE, uv.getY(i) * dims[f][1] / TILE);
    }
  }
  return g;
}

/** Bir materialli bo'laklarni yig'uvchi */
export function bucket() {
  const geos = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
  return {
    geos,
    box(w, h, d, x, y, z, rot) {
      const g = boxGeo(w, h, d);
      if (rot) q.setFromEuler(rot); else q.identity();
      g.applyMatrix4(m.compose(new THREE.Vector3(x, y, z), q, s));
      geos.push(g);
    },
    /** a → b orasida to'rtburchak kesimli tayoq */
    beam(a, b, t, t2 = t) {
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      const g = boxGeo(t, len, t2);
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      g.applyMatrix4(m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, s));
      geos.push(g);
    },
    /** a → b orasida tros / tayoq (silindr) */
    rod(a, b, r, seg = 8) {
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      g.applyMatrix4(m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, s));
      geos.push(g);
    },
    cyl(r, h, x, y, z, rot, seg = 16) {
      const g = new THREE.CylinderGeometry(r, r, h, seg);
      if (rot) q.setFromEuler(rot); else q.identity();
      g.applyMatrix4(m.compose(new THREE.Vector3(x, y, z), q, s));
      geos.push(g);
    },
    mesh(mat, { cast = true, receive = true } = {}) {
      if (!geos.length) return null;
      const mesh = new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), mat);
      geos.forEach((g) => g.dispose());
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      return mesh;
    },
  };
}

/**
 * zc — kran markazi (z), legX — [quruqlik, suv] oyoqlari (x), half — oyoqlar orasidagi yarim masofa (z),
 * boomY — strela to'sinlari markazi (y).
 */
export function createCrane({ zc, legX = [-12, 10], half = 11, boomY = 41 }) {
  const group = new THREE.Group();
  group.name = 'sts-crane';
  const grime = makeGrimeTexture(13);
  const paint = (color, rough = 0.55, metal = 0.25) => new THREE.MeshStandardMaterial({ color, map: grime, roughness: rough, metalness: metal });
  const M = {
    white: paint('#e9edf2', 0.5, 0.2),
    navy: paint('#1D3E69', 0.5, 0.3),
    steel: paint('#3a434e', 0.45, 0.6),
    yellow: paint('#e2b21c', 0.5, 0.2),
    black: new THREE.MeshStandardMaterial({ color: '#16191d', roughness: 0.7, metalness: 0.3 }),
    rope: new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.35, metalness: 0.85 }),
    // kabina oynasi: juda silliq yuzada quyosh bitta pikselda "chaqnab" miltillardi
    glass: new THREE.MeshStandardMaterial({ color: '#0e1a28', roughness: 0.2, metalness: 0.9, envMapIntensity: 1.4 }),
  };
  const B = Object.fromEntries(Object.keys(M).map((k) => [k, bucket()]));
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const [lx, wx] = legX;
  const legTop = 37.2;
  const gH = 2.6, gW = 1.0, gZ = 2.6;         // strela to'sini: balandlik, qalinlik, markazdan masofa
  const gTop = boomY + gH / 2, gBot = boomY - gH / 2;
  const boomFrom = -34, boomTo = 64;

  // ---------- OYOQLAR va g'ildirak aravalari ----------
  for (const x of [lx, wx]) {
    for (const s of [-1, 1]) {
      const z = zc + s * half;
      B.navy.box(1.7, legTop - 1.9, 1.7, x, 1.9 + (legTop - 1.9) / 2, z);
      // oyoq tagidagi "tovon" va muvozanat to'sini
      B.navy.box(2.4, 0.9, 2.4, x, 1.6, z);
      B.steel.box(1.3, 0.8, 6.4, x, 0.95, z);
      for (let k = -3; k <= 3; k++) {
        if (!k) continue;
        B.black.cyl(0.42, 0.34, x, 0.42, z + k * 0.88, new THREE.Euler(0, 0, Math.PI / 2), 18);
        B.steel.box(0.5, 0.5, 0.7, x, 0.62, z + k * 0.88);
      }
      // oyoqdagi qovurg'alar (payvand choklari kabi)
      for (let y = 6; y < legTop - 2; y += 5.5) B.navy.box(1.84, 0.14, 1.84, x, y, z);
    }
    // gantry yo'nalishidagi pastki to'sin (sill) va ustki ko'ndalang to'sin
    B.navy.box(1.3, 1.5, half * 2, x, 12.4, zc);
    B.navy.box(1.9, 2.2, half * 2 + 1.7, x, legTop + 0.2, zc);
  }
  // yon portal ramkalari: tepada to'sin + X-bog'lovchilar
  for (const s of [-1, 1]) {
    const z = zc + s * half;
    B.navy.box(wx - lx + 1.7, 1.8, 1.5, (lx + wx) / 2, legTop - 0.4, z);
    B.navy.beam(V(lx, 13.2, z), V(wx, legTop - 1.6, z), 0.8, 0.9);
    B.navy.beam(V(wx, 13.2, z), V(lx, legTop - 1.6, z), 0.8, 0.9);
    B.navy.box(wx - lx, 0.9, 0.9, (lx + wx) / 2, 13.0, z);
  }

  // ---------- STRELA TO'SINLARI ----------
  for (const s of [-1, 1]) {
    const z = zc + s * gZ;
    B.white.box(boomTo - boomFrom, gH, gW, (boomFrom + boomTo) / 2, boomY, z);
    // tashqi tomondagi vertikal qovurg'alar
    for (let x = boomFrom + 1; x < boomTo; x += 2.4) B.white.box(0.08, gH - 0.1, 0.12, x, boomY, z + s * (gW / 2 + 0.05));
    // pastki va ustki tokchalar (flanets)
    B.white.box(boomTo - boomFrom, 0.12, gW + 0.3, (boomFrom + boomTo) / 2, gBot + 0.06, z);
    B.white.box(boomTo - boomFrom, 0.12, gW + 0.3, (boomFrom + boomTo) / 2, gTop - 0.06, z);
    // trolley relsi
    B.steel.box(boomTo - boomFrom - 2, 0.16, 0.18, (boomFrom + boomTo) / 2, gTop + 0.08, z);
    // tashqi yo'lak (panjara) va sariq to'siq
    const wz = z + s * (gW / 2 + 0.55);
    B.steel.box(boomTo - boomFrom - 2, 0.06, 0.95, (boomFrom + boomTo) / 2, gBot + 0.4, wz);
    for (let x = boomFrom + 1; x < boomTo - 1; x += 2) B.yellow.box(0.05, 1.1, 0.05, x, gBot + 0.95, wz + s * 0.45);
    B.yellow.box(boomTo - boomFrom - 2, 0.05, 0.05, (boomFrom + boomTo) / 2, gBot + 1.5, wz + s * 0.45);
    B.yellow.box(boomTo - boomFrom - 2, 0.04, 0.04, (boomFrom + boomTo) / 2, gBot + 1.0, wz + s * 0.45);
  }
  // to'sinlarni bog'lovchi ko'ndalang ramkalar (trolley o'tadigan joydan pastda)
  for (let x = boomFrom + 2; x < boomTo; x += 8) {
    B.white.box(0.5, 0.5, gZ * 2, x, gBot - 0.1, zc);
    B.white.beam(V(x, gBot - 0.1, zc - gZ), V(x + 4, gBot - 0.1, zc + gZ), 0.3);
  }
  // strela sharniri (suv tomondagi oyoq ustida)
  for (const s of [-1, 1]) B.steel.cyl(0.7, 1.3, wx + 0.8, boomY, zc + s * gZ, new THREE.Euler(Math.PI / 2, 0, 0), 20);

  // ---------- A-RAMA va TORTQILAR ----------
  const apex = V((lx + wx) / 2 + 1, boomY + 24, zc);
  for (const s of [-1, 1]) {
    const z = zc + s * gZ;
    const top = V(apex.x, apex.y, z);
    B.white.beam(V(lx + 1.2, gTop, z), top, 1.1, 1.0);
    B.white.beam(V(wx - 1.2, gTop, z), top, 1.1, 1.0);
    B.white.beam(V(lx + 4.6, gTop + 9, z), V(wx - 4.6, gTop + 9, z), 0.6);
    // oldingi (dengiz tomon) va orqa tortqilar — juft
    for (const dz of [-0.25, 0.25]) {
      B.rope.rod(V(apex.x, apex.y - 0.3, z + dz), V(boomTo - 1.5, gTop, z + dz), 0.11);
      B.rope.rod(V(apex.x, apex.y - 0.3, z + dz), V(wx + 26, gTop, z + dz), 0.11);
      B.rope.rod(V(apex.x, apex.y - 0.3, z + dz), V(boomFrom + 2, gTop, z + dz), 0.11);
    }
  }
  B.white.box(2.2, 1.4, gZ * 2 + 1.4, apex.x, apex.y + 0.3, zc);
  B.white.box(0.8, 0.8, gZ * 2, apex.x, apex.y - 9, zc);

  // ---------- MASHINA XONASI (orqa tomonda) ----------
  const mhX = boomFrom + 7.5, mhW = 12.5, mhH = 5.4, mhD = 8.4;
  B.white.box(mhW, mhH, mhD, mhX, gTop + mhH / 2, zc);
  B.navy.box(mhW + 0.06, 0.7, mhD + 0.06, mhX, gTop + mhH - 0.55, zc);
  B.steel.box(mhW + 0.4, 0.25, mhD + 0.4, mhX, gTop + mhH + 0.12, zc);
  // panjaralar (jalyuzi) va eshik
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) B.steel.box(1.6, 1.2, 0.06, mhX - 4.5 + i * 3, gTop + 2.4, zc + s * (mhD / 2 + 0.02));
    B.steel.box(0.06, 2.2, 1.0, mhX + s * (mhW / 2 + 0.02), gTop + 1.2, zc + 2);
  }
  // tomdagi ventilyatorlar va konditsionerlar
  for (const dx of [-3.5, 0, 3.5]) B.steel.cyl(0.6, 0.5, mhX + dx, gTop + mhH + 0.5, zc - 1.8, null, 16);
  B.steel.box(2.2, 1.0, 1.4, mhX + 3, gTop + mhH + 0.75, zc + 2.2);

  // ---------- ZINAPOYA MINORASI (quruqlik oyog'i yonida) ----------
  {
    const x0 = lx - 2.4, z0 = zc + half;
    B.steel.box(0.12, legTop, 0.12, x0 - 1.1, legTop / 2, z0 - 1.1);
    B.steel.box(0.12, legTop, 0.12, x0 + 1.1, legTop / 2, z0 - 1.1);
    B.steel.box(0.12, legTop, 0.12, x0 - 1.1, legTop / 2, z0 + 1.1);
    B.steel.box(0.12, legTop, 0.12, x0 + 1.1, legTop / 2, z0 + 1.1);
    for (let y = 2.5, k = 0; y < legTop - 1; y += 2.8, k++) {
      B.steel.box(2.4, 0.08, 2.4, x0, y, z0);
      const dir = k % 2 ? 1 : -1;
      B.steel.beam(V(x0 - dir, y, z0 - 0.5), V(x0 + dir, y + 2.8, z0 - 0.5), 0.08, 0.9);
      B.yellow.box(2.4, 0.05, 0.05, x0, y + 1.1, z0 + 1.15);
    }
  }

  // ---------- OGOHLANTIRUVCHI CHIROQLAR va prozhektorlar ----------
  const redMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(6) });
  const red = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 12, 8), redMat, 4);
  [[boomTo - 0.4, gTop + 0.4, zc - gZ], [boomTo - 0.4, gTop + 0.4, zc + gZ], [apex.x, apex.y + 1.3, zc], [mhX, gTop + mhH + 0.6, zc + 3.5]]
    .forEach(([x, y, z], i) => red.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z)));
  group.add(red);
  for (let x = boomFrom + 10; x < boomTo; x += 12) for (const s of [-1, 1]) B.steel.box(0.5, 0.35, 0.6, x, gBot - 0.25, zc + s * (gZ + 0.9));

  // ---------- strela yon tomonidagi brend yozuvi ----------
  const brand = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 5.5),
    new THREE.MeshStandardMaterial({ alphaMap: solidLogoTexture(), color: '#1D3E69', transparent: true, roughness: 0.5, depthWrite: false }),
  );
  brand.position.set(-8, boomY, zc + gZ + gW / 2 + 0.13);
  group.add(brand);

  for (const [k, b] of Object.entries(B)) {
    const mesh = b.mesh(M[k]);
    if (mesh) group.add(mesh);
  }

  // ---------- TROLLEY (aravacha) + kabina ----------
  const trolley = new THREE.Group();
  const T = { navy: bucket(), steel: bucket(), white: bucket(), glass: bucket(), black: bucket() };
  T.navy.box(5.2, 1.5, gZ * 2 + 1.6, 0, gTop + 0.95, zc);
  T.steel.box(4.4, 0.4, gZ * 2 + 2.0, 0, gTop + 1.9, zc);
  for (const dx of [-1.6, 1.6]) for (const s of [-1, 1]) T.black.cyl(0.4, 0.3, dx, gTop + 0.35, zc + s * gZ, new THREE.Euler(Math.PI / 2, 0, 0), 16);
  // tros g'altaklari
  for (const s of [-1, 1]) T.steel.cyl(0.55, 0.35, 0, gTop + 0.5, zc + s * 0.9, new THREE.Euler(0, 0, Math.PI / 2), 18);
  // kabina: to'sinlar tagida, yon tomonda osilgan
  const cz = zc - gZ - 1.9;
  T.steel.box(0.3, 3.6, 0.3, 0.6, gBot - 0.2, cz + 0.8);
  T.steel.box(0.3, 3.6, 0.3, -0.6, gBot - 0.2, cz + 0.8);
  T.white.box(2.8, 2.5, 2.4, 0, gBot - 2.6, cz);
  T.glass.box(2.86, 1.25, 2.3, 0, gBot - 2.45, cz - 0.04);
  T.glass.box(2.3, 0.06, 1.9, 0, gBot - 3.87, cz);
  T.navy.box(2.9, 0.18, 2.5, 0, gBot - 1.32, cz);
  for (const [k, b] of Object.entries(T)) { const mesh = b.mesh(M[k]); if (mesh) trolley.add(mesh); }
  group.add(trolley);

  return { group, trolley, ropeTop: gTop + 0.5 };
}

/** To'liq bo'yalgan logo: HM belgisi + GROUP (harflar balandligi belgiga teng) — alphaMap uchun */
function solidLogoTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 512;
  const ctx = c.getContext('2d');
  const h = 200, w = (HM_W / HM_H) * h, gap = 110;
  ctx.font = `600 ${Math.round(h / 0.727)}px ${FONT}`; // Inter: bosh harf balandligi ≈ 0.727em
  if ('letterSpacing' in ctx) ctx.letterSpacing = '20px';
  const textW = ctx.measureText('GROUP').width;
  const x0 = (2048 - (w + gap + textW)) / 2, base = 256 + h / 2;
  drawHM(ctx, x0 + w / 2, 256, w, '#fff');
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('GROUP', x0 + w + gap, base);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

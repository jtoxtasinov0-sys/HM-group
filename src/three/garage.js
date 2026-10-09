import * as THREE from 'three';
import { createGlossyFloor } from './floor.js';
import {
  makeFloorTexture, makeWallLogoTexture, makeTurntableTexture, makeRubberTexture,
  makeShutterTexture, makeGroundTexture,
} from './textures.js';

// Garaj o'lchamlari (metr). Story shu raqamlardan foydalanadi.
// Xona — oq "galereya": orqa devor yarim ellips (dumaloq zal), shiftda katta yorug' doira.
export const G = {
  wallZ: -9,
  wallT: 0.4,
  doorW: 5.4,
  doorH: 4.4,
  ceilY: 7.4,
  halfW: 24,
  frontZ: 28,
  ellZ: 3.5,     // orqa ellips markazi (z)
  ellB: 12.5,    // ellipsning chuqurligi: ellZ - ellB = wallZ
  ttH: 0.035,    // platforma balandligi
  stage: new THREE.Vector3(0, 0, 3.6),
  stageR: 3.0,
  stageRing: 0.45,
  slotR: 2.25,
  slotRing: 0.3,
  skyR: 5.2,     // sahna ustidagi yorug' doira
  // chapdan o'ngga: 3 ta chapda, 3 ta o'ngda, o'rtada yo'lak
  slots: [
    { x: -15.0, z: -2.4, yaw: 0.62 },
    { x: -9.9,  z: -1.8, yaw: 0.62 },
    { x: -4.9,  z: -0.9, yaw: 0.62 },
    { x: 4.9,   z: -0.9, yaw: -0.62 },
    { x: 9.9,   z: -1.8, yaw: -0.62 },
    { x: 15.0,  z: -2.4, yaw: -0.62 },
  ],
  container: new THREE.Vector3(0, 0, -16.35),
};

const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

/** Xona konturi (yuqoridan): oldingi to'g'ri devorlar + orqada yarim ellips. inset — ichkariga surish */
function outline(n = 160, inset = 0) {
  const W = G.halfW - inset, B = G.ellB - inset;
  const pts = [new THREE.Vector2(W, G.frontZ), new THREE.Vector2(W, G.ellZ)];
  for (let i = 1; i < n; i++) {
    const a = (i / n) * Math.PI;
    pts.push(new THREE.Vector2(Math.cos(a) * W, G.ellZ - Math.sin(a) * B));
  }
  pts.push(new THREE.Vector2(-W, G.ellZ), new THREE.Vector2(-W, G.frontZ));
  return pts; // (x, z)
}

/** Kontur bo'ylab vertikal devor lentasi; skip(x, z) — bu bo'lakni tashlab ketish */
function wallStrip(pts, y0, y1, skip) {
  const pos = [], uv = [], idx = [];
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) len += pts[i].distanceTo(pts[i - 1]);
    pos.push(pts[i].x, y0, pts[i].y, pts[i].x, y1, pts[i].y);
    uv.push(len / 6, y0 / G.ceilY, len / 6, y1 / G.ceilY);
    if (i && !(skip && skip((pts[i].x + pts[i - 1].x) / 2))) {
      const a = (i - 1) * 2, b = i * 2;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createGarage({ quality }) {
  const group = new THREE.Group();
  group.name = 'garage';
  const anim = {}; // story boshqaradigan qismlar
  const dimmable = []; // "teatr" rejimida xiralashadigan materiallar

  const wallMat = new THREE.MeshStandardMaterial({ color: '#e3e6ea', roughness: 0.93, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.85 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: '#f3f4f6', roughness: 0.96, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 1 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#c9ced6', roughness: 0.5, metalness: 0.4, envMapIntensity: 1 });
  dimmable.push(wallMat, ceilMat, trimMat);

  // ---------- POL ----------
  const floorTex = makeFloorTexture();
  const depth = G.frontZ - G.wallZ;
  const floor = createGlossyFloor({
    width: G.halfW * 2, depth, color: new THREE.Color('#d9dce1'), map: floorTex, repeat: depth / 5,
    roughness: 0.32, strength: quality.reflections ? 0.2 : 0, resolution: quality.reflectionRes, reflect: quality.reflections,
  });
  floor.mesh.position.set(0, 0, (G.frontZ + G.wallZ) / 2);
  floor.mesh.material.envMapIntensity = 0.9;
  dimmable.push(floor.mesh.material);
  group.add(floor.mesh);
  anim.floor = floor;

  // ---------- DEVORLAR (dumaloq zal) ----------
  const pts = outline();
  const inDoor = (x) => Math.abs(x) < G.doorW / 2 - 0.01;
  const backish = (x) => inDoor(x); // eshik faqat orqada (ellips o'rtasida)
  group.add(new THREE.Mesh(wallStrip(pts, 0, G.doorH, backish), wallMat));
  group.add(new THREE.Mesh(wallStrip(pts, G.doorH, G.ceilY), wallMat));
  // old devor (kamera orqasida)
  const front = new THREE.Mesh(new THREE.PlaneGeometry(G.halfW * 2, G.ceilY), wallMat);
  front.position.set(0, G.ceilY / 2, G.frontZ);
  group.add(front);
  // devor pastidagi soya chizig'i (plintus) — pol va devor ajralib tursin
  group.add(new THREE.Mesh(wallStrip(outline(160, 0.02), 0, 0.09, backish),
    new THREE.MeshStandardMaterial({ color: '#b9bfc7', roughness: 0.7, side: THREE.DoubleSide })));

  // ---------- SHIFT: katta yorug' doira + nuqtali chiroqlar ----------
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y)));
  const holes = [{ x: G.stage.x, z: G.stage.z, r: G.skyR }];
  G.slots.forEach((s) => holes.push({ x: s.x, z: s.z + 0.3, r: 1.7 }));
  for (const h of holes) shape.holes.push(new THREE.Path().absarc(h.x, -h.z, h.r, 0, Math.PI * 2, true));
  const ceiling = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), ceilMat);
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.y = G.ceilY;
  group.add(ceiling);

  const skyMat = new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 3.6), side: THREE.DoubleSide });
  const skySoft = new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 2.0), side: THREE.DoubleSide });
  const recessMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.BackSide, emissive: new THREE.Color('#dfe6ee'), emissiveIntensity: 0.6 });
  const makeSkylight = (x, z, r, mat, deep) => {
    const well = new THREE.Mesh(new THREE.CylinderGeometry(r, r, deep, 96, 1, true), recessMat);
    well.position.set(x, G.ceilY + deep / 2, z);
    group.add(well);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 96), mat);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(x, G.ceilY + deep, z);
    group.add(disc);
  };
  makeSkylight(G.stage.x, G.stage.z, G.skyR, skyMat, 0.55);
  holes.slice(1).forEach((h) => makeSkylight(h.x, h.z, h.r, skySoft, 0.35));

  // nuqtali chiroqlar (downlight) — ellips bo'ylab
  const dlMat = new THREE.MeshBasicMaterial({ color: hdr('#fffaf0', 5) });
  const dlRim = new THREE.MeshStandardMaterial({ color: '#d5d9df', roughness: 0.4, metalness: 0.6 });
  const dlGeo = new THREE.CircleGeometry(0.09, 24);
  const dlRimGeo = new THREE.RingGeometry(0.09, 0.15, 24);
  const downlights = [];
  for (const [k, n] of [[0.86, 26], [0.6, 18]]) {
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI;
      downlights.push([Math.cos(a) * G.halfW * k, G.ellZ - Math.sin(a) * G.ellB * k]);
    }
  }
  for (let z = G.ellZ + 4; z < G.frontZ - 1; z += 4) for (const x of [-G.halfW * 0.86, -G.halfW * 0.6, G.halfW * 0.6, G.halfW * 0.86]) downlights.push([x, z]);
  for (const [x, z] of downlights) {
    if (holes.some((h) => Math.hypot(x - h.x, z - h.z) < h.r + 0.6)) continue;
    const d = new THREE.Mesh(dlGeo, dlMat);
    d.rotation.x = Math.PI / 2;
    d.position.set(x, G.ceilY - 0.01, z);
    const rr = new THREE.Mesh(dlRimGeo, dlRim);
    rr.rotation.x = Math.PI / 2;
    rr.position.copy(d.position);
    group.add(d, rr);
  }

  // ---------- ESHIK va LOGO ----------
  const backZ = G.ellZ - G.ellB; // = wallZ
  // eshik bo'yni (devor qalinligi)
  const jamb = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat); m.position.set(x, y, z); group.add(m); };
  for (const s of [-1, 1]) jamb(0.12, G.doorH + 0.12, 0.5, s * (G.doorW / 2 + 0.06), (G.doorH + 0.12) / 2, backZ - 0.1);
  jamb(G.doorW + 0.24, 0.12, 0.5, 0, G.doorH + 0.06, backZ - 0.1);

  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 2.2),
    new THREE.MeshBasicMaterial({ map: makeWallLogoTexture(), color: new THREE.Color('#1D3E69'), transparent: true, depthWrite: false, toneMapped: false }),
  );
  logo.position.set(0, G.doorH + (G.ceilY - G.doorH) / 2 + 0.05, backZ + 0.12);
  group.add(logo);

  const shutterTex = makeShutterTexture();
  shutterTex.repeat.set(1, 4);
  const shutter = new THREE.Mesh(
    new THREE.PlaneGeometry(G.doorW, G.doorH),
    new THREE.MeshStandardMaterial({ color: '#d9dde3', map: shutterTex, roughness: 0.4, metalness: 0.6, envMapIntensity: 0.9 }),
  );
  shutter.position.set(0, G.doorH / 2, backZ - 0.2);
  group.add(shutter);
  anim.shutter = shutter;

  // ---------- AYLANMA PLATFORMALAR (oq disk + qora rezina halqa) ----------
  const ttTex = makeTurntableTexture();
  const ttMat = new THREE.MeshPhysicalMaterial({ color: '#f6f7f8', map: ttTex, metalness: 0, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.9 });
  const rubberTex = makeRubberTexture();
  const rubberMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: rubberTex, roughness: 0.78, metalness: 0, envMapIntensity: 0.5 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#aab2bd', roughness: 0.3, metalness: 0.9 });
  dimmable.push(ttMat);
  const makeTurntable = (r, ring, x, z) => {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, G.ttH, 128), ttMat);
    disc.position.y = G.ttH / 2;
    g.add(disc);
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, G.ttH * 0.7, 128, 1, true), edgeMat);
    edge.position.y = G.ttH * 0.35;
    g.add(edge);
    const band = new THREE.Mesh(new THREE.RingGeometry(r + 0.03, r + ring, 128, 1), rubberMat);
    band.rotation.x = -Math.PI / 2;
    band.position.y = 0.006;
    g.add(band);
    // nozik LED chiziq — hover / tanlashda yonadi
    const rimMat = new THREE.MeshBasicMaterial({ color: hdr('#8fb1e0', 0.55), transparent: true, depthWrite: false });
    const rim = new THREE.Mesh(new THREE.RingGeometry(r + 0.03, r + 0.06, 160, 1), rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.009;
    g.add(rim);
    g.position.set(x, 0, z);
    group.add(g);
    return { group: g, disc, rimMat, base: rimMat.color.clone() };
  };
  anim.turntables = G.slots.map((s) => makeTurntable(G.slotR, G.slotRing, s.x, s.z));
  anim.stage = makeTurntable(G.stageR, G.stageRing, G.stage.x, G.stage.z);

  // sahna markazidagi "HM" belgisi (bo'sh turganda ko'rinadi)
  const stageLogo = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 1.5),
    new THREE.MeshBasicMaterial({ map: makeWallLogoTexture(), color: new THREE.Color('#1D3E69'), transparent: true, depthWrite: false, opacity: 0.55, toneMapped: false }),
  );
  stageLogo.rotation.x = -Math.PI / 2;
  stageLogo.position.set(G.stage.x, G.ttH + 0.003, G.stage.z + 0.2);
  group.add(stageLogo);
  anim.stageLogo = stageLogo;

  // ---------- HOVLI (eshik orqasi, konteyner turadigan joy) — kunduzgi ----------
  const yard = new THREE.Group();
  const groundTex = makeGroundTexture();
  groundTex.repeat.set(20, 12);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 80),
    new THREE.MeshStandardMaterial({ color: '#a3abb5', map: groundTex, roughness: 0.9, metalness: 0, envMapIntensity: 0.8 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.005, G.wallZ - G.wallT - 40);
  yard.add(ground);
  // konteyner joyi chiziqlari
  const lineMat = new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 0.9) });
  for (const s of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 9), lineMat);
    l.rotation.x = -Math.PI / 2;
    l.position.set(s * 1.75, 0.003, G.container.z);
    yard.add(l);
  }
  // hovli chiroq ustunlari
  const poleMat = new THREE.MeshStandardMaterial({ color: '#c3cad3', roughness: 0.45, metalness: 0.6 });
  for (const [x, z] of [[-9, -14], [9, -14], [-9, -26], [9, -26]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 8, 12), poleMat);
    pole.position.set(x, 4, z);
    yard.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.4), poleMat);
    lamp.position.set(x - Math.sign(x) * 0.4, 8, z);
    yard.add(lamp);
  }
  group.add(yard);

  // ---------- YORUG'LIK ----------
  const hemi = new THREE.HemisphereLight('#ffffff', '#b9c0ca', 0.5);
  group.add(hemi);
  const key = new THREE.DirectionalLight('#ffffff', 0.55);
  key.position.set(4, 12, 10);
  group.add(key);
  // katta doira ostidagi yumshoq yorug'lik "hovuzi"
  const skySpot = new THREE.SpotLight('#ffffff', 90, 22, 1.0, 1, 1.4);
  skySpot.position.set(G.stage.x, G.ceilY + 0.4, G.stage.z);
  skySpot.target.position.set(G.stage.x, 0, G.stage.z);
  group.add(skySpot, skySpot.target);

  const skyBase = skyMat.color.clone();
  const softBase = skySoft.color.clone();
  const dlBase = dlMat.color.clone();
  dimmable.forEach((m) => { m.userData.baseEnv = m.envMapIntensity; });
  let lastAmb = 1;
  // k: 1 — to'liq yorug', <1 — xira (sahna yoritgichi ta'kidlanadi)
  anim.ambient = (k) => {
    if (Math.abs(k - lastAmb) < 0.002) return;
    lastAmb = k;
    hemi.intensity = 0.5 * k;
    key.intensity = 0.55 * k;
    skySpot.intensity = 90 * (0.5 + 0.5 * k);
    for (const m of dimmable) m.envMapIntensity = m.userData.baseEnv * k;
    skyMat.color.copy(skyBase).multiplyScalar(0.55 + 0.45 * k);
    skySoft.color.copy(softBase).multiplyScalar(0.4 + 0.6 * k);
    dlMat.color.copy(dlBase).multiplyScalar(0.5 + 0.5 * k);
  };

  const hoverSpot = new THREE.SpotLight('#ffffff', 0, 18, 0.42, 0.6, 1.2);
  hoverSpot.position.set(0, G.ceilY - 0.3, 0);
  group.add(hoverSpot, hoverSpot.target);
  anim.hoverSpot = hoverSpot;

  const stageSpot = new THREE.SpotLight('#ffffff', 0, 16, 0.5, 0.7, 1.2);
  stageSpot.position.set(G.stage.x + 1.5, G.ceilY - 0.3, G.stage.z + 2.5);
  stageSpot.target.position.copy(G.stage);
  group.add(stageSpot, stageSpot.target);
  anim.stageSpot = stageSpot;

  const yardSpot = new THREE.SpotLight('#ffffff', 30, 30, 0.6, 0.6, 1.4);
  yardSpot.position.set(0, 9.5, G.wallZ - 1.2);
  yardSpot.target.position.set(0, 0.5, G.container.z - 1);
  group.add(yardSpot, yardSpot.target);
  const yardFill = new THREE.PointLight('#ffffff', 8, 22, 1.6);
  yardFill.position.set(6, 5, G.container.z - 4);
  group.add(yardFill);

  /** Pol balandligi (platformalar ustida biroz yuqori) — g'ildiraklar uchun */
  const pads = [{ x: G.stage.x, z: G.stage.z, r: G.stageR }, ...G.slots.map((s) => ({ x: s.x, z: s.z, r: G.slotR }))];
  anim.groundAt = (x, z) => {
    let h = 0;
    for (const p of pads) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r + 0.2) h = Math.max(h, G.ttH * (1 - THREE.MathUtils.smoothstep(d, p.r - 0.2, p.r + 0.2)));
    }
    return h;
  };

  return { group, anim, floor };
}

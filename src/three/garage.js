import * as THREE from 'three';
import { createGlossyFloor } from './floor.js';
import { createSky } from './sky.js';
import {
  makeWallLogoTexture, makeTurntableTexture, makeRubberTexture, makePolishedFloorTextures, makePlasterWallTexture,
  makeScallopTexture, makeShutterTextures, makeConcreteTextures, makeStackTextures, makeGrimeTexture, rand,
} from './textures.js';

// Garaj o'lchamlari (metr). Story shu raqamlardan foydalanadi.
// Xona — oq "galereya": orqa devor yarim ellips (dumaloq zal), shiftda katta yorug' doira.
export const G = {
  wallZ: -9,
  wallT: 0.4,
  doorW: 5.4,
  doorH: 4.4,
  ceilY: 7.4,
  halfW: 30,
  frontZ: 36,
  ellZ: 3.5,     // orqa ellips markazi (z)
  ellB: 12.5,    // ellipsning chuqurligi: ellZ - ellB = wallZ
  ttH: 0.035,    // platforma balandligi
  stage: new THREE.Vector3(0, 0, 3.6),
  stageR: 3.0,
  stageRing: 0.45,
  slotR: 1.74,
  slotRing: 0.16,
  skyR: 6.2,     // sahna ustidagi yorug' doira
  // chapdan o'ngga (cars.js → GARAGE tartibida): 6 ta chapda, 5 ta o'ngda, o'rtada yo'lak.
  // Oraliq 4 m — yo'lga chiqqan mashina qo'shnisiga, devorga va sahnaga tegmaydi (eng chetdagisi devor
  // egilgani uchun biroz oldinda). Joy qo'shilsa yoki surilsa, haydash yo'llarini qayta tekshiring.
  slots: [
    { x: -24.5, z: 0.8,  yaw: 0.5 },
    { x: -20.5, z: -1.0, yaw: 0.5 },
    { x: -16.5, z: -1.0, yaw: 0.5 },
    { x: -12.5, z: -1.0, yaw: 0.5 },
    { x: -8.5,  z: -1.0, yaw: 0.5 },
    { x: -4.5,  z: -1.0, yaw: 0.5 },
    { x: 4.5,   z: -1.0, yaw: -0.5 },
    { x: 8.5,   z: -1.0, yaw: -0.5 },
    { x: 12.5,  z: -1.0, yaw: -0.5 },
    { x: 16.5,  z: -1.0, yaw: -0.5 },
    { x: 20.5,  z: -1.0, yaw: -0.5 },
  ],
  container: new THREE.Vector3(0, 0, -16.35),
};

// hovlidagi quyosh: o'ng tomondan (+x), baland — konteynerning kameraga qaragan yonini yoritadi,
// garaj soyasi esa konteynerga tushmaydi
export const YARD_SUN = new THREE.Vector3(0.62, 0.6, 0.5).normalize();

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

/**
 * Kontur bo'ylab vertikal devor lentasi.
 * skip(x, len) — bu bo'lakni tashlab ketish; uLen — tekstura necha metrda takrorlanadi (gorizontal);
 * v0..v1 — tekstura vertikal oralig'i (metr).
 */
function wallStrip(pts, y0, y1, { skip, uLen = 6, v0 = 0, v1 = G.ceilY } = {}) {
  const pos = [], uv = [], idx = [];
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    const seg = i ? pts[i].distanceTo(pts[i - 1]) : 0;
    len += seg;
    pos.push(pts[i].x, y0, pts[i].y, pts[i].x, y1, pts[i].y);
    uv.push(len / uLen, (y0 - v0) / (v1 - v0), len / uLen, (y1 - v0) / (v1 - v0));
    if (i && !(skip && skip((pts[i].x + pts[i - 1].x) / 2, len - seg / 2))) {
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

/** Shift rangi: tom-oyna atrofida yorug'roq, chetlarga qarab biroz to'q (yorug'lik so'nishi) */
function ceilingGradient(mat) {
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHmW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHmW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHmW;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float hmD = length(vHmW.xz - vec2(${G.stage.x.toFixed(2)}, ${G.stage.z.toFixed(2)}));
        diffuseColor.rgb *= mix(1.04, 0.8, smoothstep(${(G.skyR + 0.5).toFixed(1)}, 22.0, hmD));`);
  };
  mat.customProgramCacheKey = () => 'hm-ceiling';
}

export function createGarage({ quality }) {
  const group = new THREE.Group();
  group.name = 'garage';
  const anim = {}; // story boshqaradigan qismlar
  const dimmable = []; // "teatr" rejimida xiralashadigan materiallar

  // Rang: mashina konteynerga chiqayotgandagi kabi — sovuq ko'kish-kulrang gips, oq "studiya" emas.
  // Yorug'lik markazda (tom-oyna ostida) yig'iladi, devorlar chetga qarab to'qlashadi — chuqurlik va kontrast
  const wallMat = new THREE.MeshStandardMaterial({ color: '#c6cbd2', map: makePlasterWallTexture(), roughness: 0.92, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.55 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: '#ccd2d9', emissive: new THREE.Color('#c9d0d9'), emissiveIntensity: 0.08, roughness: 0.96, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.6 });
  ceilingGradient(ceilMat);
  const metalMat = new THREE.MeshStandardMaterial({ color: '#c6ccd3', map: makeGrimeTexture(23), roughness: 0.3, metalness: 0.85, envMapIntensity: 1.1 });
  dimmable.push(wallMat, ceilMat, metalMat);

  // ---------- POL: sayqallangan beton ----------
  const ft = makePolishedFloorTextures();
  const depth = G.frontZ - G.wallZ;
  const floor = createGlossyFloor({
    width: G.halfW * 2, depth, color: new THREE.Color('#b4bcc6'), map: ft.map, roughnessMap: ft.roughnessMap, repeat: depth / 8,
    roughness: 1, strength: quality.reflections ? 0.55 : 0, resolution: quality.reflectionRes, reflect: quality.reflections, seams: false,
  });
  floor.mesh.position.set(0, 0, (G.frontZ + G.wallZ) / 2);
  floor.mesh.material.envMapIntensity = 0.7;
  floor.mesh.receiveShadow = true;
  dimmable.push(floor.mesh.material);
  group.add(floor.mesh);
  anim.floor = floor;

  // ---------- DEVORLAR (dumaloq zal) ----------
  const pts = outline();
  const inDoor = (x) => Math.abs(x) < G.doorW / 2 - 0.01;
  const wallLow = new THREE.Mesh(wallStrip(pts, 0, G.doorH, { skip: inDoor }), wallMat);
  const wallHigh = new THREE.Mesh(wallStrip(pts, G.doorH, G.ceilY), wallMat);
  // old devor (kamera orqasida)
  const front = new THREE.Mesh(new THREE.PlaneGeometry(G.halfW * 2, G.ceilY), wallMat);
  front.position.set(0, G.ceilY / 2, G.frontZ);
  for (const m of [wallLow, wallHigh, front]) { m.castShadow = m.receiveShadow = true; group.add(m); }
  // devor pastidagi ingichka soya tirqishi (pol va devor ajralib tursin)
  group.add(new THREE.Mesh(wallStrip(outline(160, 0.015), 0, 0.045, { skip: inDoor }),
    new THREE.MeshStandardMaterial({ color: '#79838f', roughness: 0.8, side: THREE.DoubleSide })));

  // ---------- SHIFT + katta tom-oyna ----------
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y)));
  shape.holes.push(new THREE.Path().absarc(G.stage.x, -G.stage.z, G.skyR, 0, Math.PI * 2, true));
  const ceiling = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), ceilMat);
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.y = G.ceilY;
  ceiling.castShadow = true;
  group.add(ceiling);

  const skyMat = new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 2.2), side: THREE.DoubleSide });
  const recessMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.BackSide, emissive: new THREE.Color('#e8eef5'), emissiveIntensity: 1.1 });
  {
    const deep = 0.22;
    const well = new THREE.Mesh(new THREE.CylinderGeometry(G.skyR, G.skyR, deep, 128, 1, true), recessMat);
    well.position.set(G.stage.x, G.ceilY + deep / 2, G.stage.z);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(G.skyR, 128), skyMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(G.stage.x, G.ceilY + deep, G.stage.z);
    // ingichka alyumin hoshiya
    const bezel = new THREE.Mesh(new THREE.RingGeometry(G.skyR, G.skyR + 0.09, 128), metalMat);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.set(G.stage.x, G.ceilY - 0.004, G.stage.z);
    // tom-oyna atrofidagi yumshoq nur (shiftga tarqalgan yorug'lik) — bloom o'rniga, boshqariladigan
    const haloR = G.skyR + 3.2;
    const hc = document.createElement('canvas');
    hc.width = hc.height = 512;
    const hx = hc.getContext('2d');
    const grad = hx.createRadialGradient(256, 256, 256 * (G.skyR / haloR), 256, 256, 256);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.18, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    hx.fillStyle = grad; hx.fillRect(0, 0, 512, 512);
    const halo = new THREE.Mesh(new THREE.RingGeometry(G.skyR + 0.09, haloR, 128, 1), new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(hc), color: hdr('#ffffff', 0.55), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    halo.rotation.x = Math.PI / 2;
    halo.position.set(G.stage.x, G.ceilY - 0.006, G.stage.z);
    halo.renderOrder = 2;
    group.add(well, disc, bezel, halo);
  }

  // ---------- DEVORNI YORITUVCHI DOWNLIGHTLAR + "nur yelpig'ichlari" ----------
  const dlMat = new THREE.MeshBasicMaterial({ color: hdr('#fff8ee', 9) });
  const dlRim = new THREE.MeshStandardMaterial({ color: '#d5d9df', roughness: 0.35, metalness: 0.7 });
  const dlGeo = new THREE.CircleGeometry(0.075, 24);
  const dlRimGeo = new THREE.RingGeometry(0.075, 0.13, 24);
  const fixture = (x, z) => {
    const d = new THREE.Mesh(dlGeo, dlMat);
    d.rotation.x = Math.PI / 2;
    d.position.set(x, G.ceilY - 0.01, z);
    const rr = new THREE.Mesh(dlRimGeo, dlRim);
    rr.rotation.x = Math.PI / 2;
    rr.position.copy(d.position);
    group.add(d, rr);
  };
  const SC = 3.4; // yelpig'ichlar oralig'i (m)
  const wpts = outline(240, 0.02);
  // kontur bo'ylab uzunlik → nuqta va ichkariga yo'nalgan normal
  const cum = [0];
  for (let i = 1; i < wpts.length; i++) cum.push(cum[i - 1] + wpts[i].distanceTo(wpts[i - 1]));
  const centers = [];
  for (let k = 0; (k + 0.5) * SC < cum[cum.length - 1]; k++) {
    const L = (k + 0.5) * SC;
    let i = 1;
    while (cum[i] < L) i++;
    const t = (L - cum[i - 1]) / (cum[i] - cum[i - 1]);
    const p = wpts[i - 1].clone().lerp(wpts[i], t);
    const tan = wpts[i].clone().sub(wpts[i - 1]).normalize();
    let n = new THREE.Vector2(tan.y, -tan.x);
    if (n.dot(new THREE.Vector2(0, G.ellZ).sub(p)) < 0) n.negate();
    centers.push({ p, n, hide: Math.abs(p.x) < 5.6 || p.y > G.frontZ - 2 });
  }
  const scallopMat = new THREE.MeshBasicMaterial({
    map: makeScallopTexture(), color: hdr('#fff3e4', 0.95), blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const scTop = G.ceilY - 0.02, scBot = G.ceilY - 4.4;
  const scallops = new THREE.Mesh(wallStrip(wpts, scBot, scTop, {
    uLen: SC, v0: scBot, v1: scTop,
    skip: (x, len) => { const c = centers[Math.floor(len / SC)]; return !c || c.hide; },
  }), scallopMat);
  scallops.renderOrder = 2;
  group.add(scallops);
  for (const c of centers) if (!c.hide) fixture(c.p.x + c.n.x * 0.75, c.p.y + c.n.y * 0.75);
  // tom-oyna atrofidagi siyrak downlightlar
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2;
    fixture(G.stage.x + Math.cos(a) * (G.skyR + 2.6), G.stage.z + Math.sin(a) * (G.skyR + 2.6));
  }
  for (const s of [-1, 1]) for (const [x, z] of [[12, -5], [12.5, 2], [17, -2], [18, 6], [10, 10], [16, 14], [8, 18], [16, 22]]) fixture(s * x, z);

  // ---------- ESHIK (alyumin roll-darvoza) va LOGO ----------
  const backZ = G.ellZ - G.ellB; // = wallZ
  const frameD = 0.26, frameW = 0.16;
  const fbox = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), metalMat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  for (const s of [-1, 1]) fbox(frameW, G.doorH + frameW, frameD, s * (G.doorW / 2 + frameW / 2), (G.doorH + frameW) / 2, backZ + 0.03);
  fbox(G.doorW + frameW * 2, frameW + 0.06, frameD + 0.04, 0, G.doorH + (frameW + 0.06) / 2, backZ + 0.05); // tepadagi quti
  fbox(G.doorW, 0.012, 0.22, 0, 0.006, backZ + 0.02);                                                      // ostona

  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 2.2),
    new THREE.MeshBasicMaterial({ map: makeWallLogoTexture(), color: new THREE.Color('#1D3E69'), transparent: true, depthWrite: false, toneMapped: false }),
  );
  logo.position.set(0, G.doorH + (G.ceilY - G.doorH) / 2 + 0.05, backZ + 0.12);
  group.add(logo);

  const sh = makeShutterTextures();
  const shutterMaps = [sh.map, sh.normalMap, sh.roughnessMap];
  shutterMaps.forEach((t) => t.repeat.set(1, G.doorH));
  const shutter = new THREE.Mesh(
    new THREE.PlaneGeometry(G.doorW, G.doorH),
    new THREE.MeshStandardMaterial({ color: '#ffffff', map: sh.map, normalMap: sh.normalMap, roughnessMap: sh.roughnessMap, roughness: 1, metalness: 0.72, envMapIntensity: 1.15 }),
  );
  shutter.position.set(0, G.doorH / 2, backZ - 0.07);
  shutter.receiveShadow = shutter.castShadow = true;
  group.add(shutter);
  const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(G.doorW, 0.07, 0.07), metalMat);
  bottomBar.castShadow = true;
  group.add(bottomBar);
  anim.shutter = shutter;
  /** open: 0 — yopiq, 1 — ochiq. Parda tepadagi barabanga o'raladi: plastinkalar siqilmaydi */
  anim.setShutter = (open) => {
    const s = 1 - open * 0.97;
    shutter.scale.y = s;
    shutter.position.y = G.doorH - (G.doorH * s) / 2;
    shutterMaps.forEach((t) => t.repeat.set(1, G.doorH * s));
    bottomBar.position.set(0, G.doorH * (1 - s) + 0.035, backZ - 0.07);
  };
  anim.setShutter(0);

  // ---------- AYLANMA PLATFORMALAR (oq disk + qora rezina halqa) ----------
  const ttTex = makeTurntableTexture();
  const ttMat = new THREE.MeshPhysicalMaterial({ color: '#f6f7f8', map: ttTex, metalness: 0, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 0.9 });
  const rubberTex = makeRubberTexture();
  const rubberMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: rubberTex, roughness: 0.78, metalness: 0, envMapIntensity: 0.5 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#aab2bd', roughness: 0.3, metalness: 0.9 });
  dimmable.push(ttMat);
  const makeTurntable = (r, ring, x, z) => {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, G.ttH, 128), ttMat);
    disc.position.y = G.ttH / 2;
    disc.receiveShadow = true;
    g.add(disc);
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, G.ttH * 0.7, 128, 1, true), edgeMat);
    edge.position.y = G.ttH * 0.35;
    g.add(edge);
    const band = new THREE.Mesh(new THREE.RingGeometry(r + 0.03, r + ring, 128, 1), rubberMat);
    band.rotation.x = -Math.PI / 2;
    band.position.y = 0.006;
    band.receiveShadow = true;
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
  const yard = createYard(quality);
  group.add(yard.group);
  anim.yardSky = yard.sky;

  // ---------- YORUG'LIK ----------
  const HEMI = 0.56, KEY = 0.55;
  const hemi = new THREE.HemisphereLight('#e9edf2', '#8f97a2', HEMI);
  group.add(hemi);
  const key = new THREE.DirectionalLight('#f6f7f9', KEY);
  key.position.set(4, 12, 10);
  group.add(key);
  // katta doira ostidagi yumshoq yorug'lik "hovuzi" — mashinalarga yumshoq soya beradi
  const skySpot = new THREE.SpotLight('#ffffff', 55, 24, 1.05, 1, 1.4);
  skySpot.position.set(G.stage.x, G.ceilY + 0.1, G.stage.z);
  skySpot.target.position.set(G.stage.x, 0, G.stage.z);
  if (quality.shadows) {
    skySpot.castShadow = true;
    skySpot.shadow.mapSize.set(2048, 2048);
    skySpot.shadow.radius = 7;
    skySpot.shadow.bias = -0.0002;
    skySpot.shadow.normalBias = 0.02;
    skySpot.shadow.camera.near = 1;
    skySpot.shadow.camera.far = 16;
    // soya xaritasi faqat sahnada nimadir qimirlaganda qayta chiziladi (world.js → shadowDirty):
    // garaj jim turganda har kadrda butun sahnani yana bir marta chizish shart emas
    skySpot.shadow.autoUpdate = false;
    skySpot.shadow.needsUpdate = true;
  }
  group.add(skySpot, skySpot.target);

  // quyosh — faqat darvoza ochilganda (devorlar soya beradi, shuning uchun xona ichiga tushmaydi)
  const sun = new THREE.DirectionalLight('#fff3e2', 0);
  sun.position.copy(YARD_SUN).multiplyScalar(80).add(new THREE.Vector3(0, 0, -12));
  sun.target.position.set(0, 0, -12);
  if (quality.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 10; sc.far = 170;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 2;
    // quyosh o'chiq paytda soya xaritasi yangilanmaydi, lekin bir marta albatta chiziladi:
    // chizilmagan soya xaritasi bilan WebGL yoritilgan materiallarni umuman chizmaydi
    sun.shadow.autoUpdate = false;
    sun.shadow.needsUpdate = true;
  }
  group.add(sun, sun.target);
  /** k: 0 — darvoza yopiq (quyosh o'chiq), 1 — tashqari */
  anim.outdoor = (k) => {
    sun.intensity = 2.6 * k;
    sun.shadow.autoUpdate = k > 0.001;
  };
  // GPU konteksti tiklanganda soya xaritasi qayta chiziladi
  anim.refreshShadows = () => { sun.shadow.needsUpdate = true; skySpot.shadow.needsUpdate = true; };
  anim.spotShadowDirty = () => { skySpot.shadow.needsUpdate = true; };

  const skyBase = skyMat.color.clone();
  const dlBase = dlMat.color.clone();
  const scBase = scallopMat.color.clone();
  dimmable.forEach((m) => { m.userData.baseEnv = m.envMapIntensity; });
  let lastAmb = 1;
  // k: 1 — to'liq yorug', <1 — xira (sahna yoritgichi ta'kidlanadi)
  anim.ambient = (k) => {
    if (Math.abs(k - lastAmb) < 0.002) return;
    lastAmb = k;
    hemi.intensity = HEMI * k;
    key.intensity = KEY * k;
    skySpot.intensity = 55 * (0.5 + 0.5 * k);
    for (const m of dimmable) m.envMapIntensity = m.userData.baseEnv * k;
    skyMat.color.copy(skyBase).multiplyScalar(0.55 + 0.45 * k);
    dlMat.color.copy(dlBase).multiplyScalar(0.5 + 0.5 * k);
    scallopMat.color.copy(scBase).multiplyScalar(0.35 + 0.65 * k);
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
  anim.update = (time, camera) => yard.sky.update(time, camera);

  return { group, anim, floor };
}

/** Darvoza orqasidagi ochiq hovli: osmon, beton maydon, chiziqlar, atrofda konteynerlar, devor, chiroqlar */
function createYard(quality) {
  const group = new THREE.Group();
  const sky = createSky({ sunDir: YARD_SUN, clouds: 0.38, gain: 1.05, ground: '#6d747c', sunGlow: '#fff0d6' });
  group.add(sky.mesh);

  // beton maydon
  const ct = makeConcreteTextures({ seed: 35, tone: 152 });
  const GW = 160, GD = 110, slab = 6;
  for (const t of [ct.map, ct.normalMap, ct.roughnessMap]) t.repeat.set(GW / slab, GD / slab);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GW, GD),
    new THREE.MeshStandardMaterial({ map: ct.map, normalMap: ct.normalMap, roughnessMap: ct.roughnessMap, roughness: 1, metalness: 0, envMapIntensity: 0.8 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.004, G.wallZ - GD / 2 + 0.2);
  ground.receiveShadow = true;
  group.add(ground);

  // chiziqlar: konteyner joyi (oq), yo'lak (sariq)
  const paint = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, map: makeGrimeTexture(29) });
  const white = paint('#e8e9ea'), yellow = paint('#d8ab22');
  const line = (mat, w, d, x, z, rot = 0) => {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    l.rotation.set(-Math.PI / 2, 0, rot);
    l.position.set(x, 0.002, z);
    l.receiveShadow = true;
    group.add(l);
  };
  for (const s of [-1, 1]) line(white, 0.12, 8.5, s * 1.75, G.container.z);
  line(white, 3.62, 0.12, 0, G.container.z - 4.25);
  for (const x of [-5.5, 5.5]) line(yellow, 0.15, 60, x, G.wallZ - 32);
  for (let i = 0; i < 9; i++) line(yellow, 0.3, 2.2, -9 + i * 0.9, G.wallZ - 1.6, 0.7);

  // atrofdagi konteyner steklari
  const st = makeStackTextures();
  const L40 = 12.19, W = 2.44, H = 2.59;
  const geo = new THREE.BoxGeometry(W, H, L40);
  const uv = geo.attributes.uv;
  for (let i = 8; i < 24; i++) uv.setX(i, uv.getX(i) * 0.2);
  const mat = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughnessMap: st.roughnessMap, roughness: 1, metalness: 0.35 });
  const colors = ['#1D3E69', '#1D3E69', '#3d7aa6', '#c4ac74', '#2f6a4b', '#bf6130', '#8a3038', '#9ea4aa', '#d6d6d1', '#22407e'];
  const r = rand(55);
  const spots = [];
  for (const sx of [-1, 1]) for (let row = 0; row < 3; row++) for (let bay = 0; bay < 4; bay++) spots.push([sx * (14 + row * 2.7), -22 - bay * 13]);
  for (let bay = 0; bay < 6; bay++) spots.push([-33 + bay * 13, -66], [-27 + bay * 13, -69]);
  const inst = new THREE.InstancedMesh(geo, mat, spots.length * 4);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  let n = 0;
  for (const [x, z] of spots) {
    const rotY = Math.abs(z) > 60 ? Math.PI / 2 : 0;
    const h = 1 + Math.floor(r() * 3.6);
    for (let k = 0; k < h; k++) {
      q.setFromEuler(new THREE.Euler(0, rotY + (r() - 0.5) * 0.01, 0));
      m.compose(new THREE.Vector3(x + (r() - 0.5) * 0.1, H / 2 + k * H, z + (r() - 0.5) * 0.3), q, new THREE.Vector3(1, 1, 1));
      inst.setMatrixAt(n, m);
      inst.setColorAt(n, col.set(colors[Math.floor(r() * colors.length)]).multiplyScalar(0.85 + r() * 0.2));
      n++;
    }
  }
  inst.count = n;
  inst.castShadow = quality.shadows;
  inst.receiveShadow = true;
  group.add(inst);

  // perimetr devori va chiroq ustunlari
  const wallMat = new THREE.MeshStandardMaterial({ color: '#b9bec4', map: makeGrimeTexture(31), roughness: 0.9 });
  for (const [w, x, z, ry] of [[100, 0, -78, 0], [70, -46, -43, Math.PI / 2], [70, 46, -43, Math.PI / 2]]) {
    const wm = new THREE.Mesh(new THREE.BoxGeometry(w, 3, 0.3), wallMat);
    wm.position.set(x, 1.5, z);
    wm.rotation.y = ry;
    wm.receiveShadow = wm.castShadow = true;
    group.add(wm);
  }
  const poleMat = new THREE.MeshStandardMaterial({ color: '#8d959e', roughness: 0.4, metalness: 0.7 });
  for (const [x, z] of [[-9, -14], [9, -14], [-9, -36], [9, -36]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 9, 12), poleMat);
    pole.position.set(x, 4.5, z);
    pole.castShadow = true;
    group.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 0.45), poleMat);
    lamp.position.set(x - Math.sign(x) * 0.45, 9, z);
    lamp.castShadow = true;
    group.add(lamp);
  }
  return { group, sky };
}

import * as THREE from 'three';
import { createSky } from './sky.js';
import { createOcean } from './ocean.js';
import { createCrane, bucket } from './crane.js';
import { makeConcreteTextures, makeStackTextures, makeGrimeTexture, rand } from './textures.js';
import { C } from './container.js';
import { G } from './garage.js';

// Port sahnasi o'lchamlari
export const P = {
  waterY: -3,
  quayEdgeX: 11.5,
  shipX: 22.2,          // kema o'q chizig'i
  shipZ: -24,           // kema markazi (yuklash nuqtasi kema bo'ylab +7.6 da)
  shipDraftY: 7.2,      // model ichidagi suv chizig'i balandligi (masshtabdan oldin)
  // Modeldagi konteynerlar haqiqiydan eni va bo'yi ~1.3 baravar katta (qatlam 3.5 m, eni 3.15 m),
  // uzunligi esa 11.9 m. Kema shunga moslab kichraytiriladi — konteynerlarimiz bilan bir xil o'lcham.
  shipScale: new THREE.Vector3(0.775, 0.74, 1.0245),
  // Kemadagi joy (kema ichidagi koordinata, metr): ustki qatordagi bitta 40 futlik uyacha.
  // Dengiz tomondagi chetki ustun — logotip kameraga ko'rinadi. U "bo'shatiladi": yarmiga HM konteyneri
  // tushadi, yarmida boshqa 20 futlik konteyner turadi.
  bay: { x0: 2.557, x1: 4.96, z0: 6.045, z1: 18.236, top: 19.985, tier: 2.59 },
  craneLegX: [-12, 10], // quruqlik / suv tomondagi oyoqlar
  craneHalfGauge: 11,
  boomY: 41,
  // quyosh: kema suzib ketadigan tomonda (+z), ufqdan ~11° — "oltin soat" yorug'i
  sunDir: new THREE.Vector3(-0.2, 0.19, 0.96).normalize(),
};
// quyosh yo'nalishiga perpendikulyar o'qlar (soya kamerasi tekisligi)
const SUN_X = new THREE.Vector3(0, 1, 0).cross(P.sunDir).normalize();
const SUN_Y = new THREE.Vector3().crossVectors(P.sunDir, SUN_X).normalize();
/** HM konteyneri tushadigan nuqta (kema ichida): pastki markazi */
P.slotLocal = new THREE.Vector3((P.bay.x0 + P.bay.x1) / 2, P.bay.top - P.bay.tier + 0.015, P.bay.z0 + C.L / 2);

// Haqiqiy konteyner liniyalari ranglariga yaqin (biroz eskirgan), HM navy ko'proq
const STACK_COLORS = [
  '#1D3E69', '#1D3E69', '#1D3E69', '#22407e', '#2b4f86', '#8f3a2c', '#9a4433', '#7c3027',
  '#a9aeb3', '#d8d8d3', '#cfd2d4', '#5d6d7c', '#b06a3a', '#2c5a85', '#3f6f9a', '#6b4b3c',
];

// Kema teksturasidagi "kamalak" konteyner ranglarini haqiqiy palitraga o'tkazish (rang tusi bo'yicha):
// qizil/pushti/binafsha → zang-qizil, to'q sariq → terrakota, sariq → bej, yashil → kulrang, ko'k → navy
const SHIP_PALETTE_GLSL = /* glsl */`
  vec3 hmHsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
  }
  vec3 hmPalette(vec3 c) {
    vec3 hsv = hmHsv(c);
    float h = hsv.x;
    vec3 t = h < 0.07 || h > 0.83 ? vec3(0.40, 0.12, 0.09)
           : h < 0.15 ? vec3(0.50, 0.24, 0.11)
           : h < 0.22 ? vec3(0.60, 0.56, 0.48)
           : h < 0.48 ? vec3(0.47, 0.50, 0.52)
           : vec3(0.06, 0.15, 0.33);
    t *= clamp(hsv.z / 0.75, 0.35, 1.25);         // tekstura soyalari saqlanadi
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 grey = vec3(l) * 0.9;
    return mix(grey, t, smoothstep(0.22, 0.42, hsv.y) * step(0.1, hsv.z));
  }
`;

/**
 * Kema materiallari: haqiqiy ranglar, soyalar, masshtab. bay — ustki qatordagi uyacha:
 * u yerdagi geometriya chizilmaydi (va soya ham bermaydi) — HM konteyneri uchun joy.
 * Qaytaradi: update() — har kadrda chaqiriladi (kema chayqalganda uyacha ham birga yuradi).
 */
export function prepareShip(ship, holder) {
  ship.scale.copy(P.shipScale);
  const b = P.bay;
  const uHoleMat = { value: new THREE.Matrix4() };
  const uHoleMin = { value: new THREE.Vector3(b.x0 - 0.03, b.top - b.tier + 0.03, b.z0 - 0.03) };
  const uHoleMax = { value: new THREE.Vector3(b.x1 + 0.03, b.top + 0.4, b.z1 + 0.03) };
  const inject = (s, palette) => {
    s.uniforms.uHoleMat = uHoleMat; s.uniforms.uHoleMin = uHoleMin; s.uniforms.uHoleMax = uHoleMax;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uHoleMat;\nvarying vec3 vHoleP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHoleP = (uHoleMat * modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uHoleMin;\nuniform vec3 uHoleMax;\nvarying vec3 vHoleP;\n${palette ? SHIP_PALETTE_GLSL : ''}`)
      .replace('void main() {', 'void main() {\n  if (all(greaterThan(vHoleP, uHoleMin)) && all(lessThan(vHoleP, uHoleMax))) discard;');
    if (palette) {
      s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb = hmPalette(diffuseColor.rgb);');
    }
  };
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthMat.onBeforeCompile = (s) => inject(s, false);
  ship.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.customDepthMaterial = depthMat;
    const m = o.material;
    m.envMapIntensity = 1;
    if (m.metalness > 0.5) m.metalness = 0.4; // bo'yalgan po'lat
    m.onBeforeCompile = (s) => inject(s, true);
    m.customProgramCacheKey = () => 'ship-real';
    m.needsUpdate = true;
  });

  // uyachaning ikkinchi yarmida turgan oddiy 20 futlik konteyner
  const st = makeStackTextures();
  const geo = new THREE.BoxGeometry(C.W, C.H, C.L);
  const uv = geo.attributes.uv;
  for (let i = 0; i < 8; i++) uv.setX(i, uv.getX(i) * 0.5);
  for (let i = 8; i < 24; i++) uv.setX(i, uv.getX(i) * 0.2);
  const filler = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: '#8f3a2c', map: st.map, normalMap: st.normalMap, roughnessMap: st.roughnessMap, roughness: 1, metalness: 0.35,
  }));
  filler.position.set((b.x0 + b.x1) / 2, b.top - b.tier + C.H / 2 + 0.015, b.z1 - C.L / 2);
  filler.castShadow = filler.receiveShadow = true;
  holder.add(filler);

  return {
    update() { uHoleMat.value.copy(holder.matrixWorld).invert(); },
  };
}

/** Ko'pik — kema orqasida (Kelvin izi) */
function makeWake() {
  const uniforms = { uTime: { value: 0 }, uSpeed: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      uniform float uTime; uniform float uSpeed;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        // y: 0 — kema dumi, 1 — iz oxiri; x: -1..1 kenglik bo'ylab
        float y = vUv.y;
        float x = (vUv.x - 0.5) * 2.0;
        float ax = abs(x);
        vec2 q = vec2(x * 9.0, y * 60.0 + uTime * 0.35);
        float n = fbm(q);
        float w = 0.05 + 0.16 * pow(y, 0.7);
        float core = (1.0 - smoothstep(w * 0.4, w, ax)) * pow(1.0 - y, 1.6);
        float arm = 0.07 + 0.85 * y;
        float wing = exp(-pow((ax - arm) / (0.012 + 0.03 * y), 2.0)) * pow(1.0 - y, 2.2) * 0.7;
        float a = (core * smoothstep(0.35, 0.75, n + 0.15) + wing * smoothstep(0.3, 0.7, n)) * smoothstep(0.0, 0.015, y);
        gl_FragColor = vec4(vec3(0.92, 0.95, 0.97), a * uSpeed * 0.8);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(130, 420, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = P.waterY + 0.05;
  return { mesh, uniforms };
}

/** Prichal: beton maydon, chet (koping), rezina amortizatorlar, bollardlar, kran relslari, chiziqlar */
function makeQuay(quality) {
  const g = new THREE.Group();
  const ct = makeConcreteTextures({ seed: 33, tone: 158 });
  const slab = 8; // bitta tekstura = 8 m plita
  const QW = 160, QL = 420, QX = P.quayEdgeX - QW / 2, QZ = -70;
  const topTex = (t) => { const c = t.clone(); c.repeat.set(QW / slab, QL / slab); c.needsUpdate = true; return c; };
  const top = new THREE.MeshStandardMaterial({ map: topTex(ct.map), normalMap: topTex(ct.normalMap), roughnessMap: topTex(ct.roughnessMap), roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.8, 0.8) });
  const faceTex = ct.map.clone(); faceTex.repeat.set(QL / slab, 1); faceTex.needsUpdate = true;
  const side = new THREE.MeshStandardMaterial({ color: '#7f8790', map: faceTex, roughness: 0.95 });
  const quay = new THREE.Mesh(new THREE.BoxGeometry(QW, 8, QL), [side, side, top, side, side, side]);
  quay.position.set(QX, -4, QZ);
  quay.receiveShadow = true;
  g.add(quay);
  // suv chizig'idagi yashil-qora dog' (to'lqin izi)
  const algae = new THREE.Mesh(new THREE.PlaneGeometry(QL, 1.6), new THREE.MeshStandardMaterial({ color: '#2b3a33', roughness: 0.9, transparent: true, opacity: 0.85 }));
  algae.rotation.y = Math.PI / 2;
  algae.position.set(P.quayEdgeX + 0.02, P.waterY + 0.5, QZ);
  g.add(algae);

  const B = { conc: bucket(), black: bucket(), navy: bucket(), steel: bucket(), yellow: bucket(), white: bucket() };
  // chet (koping) — oq-sariq bo'yalgan
  B.white.box(0.9, 0.3, QL, P.quayEdgeX - 0.45, 0.15, QZ);
  for (let z = QZ - QL / 2; z < QZ + QL / 2; z += 6) B.yellow.box(0.92, 0.31, 3, P.quayEdgeX - 0.45, 0.15, z);
  // rezina amortizatorlar (konus + panel) va bollardlar
  for (let z = QZ - QL / 2 + 8; z < QZ + QL / 2; z += 16) {
    B.black.cyl(0.85, 1.1, P.quayEdgeX + 0.55, -1.7, z, new THREE.Euler(0, 0, Math.PI / 2), 20);
    B.black.box(0.35, 3.2, 3.6, P.quayEdgeX + 1.25, -1.7, z);
    B.navy.cyl(0.26, 0.55, P.quayEdgeX - 1.6, 0.27, z + 5, null, 14);
    B.navy.cyl(0.36, 0.14, P.quayEdgeX - 1.6, 0.6, z + 5, null, 14);
  }
  // kran relslari
  for (const x of P.craneLegX) {
    B.steel.box(0.16, 0.08, QL, x, 0.04, QZ);
    B.black.box(0.7, 0.012, QL, x, 0.006, QZ);
  }
  // yo'l chiziqlari
  for (const x of [-4.5, 3.5]) B.yellow.box(0.15, 0.01, QL, x, 0.012, QZ);
  for (const x of [-8, 0]) for (let z = QZ - QL / 2; z < QZ + QL / 2; z += 9) B.white.box(0.12, 0.01, 4.5, x, 0.012, z);
  // kran ostidagi xavfli zona shtrixi
  for (let i = -6; i <= 6; i++) B.yellow.box(0.25, 0.01, 2.6, -1 + i * 1.1, 0.013, G.container.z - P.craneHalfGauge - 2, new THREE.Euler(0, 0.6, 0));

  const grime = makeGrimeTexture(17);
  const mats = {
    conc: new THREE.MeshStandardMaterial({ color: '#9aa1a8', map: grime, roughness: 0.9 }),
    black: new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.85 }),
    navy: new THREE.MeshStandardMaterial({ color: '#1b2c42', map: grime, roughness: 0.6, metalness: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: '#7d858e', roughness: 0.35, metalness: 0.8 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#d9ac1f', map: grime, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
    white: new THREE.MeshStandardMaterial({ color: '#e6e8ea', map: grime, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
  for (const [k, b] of Object.entries(B)) { const m = b.mesh(mats[k]); if (m) g.add(m); }

  // ---------- konteyner steklari ----------
  const st = makeStackTextures();
  const boxGeo = new THREE.BoxGeometry(C.W, C.H, C.L * 2 + 0.1); // 40 fut
  // uchlari va tomida qovurg'alar siyrakroq bo'lsin (UV qisqartiriladi)
  const uv = boxGeo.attributes.uv;
  for (let i = 8; i < 24; i++) uv.setX(i, uv.getX(i) * 0.2);
  const stackMat = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughnessMap: st.roughnessMap, roughness: 1, metalness: 0.35 });
  const count = 1500;
  const stacks = new THREE.InstancedMesh(boxGeo, stackMat, count);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  const r = rand(7);
  let n = 0;
  for (let row = 0; row < 14 && n < count; row++) {
    for (let bay = -21; bay < 10 && n < count; bay++) {
      const x = -24 - row * 3.1 - Math.floor(row / 2) * 2.5;
      const z = bay * 12.6;
      if (Math.abs(z - G.container.z) < 22 && row < 4) continue; // kran ostida bo'sh
      const h = 1 + Math.floor(r() * 4.4);
      for (let k = 0; k < h && n < count; k++) {
        m.makeTranslation(x + (r() - 0.5) * 0.08, C.H / 2 + k * C.H, z + (r() - 0.5) * 0.25);
        stacks.setMatrixAt(n, m);
        col.set(STACK_COLORS[Math.floor(r() * STACK_COLORS.length)]).multiplyScalar(0.85 + r() * 0.2);
        stacks.setColorAt(n, col);
        n++;
      }
    }
  }
  stacks.count = n;
  stacks.castShadow = quality.shadows;
  stacks.receiveShadow = true;
  g.add(stacks);

  // ---------- RTG kranlari (steklar ustida) ----------
  const R = { white: bucket(), yellow: bucket(), black: bucket(), steel: bucket() };
  for (const [x0, z0] of [[-31, -60], [-55, 40], [-42, -150]]) {
    const span = 23.5, hgt = 19, depth = 7;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      R.white.box(0.9, hgt, 0.9, x0 + sx * span / 2, hgt / 2 + 1.2, z0 + sz * depth / 2);
      R.black.cyl(0.65, 0.5, x0 + sx * span / 2, 0.65, z0 + sz * depth / 2, new THREE.Euler(0, 0, Math.PI / 2), 18);
    }
    for (const sz of [-1, 1]) R.white.box(span + 1.2, 1.5, 1.1, x0, hgt + 1.2, z0 + sz * depth / 2);
    for (const sx of [-1, 1]) R.white.box(1.2, 1.0, depth + 1, x0 + sx * span / 2, 3.2, z0);
    R.yellow.box(4, 1.8, depth + 0.6, x0 + 3, hgt + 2.6, z0);
    R.steel.box(1.6, 1.6, 2, x0 + span / 2 - 1, hgt - 1.5, z0 + depth / 2 + 0.8);
  }
  const rmats = {
    white: new THREE.MeshStandardMaterial({ color: '#e8eaec', map: grime, roughness: 0.55, metalness: 0.2 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#dcae22', map: grime, roughness: 0.55 }),
    black: mats.black, steel: mats.steel,
  };
  for (const [k, b] of Object.entries(R)) { const mm = b.mesh(rmats[k]); if (mm) g.add(mm); }

  // ---------- baland chiroq ustunlari ----------
  const L = bucket();
  for (const [x, z] of [[-20, 30], [-20, -70], [-20, -170], [-68, -20], [-68, -120], [-4, 70]]) {
    L.box(0.7, 34, 0.7, x, 17, z);
    L.box(4.2, 0.4, 4.2, x, 34.2, z);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      L.box(1.1, 0.7, 0.3, x + Math.cos(a) * 1.7, 33.6, z + Math.sin(a) * 1.7, new THREE.Euler(0.4, a, 0));
    }
  }
  g.add(L.mesh(mats.steel));

  return g;
}

export function createPort({ quality }) {
  const group = new THREE.Group();
  group.name = 'port';

  const sky = createSky({ sunDir: P.sunDir, clouds: 0.4, gain: 1.0, ground: '#1d3550' });
  group.add(sky.mesh);

  const ocean = createOcean({ sunDir: P.sunDir, y: P.waterY, reflectRes: quality.mobile ? 256 : 512 });
  group.add(ocean.mesh);
  const wake = makeWake();
  group.add(wake.mesh);

  group.add(makeQuay(quality));
  const crane = createCrane({ zc: G.container.z, legX: P.craneLegX, half: P.craneHalfGauge, boomY: P.boomY });
  if (!quality.shadows) crane.group.traverse((o) => { o.castShadow = false; });
  group.add(crane.group);

  // quyosh (soya beradi) — soya kamerasi har kadrda harakat markaziga suriladi
  const sun = new THREE.DirectionalLight('#ffe7c8', 3.4);
  sun.castShadow = quality.shadows;
  if (quality.shadows) {
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 420;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
    sun.shadow.radius = 2.5;
  }
  group.add(sun, sun.target);
  group.add(new THREE.HemisphereLight('#bcd2ec', '#4b5561', 0.55));

  const shipHolder = new THREE.Group();
  shipHolder.position.set(P.shipX, P.waterY - P.shipDraftY * P.shipScale.y, P.shipZ);
  group.add(shipHolder);
  let shipPrep = null;

  return {
    group, sky, ocean, wake, crane, shipHolder, sun,
    /** yuklangan kema modelini joyiga qo'yadi (burni +Z tomonga) */
    setShip(ship) {
      ship.rotation.y = Math.PI;
      shipPrep = prepareShip(ship, shipHolder);
      shipHolder.add(ship);
    },
    /** focus — soya kamerasining markazi (konteyner / kema) */
    update(time, camera, focus) {
      ocean.update(time);
      wake.uniforms.uTime.value = time;
      ocean.mesh.position.x = Math.round(camera.position.x / 50) * 50;
      ocean.mesh.position.z = Math.round(camera.position.z / 50) * 50;
      sky.update(time, camera);
      if (shipPrep) { shipHolder.updateMatrixWorld(); shipPrep.update(); }
      if (focus) {
        // soya kamerasi tekstura piksellariga "yopishtiriladi" — harakatda soyalar miltillamaydi
        const texel = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
        const u = Math.round(focus.dot(SUN_X) / texel) * texel;
        const v = Math.round(focus.dot(SUN_Y) / texel) * texel;
        const w = focus.dot(P.sunDir);
        sun.target.position.set(0, 0, 0).addScaledVector(SUN_X, u).addScaledVector(SUN_Y, v).addScaledVector(P.sunDir, w);
        sun.position.copy(sun.target.position).addScaledVector(P.sunDir, 220);
      }
    },
  };
}

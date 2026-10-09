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
  shipDraftY: 7.2,      // model ichidagi suv chizig'i balandligi
  craneLegX: [-12, 10], // quruqlik / suv tomondagi oyoqlar
  craneHalfGauge: 11,
  boomY: 41,
  // quyosh: kema suzib ketadigan tomonda (+z), ufqdan ~11° — "oltin soat" yorug'i
  sunDir: new THREE.Vector3(-0.2, 0.19, 0.96).normalize(),
};

// Haqiqiy konteyner liniyalari ranglariga yaqin (biroz eskirgan), HM navy ko'proq
const STACK_COLORS = [
  '#1D3E69', '#1D3E69', '#1D3E69', '#3d7aa6', '#c4ac74', '#2f6a4b', '#22407e', '#bf6130',
  '#8a3038', '#9ea4aa', '#d6d6d1', '#6a4a3b', '#a8372d', '#6e3266', '#2b5d8a', '#d9d4c7',
];

/** Kema materiallari: haqiqiy ranglar (biroz so'ndirilgan — o'yinchoq ko'rinmasin), soyalar */
export function prepareShip(ship) {
  ship.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const m = o.material;
    m.envMapIntensity = 1;
    if (m.metalness > 0.5) m.metalness = 0.4; // bo'yalgan po'lat
    m.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float hmL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(vec3(hmL), diffuseColor.rgb, 0.5) * 0.84;`);
    };
    m.customProgramCacheKey = () => 'ship-real';
    m.needsUpdate = true;
  });
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

  const sky = createSky({ sunDir: P.sunDir, turbidity: 2.4, rayleigh: 2.3, mie: 0.003, mieG: 0.82, clouds: 0.3, gain: 2.1 });
  sky.groundColor = '#3b4a58';
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
  shipHolder.position.set(P.shipX, P.waterY - P.shipDraftY, P.shipZ);
  group.add(shipHolder);

  return {
    group, sky, ocean, wake, crane, shipHolder, sun,
    /** focus — soya kamerasining markazi (konteyner / kema) */
    update(time, camera, focus) {
      ocean.update(time);
      wake.uniforms.uTime.value = time;
      ocean.mesh.position.x = Math.round(camera.position.x / 50) * 50;
      ocean.mesh.position.z = Math.round(camera.position.z / 50) * 50;
      sky.update(time, camera);
      if (focus) {
        sun.target.position.copy(focus);
        sun.position.copy(focus).addScaledVector(P.sunDir, 220);
      }
    },
  };
}

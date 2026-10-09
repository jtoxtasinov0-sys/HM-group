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
    // panjaralar (ingichka to'r): oppoq rang qora korpus ustida har kichik siljishda "jimirlardi" —
    // haqiqiy kemadagidek kulrang bo'yalgan po'lat, kontrasti past
    if (m.name === 'acmat_36') m.color.set('#848b92');
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

/**
 * Kema orqasidagi iz: vint aralashtirgan och-firuza suv va siyrak ko'pik. Sekin yurayotgan yuk kemasida
 * yorqin oq "Kelvin chiziqlari" bo'lmaydi — faqat yumshoq, kengayib so'nuvchi iz.
 *  - Ko'pik dunyo koordinatasida: kema ketadi, ko'pik suvda qoladi (kema bilan birga sirpanmaydi).
 *  - Shovqin oktavalari ekrandagi o'lchamiga qarab so'ndiriladi (fwidth): uzoqda mayda naqsh miltillamaydi.
 *  - pow() manfiy son bilan chaqirilmaydi — ayrim GPU'larda NaN beradi va kadr buziladi.
 */
const WAKE_LEN = 320;
function makeWake() {
  const uniforms = {
    uTime: { value: 0 }, uSpeed: { value: 0 },
    uShipX: { value: 0 }, uSternZ: { value: 0 }, uStartZ: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vW;
      uniform float uTime, uSpeed, uShipX, uSternZ, uStartZ;
      float hash(vec2 p) { vec3 q = fract(p.xyx * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      // ekranda pikseldan mayda bo'lib qolgan oktavalar o'rtacha qiymatga (0.5) so'nadi
      float fbmAA(vec2 p) {
        float fw = max(length(fwidth(p)), 1e-4);
        float s = 0.0, a = 0.5, f = 1.0, norm = 0.0;
        for (int i = 0; i < 4; i++) {
          float k = 1.0 - smoothstep(0.25, 0.6, fw * f);
          s += a * mix(0.5, vnoise(p * f + float(i) * 17.3), k);
          norm += a; a *= 0.5; f *= 2.07;
        }
        return s / norm;
      }
      void main() {
        float behind = uSternZ - vW.z;                 // kema dumidan necha metr orqada
        float travelled = max(uSternZ - uStartZ, 0.0); // kema shu paytgacha bosib o'tgan yo'l
        float x = vW.x - uShipX;
        float halfW = 5.0 + max(behind, 0.0) * 0.085;  // iz sekin kengayadi
        float across = x / halfW;
        float core = exp(-across * across * 2.0);
        float age = exp(-max(behind, 0.0) / 120.0);
        float fade = smoothstep(0.0, 8.0, behind) * smoothstep(0.0, 30.0, travelled - behind);
        float n = fbmAA(vW.xz * 0.085 + vec2(0.0, uTime * 0.04));
        float foam = smoothstep(0.52, 0.8, n + 0.22 * core * age);
        vec3 churn = vec3(0.30, 0.45, 0.48);            // havo pufakli och-firuza suv
        vec3 froth = vec3(0.78, 0.83, 0.85);            // ko'pik (tone mappingdan oldin — o'rtacha yorqin)
        vec3 col = mix(churn, froth, foam * age);
        float a = core * age * fade * (0.3 + 0.45 * foam);
        gl_FragColor = vec4(col, clamp(a * uSpeed, 0.0, 0.6));
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(90, WAKE_LEN, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = P.waterY + 0.05;
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  mesh.visible = false;
  return {
    mesh,
    uniforms,
    /** x — kema o'qi, sternZ — kema dumi (hozir), startZ — dumning prichaldagi joyi, speed — 0..1 */
    update(x, sternZ, startZ, speed) {
      mesh.position.set(x, P.waterY + 0.05, sternZ - WAKE_LEN / 2);
      uniforms.uShipX.value = x;
      uniforms.uSternZ.value = sternZ;
      uniforms.uStartZ.value = startZ;
      uniforms.uSpeed.value = speed;
      mesh.visible = speed > 0.001 && sternZ - startZ > 0.5;
    },
  };
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

  // aks teksturasi ekran nisbatida (kvadrat 512 kenglikda 3 baravar siqardi — ingichka ustunlar akslari jimirlardi)
  const rw = Math.round(Math.min(1024, Math.max(384, innerWidth * (quality.mobile ? 0.4 : 0.55))));
  const rh = Math.round(rw * Math.min(1.6, Math.max(0.45, innerHeight / innerWidth)));
  const ocean = createOcean({ sunDir: P.sunDir, y: P.waterY, reflectW: rw, reflectH: rh });
  group.add(ocean.mesh);
  const wake = makeWake();
  group.add(wake.mesh);
  // suvdagi aks: quyosh diski (dumaloq "chiroq" bo'lib ko'rinardi) va izning o'zi aks ettirilmaydi —
  // quyosh yo'lakchasini suv shaderining o'zi to'lqinlar bo'yicha chizadi
  const waterBefore = ocean.mesh.onBeforeRender;
  ocean.mesh.onBeforeRender = function (...args) {
    const wakeVis = wake.mesh.visible;
    wake.mesh.visible = false;
    sky.uniforms.uSunScale.value = 0;
    waterBefore.apply(this, args);
    sky.uniforms.uSunScale.value = 1;
    wake.mesh.visible = wakeVis;
  };

  group.add(makeQuay(quality));
  const crane = createCrane({ zc: G.container.z, legX: P.craneLegX, half: P.craneHalfGauge, boomY: P.boomY });
  if (!quality.shadows) crane.group.traverse((o) => { o.castShadow = false; });
  group.add(crane.group);

  // quyosh (soya beradi) — soya kamerasi harakat markaziga suriladi (piksellarga yopishtirilgan).
  // Kema quyosh tomon suzadi: yo'nalishi deyarli nur bo'ylab, shuning uchun suzish paytida soya kamerasi
  // joyida qoladi (±70 m kema oxirigacha sig'adi) — prichal va kran soyalari "o'chib-yonmaydi"
  const sun = new THREE.DirectionalLight('#ffe7c8', 3.4);
  sun.castShadow = quality.shadows;
  if (quality.shadows) {
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 460;
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

  const api = {
    group, sky, ocean, wake, crane, shipHolder, sun,
    sternZ: -67, // kema dumi (holder koordinatasida) — model yuklangach aniqlanadi
    /** yuklangan kema modelini joyiga qo'yadi (burni +Z tomonga) */
    setShip(ship) {
      ship.rotation.y = Math.PI;
      shipPrep = prepareShip(ship, shipHolder);
      shipHolder.add(ship);
      shipHolder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(ship);
      api.sternZ = box.min.z - shipHolder.position.z;
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
        sun.position.copy(sun.target.position).addScaledVector(P.sunDir, 260);
      }
    },
  };
  return api;
}

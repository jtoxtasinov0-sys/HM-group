import * as THREE from 'three';
import { SKY_GLSL, makeSkyMaterial } from './env.js';
import { makeGroundTexture } from './textures.js';
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
};

const BRAND_STACK = ['#1D3E69', '#16335D', '#EEF2F8', '#d5deea', '#8ea3bc', '#2c5288', '#f7f9fc'];

/** Kema materiallarini brend duotoniga o'tkazish: navy → oq */
export function duotoneMaterial(mat, dark = '#183a66', light = '#f3f6fa') {
  const uDark = { value: new THREE.Color(dark) };
  const uLight = { value: new THREE.Color(light) };
  mat.onBeforeCompile = (s) => {
    s.uniforms.uDark = uDark;
    s.uniforms.uLight = uLight;
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uDark;\nuniform vec3 uLight;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float hmL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(uDark, uLight, smoothstep(0.03, 0.62, hmL));`);
  };
  mat.customProgramCacheKey = () => 'duotone';
  mat.needsUpdate = true;
}

function makeOcean(skyUniforms) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#0b2c52') },
      uShallow: { value: new THREE.Color('#1f5d8f') },
    },
  ]);
  // osmon uniformlarini umumiy ob'ekt orqali ulaymiz (ranglar sinxron bo'lsin)
  for (const k of ['uZenith', 'uHorizon', 'uGround', 'uSunDir', 'uSunColor']) uniforms[k] = skyUniforms[k];

  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      varying vec3 vWorld;
      ${SKY_GLSL}

      // yo'naltirilgan to'lqinlar yig'indisi — qiyalik (gradient) qaytaradi
      // fade: uzoqda yuqori chastotalar o'chadi (aliasing bo'lmasin)
      vec2 waves(vec2 p, float t, float dist) {
        vec2 g = vec2(0.0);
        float k = 0.045;
        float a = 0.32;
        float ang = 0.35;
        for (int i = 0; i < 11; i++) {
          vec2 d = vec2(cos(ang), sin(ang));
          float ph = dot(d, p) * k + t * sqrt(9.8 * k) + float(i) * 1.7;
          float lambda = 6.2831 / k;
          float fade = 1.0 - smoothstep(lambda * 18.0, lambda * 60.0, dist);
          g += d * k * a * cos(ph) * fade;
          k *= 1.47;
          a *= 0.62;
          ang += 2.39996; // oltin burchak — yo'nalishlar tarqoq
        }
        return g;
      }
      void main() {
        vec2 p = vWorld.xz;
        float dist = length(cameraPosition - vWorld);
        vec2 g = waves(p, uTime, dist) * 1.6;
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

        vec3 V = normalize(cameraPosition - vWorld);
        vec3 R = reflect(-V, N);
        R.y = abs(R.y);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 sky = skyColor(R);
        // to'lqin cho'qqilarida biroz yorqinroq (subsurface)
        float crest = clamp(0.5 + (g.x + g.y) * 2.5, 0.0, 1.0);
        vec3 water = mix(uDeep, uShallow, crest * 0.5);
        vec3 col = mix(water, sky, fres);
        // quyosh yaltirashi
        vec3 H = normalize(normalize(uSunDir) + V);
        float spec = pow(max(dot(N, H), 0.0), 260.0) * 5.0 + pow(max(dot(N, H), 0.0), 40.0) * 0.12;
        col += uSunColor * spec;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = P.waterY;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

/** Ko'pik — kema atrofida va orqasida */
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
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        // y: 0 — kema dumi, 1 — iz oxiri; x: -1..1 kenglik bo'ylab
        float y = vUv.y;
        float x = (vUv.x - 0.5) * 2.0;
        float ax = abs(x);
        vec2 q = vec2(x * 9.0, y * 60.0 + uTime * 0.35);
        float n = fbm(q);
        // markaziy ko'pik yo'li
        float w = 0.05 + 0.16 * pow(y, 0.7);
        float core = (1.0 - smoothstep(w * 0.4, w, ax)) * pow(1.0 - y, 1.6);
        // Kelvin "V" qanotlari
        float arm = 0.07 + 0.85 * y;
        float wing = exp(-pow((ax - arm) / (0.012 + 0.03 * y), 2.0)) * pow(1.0 - y, 2.2) * 0.7;
        float a = (core * smoothstep(0.35, 0.75, n + 0.15) + wing * smoothstep(0.3, 0.7, n)) * smoothstep(0.0, 0.015, y);
        gl_FragColor = vec4(vec3(0.96, 0.98, 1.0), a * uSpeed * 0.85);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(130, 420, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = P.waterY + 0.05;
  return { mesh, uniforms };
}

function makeCrane() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#eef2f8', roughness: 0.5, metalness: 0.35 });
  const navy = new THREE.MeshStandardMaterial({ color: '#1D3E69', roughness: 0.5, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#273445', roughness: 0.6, metalness: 0.5 });
  const box = (w, h, d, x, y, z, m = white) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  const zc = G.container.z;
  const [lx, wx] = P.craneLegX;
  const legH = 36;
  for (const x of [lx, wx]) for (const s of [-1, 1]) {
    box(1.3, legH, 1.3, x, legH / 2, zc + s * P.craneHalfGauge);
    box(1.8, 1.4, 3.2, x, 0.7, zc + s * P.craneHalfGauge, navy); // g'ildirak aravasi
  }
  for (const x of [lx, wx]) {
    box(1.4, 1.6, P.craneHalfGauge * 2 + 1.3, x, legH, zc, navy);   // portal to'sin
    box(1.0, 1.0, P.craneHalfGauge * 2, x, 12, zc);                 // pastki to'sin
  }
  for (const s of [-1, 1]) {
    box(wx - lx, 1.4, 1.4, (lx + wx) / 2, legH, zc + s * P.craneHalfGauge, navy);
    // diagonal bog'lovchilar
    const diag = box(0.5, Math.hypot(wx - lx, legH - 12), 0.5, (lx + wx) / 2, (legH + 12) / 2, zc + s * P.craneHalfGauge, white);
    diag.rotation.z = Math.atan2(wx - lx, legH - 12);
  }
  // strela (boom) — ikki parallel to'sin
  const boomFrom = -34, boomTo = 62;
  for (const s of [-1, 1]) box(boomTo - boomFrom, 2.2, 1.0, (boomFrom + boomTo) / 2, P.boomY, zc + s * 2.4);
  for (let x = boomFrom + 3; x < boomTo; x += 6) box(0.4, 0.4, 4.8, x, P.boomY - 1.0, zc, dark);
  // mashina xonasi
  box(9, 4, 6.5, boomFrom + 7, P.boomY + 3, zc, white);
  box(9.2, 0.6, 6.7, boomFrom + 7, P.boomY + 5.2, zc, navy);
  // A-ramka va tortqilar
  const apexX = (lx + wx) / 2, apexY = P.boomY + 18;
  for (const s of [-1, 1]) {
    for (const x of [lx + 2, wx - 2]) {
      const len = Math.hypot(apexX - x, apexY - P.boomY);
      const leg = box(0.9, len, 0.9, (apexX + x) / 2, (apexY + P.boomY) / 2, zc + s * 2.4);
      leg.rotation.z = -Math.atan2(apexX - x, apexY - P.boomY);
    }
    for (const tx of [boomTo - 2, boomTo - 26, boomFrom + 2]) {
      const len = Math.hypot(tx - apexX, apexY - P.boomY);
      const tie = box(0.18, len, 0.18, (apexX + tx) / 2, (apexY + P.boomY) / 2, zc + s * 2.4, dark);
      tie.rotation.z = Math.atan2(apexX - tx, apexY - P.boomY);
    }
  }
  box(1.6, 1.0, 6.2, apexX, apexY, zc, navy);
  // kabina
  const cab = box(2.4, 2.4, 2.4, 0, P.boomY - 2.6, zc - 3.5, white);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.46, 1.2, 2.46), new THREE.MeshStandardMaterial({ color: '#0f2440', roughness: 0.1, metalness: 0.8 }));
  glass.position.set(0, 0.2, 0); cab.add(glass);
  // trolley
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.6, 5.4), navy);
  trolley.position.set(0, P.boomY - 1.6, zc);
  g.add(trolley);
  // ogohlantirish chiroqlari
  const redMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(4) });
  for (const x of [boomTo - 0.5, apexX]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), redMat);
    l.position.set(x, x === apexX ? apexY + 0.8 : P.boomY + 1.4, zc);
    g.add(l);
  }
  return { group: g, trolley, cab };
}

function makeQuay() {
  const g = new THREE.Group();
  const tex = makeGroundTexture();
  tex.repeat.set(30, 120);
  const top = new THREE.MeshStandardMaterial({ color: '#c3cedb', map: tex, roughness: 0.9 });
  const side = new THREE.MeshStandardMaterial({ color: '#5d6f86', roughness: 0.85 });
  const quay = new THREE.Mesh(new THREE.BoxGeometry(160, 8, 420), [side, side, top, side, side, side]);
  quay.position.set(P.quayEdgeX - 80, -4, -70);
  g.add(quay);
  // chet chizig'i
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 420), new THREE.MeshStandardMaterial({ color: '#f4f7fb', roughness: 0.6 }));
  edge.position.set(P.quayEdgeX - 1.2, 0.03, -70);
  g.add(edge);
  // bollardlar
  const bMat = new THREE.MeshStandardMaterial({ color: '#1D3E69', roughness: 0.5, metalness: 0.5 });
  const bollard = new THREE.CylinderGeometry(0.28, 0.35, 0.8, 12);
  const inst = new THREE.InstancedMesh(bollard, bMat, 28);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 28; i++) { m.makeTranslation(P.quayEdgeX - 0.8, 0.4, -275 + i * 15); inst.setMatrixAt(i, m); }
  g.add(inst);

  // konteyner steklari (brend ranglarida)
  const ribCanvas = document.createElement('canvas');
  ribCanvas.width = 256; ribCanvas.height = 64;
  const ctx = ribCanvas.getContext('2d');
  for (let x = 0; x < 256; x += 8) {
    const gr = ctx.createLinearGradient(x, 0, x + 8, 0);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#d9dde3'); gr.addColorStop(1, '#ffffff');
    ctx.fillStyle = gr; ctx.fillRect(x, 0, 8, 64);
  }
  const ribTex = new THREE.CanvasTexture(ribCanvas);
  ribTex.colorSpace = THREE.SRGBColorSpace;
  const boxGeo = new THREE.BoxGeometry(C.W, C.H, C.L * 2 + 0.1); // 40ft
  const stackMat = new THREE.MeshStandardMaterial({ map: ribTex, roughness: 0.55, metalness: 0.3 });
  const count = 1400;
  const stacks = new THREE.InstancedMesh(boxGeo, stackMat, count);
  const col = new THREE.Color();
  let n = 0;
  const rand = mulberry(7);
  for (let row = 0; row < 14 && n < count; row++) {
    for (let bay = -21; bay < 10 && n < count; bay++) {
      const x = -24 - row * 3.1 - Math.floor(row / 2) * 2.5;
      const z = bay * 12.6;
      if (Math.abs(z - G.container.z) < 22 && row < 4) continue; // kran ostida bo'sh
      const h = 1 + Math.floor(rand() * 4);
      for (let k = 0; k < h && n < count; k++) {
        m.makeTranslation(x, C.H / 2 + k * C.H, z);
        stacks.setMatrixAt(n, m);
        stacks.setColorAt(n, col.set(BRAND_STACK[Math.floor(rand() * BRAND_STACK.length)]));
        n++;
      }
    }
  }
  stacks.count = n;
  g.add(stacks);
  return g;
}

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function createPort({ skyUniforms }) {
  const group = new THREE.Group();
  group.name = 'port';

  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), makeSkyMaterial(skyUniforms));
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  group.add(sky);

  const ocean = makeOcean(skyUniforms);
  group.add(ocean.mesh);
  const wake = makeWake();
  group.add(wake.mesh);

  group.add(makeQuay());
  const crane = makeCrane();
  group.add(crane.group);

  const sun = new THREE.DirectionalLight('#fff8ee', 2.6);
  sun.position.copy(skyUniforms.uSunDir.value).multiplyScalar(200);
  group.add(sun);
  group.add(new THREE.HemisphereLight('#cfe0f5', '#20344f', 1.1));

  const shipHolder = new THREE.Group();
  shipHolder.position.set(P.shipX, P.waterY - P.shipDraftY, P.shipZ);
  group.add(shipHolder);

  return {
    group, sky, ocean, wake, crane, shipHolder,
    update(time, camera) {
      ocean.uniforms.uTime.value = time;
      wake.uniforms.uTime.value = time;
      ocean.mesh.position.x = Math.round(camera.position.x / 50) * 50;
      ocean.mesh.position.z = Math.round(camera.position.z / 50) * 50;
      sky.position.copy(camera.position);
    },
  };
}

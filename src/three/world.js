import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

import { createSkyEnvMap } from './sky.js';
import { createGarage, G } from './garage.js';
import { createContainer, createSpreader } from './container.js';
import { createPort } from './port.js';
import { prepareCarMaterials, setCarDim } from './materials.js';
import { makeShadowTexture, makeOutlineTextTexture } from './textures.js';
import { createStory, GARAGE_FOG, FOG_NEAR, FOG_FAR, PORT_HAZE } from './story.js';
import { rigWheels } from './wheels.js';

const FS_VERT = /* glsl */`
  precision highp float;
  uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
  attribute vec3 position; attribute vec2 uv;
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/**
 * Yakuniy kadr: tone mapping (ACES) + sRGB + vinyetka.
 * NaN/Inf piksellar qora qilinadi — bitta "buzilgan" piksel butun kadrni oqartirib/qoraytirib yubormasin.
 * Harakatlanuvchi "kino donasi" yo'q: har kadrda o'zgaradigan shovqin ekranni miltillatadi.
 * O'rniga ko'zga ko'rinmas, joyida turuvchi dither (gradientlarda pog'ona bo'lmasin).
 */
const FinalShader = {
  uniforms: { tDiffuse: { value: null }, toneMappingExposure: { value: 1 }, uVignette: { value: 0.55 } },
  // GLSL3: isnan/isinf faqat shu versiyada bor
  vertexShader: /* glsl */`
    precision highp float;
    uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
    in vec3 position; in vec2 uv;
    out vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    #include <tonemapping_pars_fragment>
    #include <colorspace_pars_fragment>
    in vec2 vUv;
    out vec4 fragColor;
    void main() {
      vec3 c = texture(tDiffuse, vUv).rgb;
      if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
      c = ACESFilmicToneMapping(max(c, vec3(0.0)));
      c = sRGBTransferOETF(vec4(c, 1.0)).rgb;
      vec2 d = (vUv - 0.5) * vec2(1.0, 0.85);
      c *= mix(1.0, smoothstep(0.95, 0.28, length(d)), uVignette);
      c += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
      fragColor = vec4(c, 1.0);
    }`,
};

/** Ikki dunyo orasidagi o'tish: ikkinchi kadr ustidan shaffoflik bilan chiziladi */
const BlendShader = {
  uniforms: { tDiffuse: { value: null }, uOpacity: { value: 1 } },
  vertexShader: FS_VERT,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse; uniform float uOpacity; varying vec2 vUv;
    void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, uOpacity); }`,
};

/**
 * Bloom uchun yorqin joylarni ajratish (three.js high-pass o'rniga):
 *  - NaN/Inf → 0 (aks holda blur ularni butun ekranga yoyadi — kadr oqarib ketadi);
 *  - 4 nuqtali "Karis" o'rtachasi va yorqinlik chegarasi: bitta pikseldagi yaltirash (quyosh
 *    chaqnashi, ingichka metall qirra) harakatda katta miltillovchi dog'ga aylanmaydi.
 */
const HIGHPASS_FRAG = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform vec3 defaultColor;
  uniform float defaultOpacity;
  uniform float luminosityThreshold;
  uniform float smoothWidth;
  uniform vec2 uTexel;
  varying vec2 vUv;
  float hmLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  vec3 hmSafe(vec3 c) {
    if (any(isnan(c)) || any(isinf(c))) return vec3(0.0);
    c = max(c, vec3(0.0));
    float m = max(c.r, max(c.g, c.b));
    return m > 20.0 ? c * (20.0 / m) : c;
  }
  void main() {
    vec3 a = hmSafe(texture2D(tDiffuse, vUv + uTexel * vec2(-0.75, -0.75)).rgb);
    vec3 b = hmSafe(texture2D(tDiffuse, vUv + uTexel * vec2( 0.75, -0.75)).rgb);
    vec3 c = hmSafe(texture2D(tDiffuse, vUv + uTexel * vec2(-0.75,  0.75)).rgb);
    vec3 d = hmSafe(texture2D(tDiffuse, vUv + uTexel * vec2( 0.75,  0.75)).rgb);
    float wa = 1.0 / (1.0 + hmLum(a)), wb = 1.0 / (1.0 + hmLum(b));
    float wc = 1.0 / (1.0 + hmLum(c)), wd = 1.0 / (1.0 + hmLum(d));
    vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
    float alpha = smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, hmLum(col));
    gl_FragColor = mix(vec4(defaultColor, defaultOpacity), vec4(col, 1.0), alpha);
  }`;

const PIXEL_BUDGET = 3.6e6; // ~2560x1400: undan katta kadr GPU xotirasini to'ldirib, kontekstni yo'qotishi mumkin

export function detectQuality() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(innerWidth, innerHeight) < 600;
  const mobile = coarse || small;
  let dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  dpr = Math.min(dpr, Math.sqrt(PIXEL_BUDGET / Math.max(1, innerWidth * innerHeight)));
  return {
    mobile,
    dpr: Math.max(0.75, dpr),
    reflections: !mobile,
    reflectionRes: 0.5,
    // yuqori DPR ekranda piksellar mayda — 2x MSAA yetarli (xotira 2 baravar kam)
    msaa: mobile ? 0 : dpr > 1.25 ? 2 : 4,
    shadows: !mobile,
    bloom: true,
  };
}

/** Modelning mustaqil nusxasi: tugunlar va materiallar alohida (geometriya umumiy) — boshqa rangga bo'yash uchun */
function cloneCar(src) {
  const model = src.clone(true);
  const mats = new Map();
  const dup = (m) => { if (!mats.has(m)) mats.set(m, m.clone()); return mats.get(m); };
  model.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(dup) : dup(o.material); });
  return model;
}

/**
 * Brauzer bo'sh turgan paytni kutadi (kadrlar orasida). Og'ir ishlar (model tayyorlash, shader, tekstura)
 * shu paytlarga bo'lib qo'yiladi — skroll va animatsiya qotmaydi. Qaytaradi: { timeRemaining() }.
 */
const idle = (timeout = 300) => new Promise((resolve) => {
  if (window.requestIdleCallback) requestIdleCallback(resolve, { timeout });
  else setTimeout(() => { const t = performance.now(); resolve({ timeRemaining: () => Math.max(0, 8 - (performance.now() - t)) }); }, 16);
});

let meshoptWorkers = false;

export class World {
  constructor(canvas, { cars, start = 0, manifest, quality, onProgress }) {
    this.canvas = canvas;
    this.cars = cars; // garajdagi mashinalar, joylar tartibida (G.slots)
    this.manifest = manifest;
    this.quality = quality;
    this.onProgress = onProgress;
    this.p = 0;
    this.targetP = 0;
    this.selected = start;
    this.hovered = -1;
    this.pointer = new THREE.Vector2(9, 9);
    this.mouse = new THREE.Vector2(0, 0);      // parallaks uchun (-1..1)
    this.mouseSmooth = new THREE.Vector2(0, 0);
    this.focus = start;                          // mobil: kamera qaysi mashinaga qarayapti
    this.focusSmooth = start;
    this.active = true;
    this.listeners = { frame: new Set(), select: new Set(), hover: new Set(), choose: new Set() };
    this.clock = new THREE.Clock();
    // hero kamerasi (desktop)
    // mDist/mY/mShift — telefonda (portret): kamera masofasi ko'paytiruvchisi, balandligi, kadr siljishi
    this.heroTune = { fov: 34, fit: 15.5, y: 2.0, ty: 1.55, shift: 0.36, pan: 5, mDist: 1.7, mY: 3.5, mShift: 0.35 };
    this.time = 0;
    // 0 — garaj/hovli, 1 — port; oraliqda ikkala dunyo chiziladi va asta almashadi
    this.blend = 0;
    this.spreaderOn = false;
    this.perf = { ema: 1 / 60, slowFor: 0, warm: 0, last: 0, step: 0 };
    this.uploaded = new WeakSet(); // GPU'ga oldindan yuklangan teksturalar
    this.work = Promise.resolve(); // fondagi og'ir ishlar navbati (bittadan bajariladi)
    this.mounted = 0;
    this.shadowSig = NaN;
    this.outlineDirty = true;
  }

  on(type, fn) { this.listeners[type].add(fn); return () => this.listeners[type].delete(fn); }
  emit(type, ...args) { this.listeners[type].forEach((fn) => fn(...args)); }

  async init() {
    const { quality } = this;
    // modellar darhol so'raladi: sahna qurilayotganda (protsessor ishi) tarmoqdan yuklash ham ketaveradi
    this.startLoading();
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.setPixelRatio(quality.dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // yakuniy kadrda qo'llanadi (FinalShader)
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = quality.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 3000);
    camera.position.set(0, 3.7, 21);
    this.camera = camera;

    // dunyolar
    this.garage = createGarage({ quality });
    scene.add(this.garage.group);
    this.port = createPort({ quality });
    this.skyUniforms = this.port.sky.uniforms;
    this.port.group.visible = false;
    scene.add(this.port.group);

    // har bir dunyoning o'z havosi (tuman), foni va muhit xaritasi
    this.worlds = {
      garage: { fog: new THREE.Fog(GARAGE_FOG.clone(), FOG_NEAR, FOG_FAR), background: GARAGE_FOG.clone(), env: null },
      port: { fog: new THREE.Fog(PORT_HAZE.clone(), 160, 1600), background: PORT_HAZE.clone(), env: null },
    };
    this.buildEnvMaps();
    this.fleet = new THREE.Group(); // garajdagi mashinalar
    scene.add(this.fleet);

    this.container = createContainer();
    this.container.group.position.copy(G.container);
    scene.add(this.container.group);
    this.spreader = createSpreader();
    this.spreader.group.visible = false;
    scene.add(this.spreader.group);

    // mashina orqasidagi katta nom
    this.outline = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 3.75),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, color: new THREE.Color('#1D3E69'), toneMapped: false }),
    );
    this.outline.position.set(0, 2.55, -3.9);
    this.garage.group.add(this.outline);

    this.setupPost();
    this.setWorld('garage');

    // GPU qayta ishga tushsa (drayver, xotira yetishmasligi) — sahna qayta tiklanadi
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      document.body.classList.add('gl-lost');
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.uploaded = new WeakSet();
      this.buildEnvMaps();
      this.garage.anim.refreshShadows?.();
      this.applyWorldState(this.blend >= 1 ? 'port' : 'garage');
      document.body.classList.remove('gl-lost');
    });

    // yuklash: sayt birinchi ko'rinadigan mashina(lar) bilan ochiladi, qolganlari fonda qo'shiladi
    await this.mountFirst();

    this.story = createStory(this);
    this.raycaster = new THREE.Raycaster();
    this.bindEvents();
    this.resize();
    this.selectCar(this.selected, true);
    // garaj shaderlari sayt ochilishidan oldin tayyorlanadi — birinchi kadrlar qotmaydi
    await this.precompile('garage');
    renderer.setAnimationLoop(() => this.tick());
    this.mountRest();
  }

  /** Fondagi og'ir ishni navbatga qo'yadi: ishlar bir-birining ustiga tushmaydi */
  later(job) {
    this.work = this.work.then(job).catch((e) => console.warn(e));
    return this.work;
  }

  /**
   * Shaderlarni oldindan tayyorlaydi. Faqat shu dunyo (va uning chiroqlari) hisobga olinadi — boshqa dunyo
   * materiallari behuda kompilyatsiya qilinmaydi. Render target o'rnatiladi: unga chizilganda tone mapping va
   * rang fazosi boshqacha, shader kaliti mos kelmasa, birinchi kadrda baribir qaytadan kompilyatsiya bo'lardi.
   */
  precompile(name, object = null) {
    const { renderer, scene, camera } = this;
    const inPort = name === 'port';
    const skip = inPort ? [this.garage.group, this.fleet] : [this.port.group, this.spreader.group];
    const was = this.blend >= 1 ? 'port' : 'garage';
    const target = renderer.getRenderTarget();
    const kids = scene.children;
    this.setWorld(name);
    scene.children = kids.filter((o) => !skip.includes(o)); // faqat bir lahzaga (kompilyatsiya sinxron boshlanadi)
    renderer.setRenderTarget(this.rtScene);
    let ready;
    try {
      ready = object ? renderer.compileAsync(object, camera, scene) : renderer.compileAsync(scene, camera);
    } finally {
      scene.children = kids;
      renderer.setRenderTarget(target);
      this.setWorld(was);
    }
    // kontekst yo'qolsa dastur hech qachon "tayyor" bo'lmaydi — kutish cheklanadi
    return Promise.race([ready, new Promise((r) => setTimeout(r, 8000))]);
  }

  /** Teksturalarni GPU'ga birinchi kadrda emas, bo'sh paytlarda oldindan yuklaydi */
  async uploadTextures(...roots) {
    const list = new Set();
    for (const root of roots) root.traverse((o) => {
      if (!o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const k in m) { const t = m[k]; if (t?.isTexture && !t.isRenderTargetTexture && !this.uploaded.has(t)) list.add(t); }
      }
    });
    let d = null;
    for (const t of list) {
      // har bo'sh paytda kamida bitta tekstura, vaqt qolsa — yana
      if (!d || d.timeRemaining() < 4) d = await idle();
      if (this.contextLost) return;
      this.uploaded.add(t);
      this.renderer.initTexture(t);
      if (d.didTimeout) d = null;
    }
  }

  /** Port dunyosini (kran, kema, okean) oldindan tayyorlash — hikoyaning o'rtasida kadr qotmasin */
  async warmPort() {
    await idle();
    await this.precompile('port');
    await this.uploadTextures(this.port.group, this.container.group, this.spreader.group);
  }

  /** Osmondan PMREM muhit xaritalari (kontekst tiklanganda qayta quriladi) */
  buildEnvMaps() {
    this.envYard?.dispose();
    this.envSky?.dispose();
    // garaj ichi ham hovli osmonidan olingan muhitni aks ettiradi: devorlar ko'kish-kulrang, akslar kontrastli
    this.envYard = createSkyEnvMap(this.renderer, this.garage.anim.yardSky, 0.85);
    this.envSky = createSkyEnvMap(this.renderer, this.port.sky, 0.9);
    this.worlds.garage.env = this.envYard;
    this.worlds.port.env = this.envSky;
  }

  setupPost() {
    const { quality, renderer } = this;
    const w = Math.max(1, Math.round(innerWidth * quality.dpr)), h = Math.max(1, Math.round(innerHeight * quality.dpr));
    this.rtScene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: quality.msaa });
    this.rtAux = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
    this.rtAux.texture.generateMipmaps = false;

    // bloom chorak o'lchamda ishlaydi (arzon); high-pass 4 nuqtasi kadrning 4x4 pikselini qamraydi
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.16, 0.3, 5.5);
    const hp = this.bloom.materialHighPassFilter;
    hp.uniforms.uTexel = { value: new THREE.Vector2(2 / w, 2 / h) };
    hp.fragmentShader = HIGHPASS_FRAG;
    hp.needsUpdate = true;
    this.bloom.enabled = false;

    this.final = new THREE.RawShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(FinalShader.uniforms),
      vertexShader: FinalShader.vertexShader,
      fragmentShader: FinalShader.fragmentShader,
      defines: { ACES_FILMIC_TONE_MAPPING: '', SRGB_TRANSFER: '' },
      glslVersion: THREE.GLSL3,
      depthTest: false, depthWrite: false,
    });
    this.finalQuad = new FullScreenQuad(this.final);
    this.copyMat = new THREE.RawShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(BlendShader.uniforms),
      vertexShader: BlendShader.vertexShader, fragmentShader: BlendShader.fragmentShader,
      depthTest: false, depthWrite: false,
    });
    this.blendMat = this.copyMat.clone();
    this.blendMat.transparent = true;
    this.blendMat.blending = THREE.NormalBlending;
    this.copyQuad = new FullScreenQuad(this.copyMat);
    this.blendQuad = new FullScreenQuad(this.blendMat);
    renderer.autoClear = true;
  }

  /** Qaysi dunyo chiziladi: ko'rinish, tuman, fon va muhit xaritasi */
  setWorld(name) {
    const inPort = name === 'port';
    this.garage.group.visible = !inPort;
    this.fleet.visible = !inPort;
    this.port.group.visible = inPort;
    this.spreader.group.visible = inPort && this.spreaderOn;
    this.applyWorldState(name);
  }

  applyWorldState(name) {
    const s = this.worlds[name];
    this.scene.fog = s.fog;
    this.scene.background = s.background;
    this.scene.environment = s.env;
  }

  /** Model fayllari navbati: bir vaqtda 2 tadan yuklanadi — tarmoq ko'p faylga bo'linmaydi, kerakli mashina tez keladi */
  startLoading() {
    if (!meshoptWorkers) {
      // geometriyani ochish (meshopt) alohida oqimlarda — asosiy oqim bo'sh qoladi
      MeshoptDecoder.useWorkers?.(Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) >> 1)));
      meshoptWorkers = true;
    }
    const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const fetcher = new THREE.FileLoader().setResponseType('arraybuffer');
    const fileOf = (car) => car.file || car.id;
    const urlOf = (f) => {
      const v = this.manifest[f]?.v; // fayl o'zgarsa manzil ham o'zgaradi — brauzer keshidan bemalol olinadi
      return `${import.meta.env.BASE_URL}models/${f}.glb${v ? `?v=${v}` : ''}`;
    };
    const jobs = new Map(); // fayl → { promise, onBytes }
    const queue = [];
    let active = 0;
    const pump = () => {
      while (active < 2 && queue.length) {
        const f = queue.shift();
        const job = jobs.get(f);
        active++;
        fetcher.load(urlOf(f), (buf) => {
          active--;
          pump();
          job.onBytes?.(f, Infinity);
          gltf.parseAsync(buf, '').then(job.resolve, job.reject);
        }, (e) => job.onBytes?.(f, e.loaded), (err) => { active--; pump(); job.reject(err); });
      }
    };

    // tartib: avval birinchi kadrda ko'rinadiganlar (tanlangan mashina, keyin markazdan chetga), kema oxirida
    const narrow = this.quality.mobile || innerWidth / innerHeight < 0.95;
    const rank = (i) => (i === this.selected ? -1 : narrow ? Math.abs(i - this.selected) : Math.abs(G.slots[i].x) + i * 1e-3);
    const order = this.cars.map((car, i) => i).sort((a, b) => rank(a) - rank(b));
    const files = [...new Set(order.map((i) => fileOf(this.cars[i])))];
    for (const f of [...files, 'ship']) {
      const job = {};
      job.promise = new Promise((res, rej) => { job.resolve = res; job.reject = rej; });
      job.promise.catch(() => {});
      jobs.set(f, job);
      queue.push(f);
    }
    pump();

    this.load = {
      fileOf, order, jobs,
      // sayt ochilishi uchun kerakli fayllar: telefonda — tanlangan mashina, kompyuterda — markazdagi ikkitasi
      need: files.slice(0, narrow ? 1 : 2),
      get: (f) => jobs.get(f).promise,
      /** foydalanuvchi qaragan mashina navbatda oldinga o'tadi */
      prioritize: (f) => {
        const k = queue.indexOf(f);
        if (k > 0) { queue.splice(k, 1); queue.unshift(f); }
      },
    };
  }

  /** Joylarni modelsiz quradi va birinchi ko'rinadigan mashinalarni joylaydi (shu bilan sayt ochiladi) */
  async mountFirst() {
    const { fileOf, need, jobs } = this.load;
    const bytesOf = (f) => this.manifest[f]?.bytes || 3e6;

    const shadowTex = makeShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({ alphaMap: shadowTex, color: '#0b0f16', transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });

    // Avval har bir joy modelsiz quriladi (o'lchami manifestdan): soya, sichqoncha qutisi, platforma.
    // Model kelganda ichiga qo'yiladi — garaj markazdagi mashinalar bilan ochiladi, qolganlari keyin qo'shiladi.
    this.entities = this.cars.map((car, i) => {
      const box = this.manifest[fileOf(car)]?.box || { min: [-1, 0, -2.5], max: [1, 1.6, 2.5] };
      const size = new THREE.Vector3(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]);

      const root = new THREE.Group();           // joylashuv (slot / sahna / konteyner)
      const lift = new THREE.Group();           // hover: ko'tarilish + kattalashish
      const spin = new THREE.Group();           // aylanish
      root.add(lift); lift.add(spin);
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size.x + 0.9, size.z + 1.1), shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.005;
      shadow.visible = false; // mashina kelguncha bo'sh platformada qora dog' turmasin
      spin.add(shadow);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = size.y / 2;
      hit.userData.index = i;
      spin.add(hit);

      const slot = G.slots[i];
      root.rotation.order = 'YXZ'; // yaw, keyin qiyalik
      root.position.set(slot.x, G.ttH, slot.z);
      root.rotation.y = slot.yaw;
      this.fleet.add(root);
      // model kelguncha: g'ildiraksiz "rig" (o'qlar taxminiy)
      const rig = { front: size.z * 0.3, back: -size.z * 0.3, body: new THREE.Group(), roll() {}, steer() {} };
      return {
        car, model: null, mats: [], root, lift, spin, shadow, hit, size, slot, rig,
        hover: 0, spinAngle: 0, dim: 1, appear: 1,
        turntable: this.garage.anim.turntables[i],
      };
    });
    this.hitboxes = this.entities.map((e) => e.hit);

    // bir model bir necha mashinada (turli rangda) bo'lsa, har biriga asl nusxadan alohida klon
    const uses = new Map();
    for (const e of this.entities) uses.set(fileOf(e.car), (uses.get(fileOf(e.car)) || 0) + 1);
    this.load.uses = uses;

    // yuklash foizi — faqat sayt ochilishi uchun kerakli fayllar bo'yicha
    const total = need.reduce((sum, f) => sum + bytesOf(f), 0);
    const got = Object.fromEntries(need.map((f) => [f, 0]));
    const report = (f, n) => {
      got[f] = Math.min(n, bytesOf(f));
      this.onProgress?.(Math.min(1, Object.values(got).reduce((a, b) => a + b, 0) / total));
    };
    for (const f of need) jobs.get(f).onBytes = report;

    const first = this.entities.filter((e) => need.includes(fileOf(e.car)));
    await Promise.all(first.map(async (e) => this.mount(e, await this.load.get(fileOf(e.car)), false)));
  }

  /** Modelni joyiga qo'yadi. background — sayt ochiq: ish bo'laklarga bo'linadi, mashina silliq paydo bo'ladi */
  async mount(e, g, background) {
    if (e.model) return;
    const f = this.load.fileOf(e.car);
    const model = this.load.uses.get(f) > 1 ? cloneCar(g.scene) : g.scene;
    if (background) await idle();
    const rig = rigWheels(model, e.car.wheels);
    const { mats } = prepareCarMaterials(model, e.car);
    model.traverse((o) => { if (o.isMesh) o.castShadow = this.quality.shadows; });
    if (background) {
      // shader va teksturalar sahna ishlab turganda tayyorlanadi — mashina paydo bo'lganda kadr qotmaydi
      await idle();
      await this.precompile('garage', model);
      await this.uploadTextures(model);
    }
    e.spin.add(model);
    e.shadow.visible = true;
    Object.assign(e, { model, rig, mats, dim: 1, appear: background ? 0 : 1 });
    this.mounted++;
  }

  /** Qolgan mashinalar va kema — fonda, kelish tartibida, bittadan */
  mountRest() {
    const { fileOf, get } = this.load;
    for (const e of this.entities) {
      if (e.model) continue;
      get(fileOf(e.car)).then((g) => this.later(() => this.mount(e, g, true)))
        .catch((err) => console.warn('car load failed', e.car.id, err));
    }
    this.later(() => this.warmPort());
    get('ship').then((g) => this.later(async () => {
      await idle();
      const ship = g.scene;
      this.port.setShip(ship);
      this.ship = ship;
      this.story?.onShipLoaded?.();
      await this.warmPort();
    })).catch((e) => console.warn('ship load failed', e));
  }

  selectCar(i, silent = false) {
    if (i < 0 || i >= this.entities.length) return;
    const car = this.entities[i].car;
    if (i !== this.selected || !this.outline.material.map) {
      // katta nom teksturasi darhol emas: sichqoncha mashinalar ustidan o'tganda har biriga chizilmasin
      this.outlineDirty = true;
      clearTimeout(this.outlineTimer);
      this.outlineTimer = setTimeout(() => idle(500).then(() => this.buildOutline()), 350);
    }
    this.selected = i;
    this.load?.prioritize(this.load.fileOf(car));
    if (!silent) this.emit('select', i, car);
  }

  buildOutline() {
    if (!this.outlineDirty) return;
    this.outlineDirty = false;
    const tex = makeOutlineTextTexture(this.entities[this.selected].car.outline);
    this.outline.material.map?.dispose();
    this.outline.material.map = tex;
    this.outline.material.needsUpdate = true;
  }

  bindEvents() {
    addEventListener('resize', () => this.resize());
    const onMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.mouse.copy(this.pointer);
    };
    addEventListener('pointermove', onMove, { passive: true });
    this.canvas.addEventListener('pointerleave', () => this.pointer.set(9, 9));
    this.canvas.addEventListener('click', (e) => {
      if (this.p > 0.02) return;
      onMove(e);
      const i = this.pick();
      if (i >= 0) { this.selectCar(i); this.emit('choose', i); }
    });
  }

  pick() {
    if (this.pointer.x > 2) return -1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.hitboxes, false)[0];
    return hit ? hit.object.userData.index : -1;
  }

  setFocus(i) {
    const n = this.entities.length;
    this.focus = ((i % n) + n) % n;
    this.load?.prioritize(this.load.fileOf(this.entities[this.focus].car));
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const dpr = this.quality.dpr;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.projDirty = true;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    this.rtScene.setSize(pw, ph);
    this.rtAux.setSize(pw, ph);
    this.bloom.setSize(pw / 2, ph / 2);
    this.bloom.materialHighPassFilter.uniforms.uTexel.value.set(2 / pw, 2 / ph);
    this.garage.floor.setSize(w, h);
    this.portrait = w / h < 0.95;
  }

  setActive(v) { this.active = v; }

  /**
   * Kadr juda sekin bo'lsa (kuchsiz GPU) — sifat bir pog'ona pasaytiriladi: MSAA, piksel zichligi, pol aksi.
   * Sekin kadrlar GPU'ni "qotirib", brauzer WebGL kontekstini tashlab yuborishiga (oq ekran) olib kelmasin.
   */
  adaptQuality(now) {
    const pf = this.perf;
    const dt = pf.last ? (now - pf.last) / 1000 : 1 / 60;
    pf.last = now;
    if (dt > 0.25) return; // fon tab / pauza — hisobga olinmaydi
    pf.warm += dt;
    pf.ema += (dt - pf.ema) * 0.05;
    if (pf.warm < 4) return;  // birinchi soniyalar: shaderlar kompilyatsiyasi
    pf.slowFor = pf.ema > 1 / 28 ? pf.slowFor + dt : 0;
    if (pf.slowFor < 2.5) return;
    pf.slowFor = 0;
    pf.warm = 2;
    const q = this.quality;
    if (q.msaa > 0) {
      q.msaa = q.msaa > 2 ? 2 : 0;
      this.rtScene.dispose();
      this.rtScene = new THREE.WebGLRenderTarget(this.rtAux.width, this.rtAux.height, { type: THREE.HalfFloatType, samples: q.msaa });
    } else if (q.dpr > 1.2 && pf.step === 0) {
      pf.step = 1;
      q.dpr = Math.max(0.75, q.dpr * 0.82);
      this.resize();
    } else if (q.reflections) {
      // pol aksi sahnani har kadrda yana bir marta chizadi — kuchsiz GPU uchun eng qimmat qism
      q.reflections = false;
      this.garage.floor.setReflect(false);
    } else if (q.dpr > 0.8) {
      q.dpr = Math.max(0.75, q.dpr * 0.82);
      this.resize();
    }
  }

  /** Garajdagi soya xaritasi faqat biror narsa qimirlaganda qayta chiziladi */
  updateShadowState() {
    let sig = this.p * 1e3 + this.mounted * 17 + this.selected * 13;
    for (const e of this.entities) sig += e.hover * 3 + e.spinAngle * 7 + e.appear * 11;
    const b = this.entities[this.selected].rig.body.rotation;
    sig += b.x * 19 + b.z * 23;
    if (Math.abs(sig - this.shadowSig) > 1e-6) {
      this.shadowSig = sig;
      this.garage.anim.spotShadowDirty();
    }
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    if (!this.active || this.contextLost) return;
    this.adaptQuality(performance.now());

    // scroll progressi — yumshoq
    const k = 1 - Math.exp(-dt * 7);
    this.p += (this.targetP - this.p) * k;
    if (Math.abs(this.targetP - this.p) < 1e-5) this.p = this.targetP;
    this.mouseSmooth.lerp(this.mouse, 1 - Math.exp(-dt * 3));

    // hover (faqat garajda)
    let hov = -1;
    if (this.p < 0.015) {
      if (this.quality.mobile || this.portrait) hov = this.focus;
      else hov = this.pick();
    }
    if (hov !== this.hovered) {
      this.hovered = hov;
      this.canvas.style.cursor = hov >= 0 && !this.quality.mobile ? 'pointer' : '';
      if (hov >= 0) this.selectCar(hov); // oxirgi ko'rilgan mashina — sayohatga chiqadi
      this.emit('hover', hov);
    }

    this.story.update(this.p, dt, this.time);
    if (this.outlineDirty && this.outline.visible) this.buildOutline();
    // foydalanuvchi hikoyaga kirdi — kema navbatda oldinga
    if (!this.shipAsked && this.targetP > 0.12) { this.shipAsked = true; this.load.prioritize('ship'); }
    if (this.blend < 1) {
      this.garage.anim.update(this.time, this.camera);
      this.updateShadowState();
    }
    if (this.blend > 0) this.port.update(this.time, this.camera, this.story.shadowFocus);
    this.render();
    this.emit('frame', this.p);
  }

  render() {
    const { renderer, scene, camera, rtScene } = this;
    const k = this.blend;
    if (k <= 0 || k >= 1) {
      this.setWorld(k >= 1 ? 'port' : 'garage');
      renderer.setRenderTarget(rtScene);
      renderer.render(scene, camera);
    } else {
      // "match dissolve": konteyner ikkala kadrda bir joyda — atrofi hovlidan portga asta almashadi
      this.setWorld('port');
      renderer.setRenderTarget(rtScene);
      renderer.render(scene, camera);
      this.copyMat.uniforms.tDiffuse.value = rtScene.texture;
      this.copyMat.uniforms.uOpacity.value = 1;
      renderer.setRenderTarget(this.rtAux);
      this.copyQuad.render(renderer);
      this.setWorld('garage');
      renderer.setRenderTarget(rtScene);
      renderer.render(scene, camera);
      this.blendMat.uniforms.tDiffuse.value = this.rtAux.texture;
      this.blendMat.uniforms.uOpacity.value = k;
      renderer.autoClear = false; // garaj kadri ustiga chiziladi
      this.blendQuad.render(renderer);
      renderer.autoClear = true;
    }
    if (this.bloom.enabled) this.bloom.render(renderer, null, rtScene, 0, false);
    this.final.uniforms.tDiffuse.value = rtScene.texture;
    this.final.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    renderer.setRenderTarget(null);
    this.finalQuad.render(renderer);
  }

  /** 3D nuqtani ekran koordinatasiga */
  project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, visible: p.z < 1 };
  }

  setDim(e, k) {
    if (Math.abs(e.dim - k) < 0.002) return;
    e.dim = k;
    setCarDim(e.mats, k);
  }
}

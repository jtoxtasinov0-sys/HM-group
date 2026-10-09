import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import { createSkyEnvMap } from './sky.js';
import { createGarage, G } from './garage.js';
import { createContainer, createSpreader } from './container.js';
import { createPort } from './port.js';
import { prepareCarMaterials, setCarDim } from './materials.js';
import { makeShadowTexture, makeOutlineTextTexture } from './textures.js';
import { createStory, GARAGE_FOG, FOG_NEAR, FOG_FAR } from './story.js';
import { rigWheels } from './wheels.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.55 }, uGrain: { value: 0.028 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uVignette; uniform float uGrain; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - 0.5) * vec2(1.0, 0.85);
      float v = smoothstep(0.95, 0.28, length(d));
      c.rgb *= mix(1.0, v, uVignette);
      c.rgb += (rnd(vUv * 1024.0 + fract(uTime) * 61.0) - 0.5) * uGrain;
      gl_FragColor = c;
    }`,
};

export function detectQuality() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(innerWidth, innerHeight) < 600;
  const mobile = coarse || small;
  return {
    mobile,
    dpr: Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75),
    reflections: !mobile,
    reflectionRes: 0.5,
    msaa: mobile ? 0 : 4,
    shadows: !mobile,
    bloom: true,
  };
}

export class World {
  constructor(canvas, { cars, manifest, quality, onProgress }) {
    this.canvas = canvas;
    this.cars = cars;
    this.manifest = manifest;
    this.quality = quality;
    this.onProgress = onProgress;
    this.p = 0;
    this.targetP = 0;
    this.selected = 2;
    this.hovered = -1;
    this.pointer = new THREE.Vector2(9, 9);
    this.mouse = new THREE.Vector2(0, 0);      // parallaks uchun (-1..1)
    this.mouseSmooth = new THREE.Vector2(0, 0);
    this.focus = 2;                              // mobil: kamera qaysi mashinaga qarayapti
    this.focusSmooth = 2;
    this.active = true;
    this.listeners = { frame: new Set(), select: new Set(), hover: new Set(), choose: new Set() };
    this.clock = new THREE.Clock();
    // hero kamerasi (desktop)
    this.heroTune = { fov: 34, fit: 10.6, y: 2.0, ty: 1.55, shift: 0.36, pan: 3.2 };
    this.time = 0;
  }

  on(type, fn) { this.listeners[type].add(fn); return () => this.listeners[type].delete(fn); }
  emit(type, ...args) { this.listeners[type].forEach((fn) => fn(...args)); }

  async init() {
    const { quality } = this;
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.setPixelRatio(quality.dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = quality.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(GARAGE_FOG.clone(), FOG_NEAR, FOG_FAR);
    scene.background = GARAGE_FOG.clone();
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 3000);
    camera.position.set(0, 3.7, 21);
    this.camera = camera;

    // muhit xaritalari

    // dunyolar
    this.garage = createGarage({ quality });
    scene.add(this.garage.group);
    // garaj ichi ham hovli osmonidan olingan muhitni aks ettiradi: devorlar ko'kish-kulrang,
    // pol va lak akslari kontrastli (oq "studiya" muhiti sahnani oqartirib yuborardi)
    this.envYard = createSkyEnvMap(renderer, this.garage.anim.yardSky, 0.85);
    scene.environment = this.envYard;
    this.port = createPort({ quality });
    this.skyUniforms = this.port.sky.uniforms;
    this.envSky = createSkyEnvMap(renderer, this.port.sky, 0.9);
    this.port.group.visible = false;
    scene.add(this.port.group);

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

    // post-processing
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality.msaa });
    const composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(quality.dpr);
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.16, 0.35, 1.6);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    this.composer = composer;

    // yuklash
    await this.loadAll();

    this.story = createStory(this);
    this.raycaster = new THREE.Raycaster();
    this.bindEvents();
    this.resize();
    this.selectCar(this.selected, true);
    renderer.setAnimationLoop(() => this.tick());
  }

  async loadAll() {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const garageCars = this.cars.filter((c) => c.garage);
    const files = [...garageCars.map((c) => c.id), 'ship'];
    const total = files.reduce((s, id) => s + (this.manifest[id]?.bytes || 3e6), 0);
    const loaded = Object.fromEntries(files.map((f) => [f, 0]));
    const report = () => {
      const sum = Object.values(loaded).reduce((a, b) => a + b, 0);
      this.onProgress?.(Math.min(1, sum / total));
    };
    const load = (id) => new Promise((resolve, reject) => {
      loader.load(`${import.meta.env.BASE_URL}models/${id}.glb`, (g) => { loaded[id] = this.manifest[id]?.bytes || loaded[id]; report(); resolve(g); },
        (e) => { loaded[id] = Math.min(e.loaded, this.manifest[id]?.bytes || e.loaded); report(); }, reject);
    });

    const shadowTex = makeShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({ alphaMap: shadowTex, color: '#0b0f16', transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });

    // mashinalar parallel yuklanadi
    const gltfs = await Promise.all(garageCars.map((c) => load(c.id)));
    this.entities = garageCars.map((car, i) => {
      const model = gltfs[i].scene;
      const rig = rigWheels(model, car.wheels);
      const { mats } = prepareCarMaterials(model, car);
      model.traverse((o) => { if (o.isMesh) o.castShadow = this.quality.shadows; });
      const box = this.manifest[car.id]?.box || { min: [-1, 0, -2.5], max: [1, 1.6, 2.5] };
      const size = new THREE.Vector3(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]);

      const root = new THREE.Group();           // joylashuv (slot / sahna / konteyner)
      const lift = new THREE.Group();           // hover: ko'tarilish + kattalashish
      const spin = new THREE.Group();           // aylanish
      root.add(lift); lift.add(spin); spin.add(model);
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size.x + 0.9, size.z + 1.1), shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.005;
      spin.add(shadow);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = size.y / 2;
      hit.userData.index = i;
      spin.add(hit);

      const slot = G.slots[i];
      root.rotation.order = 'YXZ'; // yaw, keyin qiyalik
      root.position.set(slot.x, G.ttH, slot.z);
      root.rotation.y = slot.yaw;
      this.scene.add(root);
      return {
        car, model, mats, root, lift, spin, shadow, hit, size, slot, rig,
        hover: 0, spinAngle: 0, spinVel: 0, dim: 1,
        turntable: this.garage.anim.turntables[i],
      };
    });
    this.hitboxes = this.entities.map((e) => e.hit);

    // kema — fon rejimida
    this.shipPromise = load('ship').then((g) => {
      const ship = g.scene;
      this.port.setShip(ship);
      this.ship = ship;
      this.story?.onShipLoaded?.();
    }).catch((e) => console.warn('ship load failed', e));
  }

  selectCar(i, silent = false) {
    if (i < 0 || i >= this.entities.length) return;
    this.selected = i;
    const car = this.entities[i].car;
    const tex = makeOutlineTextTexture(car.outline);
    this.outline.material.map?.dispose();
    this.outline.material.map = tex;
    this.outline.material.needsUpdate = true;
    if (!silent) this.emit('select', i, car);
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
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.projDirty = true;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.setSize(w / 2, h / 2);
    this.garage.floor.setSize(w, h);
    this.portrait = w / h < 0.95;
  }

  setActive(v) { this.active = v; }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    if (!this.active) return;

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
    this.grade.uniforms.uTime.value = this.time;
    if (this.garage.group.visible) this.garage.anim.update(this.time, this.camera);
    else this.port.update(this.time, this.camera, this.container.group.position);
    this.composer.render();
    this.emit('frame', this.p);
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

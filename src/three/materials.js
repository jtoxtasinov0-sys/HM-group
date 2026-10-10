import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Avtomobil bo'yoqlari — ko'p qatlamli lak (clearcoat) bilan
export const PAINTS = {
  pearl:    { color: '#e9edf2', metalness: 0.12, roughness: 0.3,  clearcoatRoughness: 0.03, sheen: 0.4 },
  navy:     { color: '#173a66', metalness: 0.62, roughness: 0.34, clearcoatRoughness: 0.025 },
  obsidian: { color: '#0a0c10', metalness: 0.5,  roughness: 0.32, clearcoatRoughness: 0.02 },
  silver:   { color: '#b4bcc7', metalness: 0.88, roughness: 0.27, clearcoatRoughness: 0.03 },
  ice:      { color: '#a9c1dc', metalness: 0.7,  roughness: 0.3,  clearcoatRoughness: 0.03 },
  // Haqiqiy metallik bo'yoq: rangli asos (metallik o'rtacha, biroz xira) + ustida yaltiroq lak.
  // Metallik juda yuqori bo'lsa, kuzov rangi o'rniga garajning qorong'i akslari dog'-dog' bo'lib ko'rinadi.
  graphite: { color: '#2c343f', metalness: 0.45, roughness: 0.4,  clearcoatRoughness: 0.03 },
  sapphire: { color: '#10264a', metalness: 0.5,  roughness: 0.38, clearcoatRoughness: 0.025 }, // Rolls-Royce "Midnight Sapphire"
};

export function makePaint(key) {
  const p = PAINTS[key] || PAINTS.navy;
  const m = new THREE.MeshPhysicalMaterial({
    name: `HM_PAINT_${key}`,
    color: new THREE.Color(p.color),
    metalness: p.metalness,
    roughness: p.roughness,
    clearcoat: 1,
    clearcoatRoughness: p.clearcoatRoughness,
    envMapIntensity: 1.25,
  });
  if (p.sheen) { m.sheen = p.sheen; m.sheenColor = new THREE.Color('#ffffff'); m.sheenRoughness = 0.5; }
  return m;
}

const GLASS_RE = /glass|window|windshield|panarama|panorama|windows/i;
const LAMP_RE = /light|lamp|head|tail|brake|signal|drl|reflector|projector|beam/i;
const CHROME_RE = /chrome|mirror/i;
const TIRE_RE = /tire|tyre|rubber|tread/i;

function makeGlass() {
  return new THREE.MeshPhysicalMaterial({
    name: 'HM_GLASS',
    color: new THREE.Color('#0c1522'),
    metalness: 0,
    roughness: 0.03,
    transparent: true,
    opacity: 0.55,
    envMapIntensity: 1.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function makeLampGlass(src) {
  const red = src.color && src.color.r > src.color.g * 2 && src.color.r > 0.2;
  return new THREE.MeshPhysicalMaterial({
    name: 'HM_LAMP',
    color: red ? new THREE.Color('#5a0b10') : new THREE.Color('#ffffff'),
    metalness: 0,
    roughness: 0.02,
    transparent: true,
    opacity: red ? 0.75 : 0.12,
    envMapIntensity: 1.5,
    depthWrite: false,
  });
}

/**
 * GLTF modelni "bo'yaydi": kuzov — lak, oynalar — shisha, transmission o'chiriladi
 * (juda qimmat), xrom va shinalar tozalanadi. Mashinaning barcha materiallarini qaytaradi.
 */
export function prepareCarMaterials(root, car) {
  const paint = makePaint(car.paint);
  const paint2 = car.paint2 ? makePaint(car.paint2) : null;
  const glass = makeGlass();
  const lampCache = new Map();
  const seen = new Set();

  const fix = (m) => {
    const name = m.name || '';
    if (car.paintRe && car.paintRe.test(name)) return paint;
    if (paint2 && car.paint2Re.test(name)) return paint2;

    const isTransparent = m.transparent || m.transmission > 0 || m.opacity < 0.98;
    if (isTransparent && GLASS_RE.test(name) && !LAMP_RE.test(name)) return glass;
    if (isTransparent && (LAMP_RE.test(name) || GLASS_RE.test(name))) {
      if (!lampCache.has(m)) lampCache.set(m, makeLampGlass(m));
      return lampCache.get(m);
    }
    if (m.transmission > 0) {
      m.transmission = 0;
      m.transparent = true;
      m.opacity = Math.min(m.opacity ?? 1, 0.4);
      m.depthWrite = false;
    }
    if (CHROME_RE.test(name) && !m.map) { m.metalness = 1; m.roughness = Math.min(m.roughness, 0.08); m.color?.setScalar(0.92); }
    if (TIRE_RE.test(name) && !m.map) { m.metalness = 0; m.roughness = 0.82; m.color?.set('#121316'); }
    m.envMapIntensity = 1;
    return m;
  };

  root.traverse((o) => {
    if (!o.isMesh) return;
    if (car.hideRe && !Array.isArray(o.material) && car.hideRe.test(o.material.name)) { o.visible = false; return; }
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
    // siqishda buzilgan kuzov normallari qayta hisoblanadi: tekis joylar silliq, keskin qirralar saqlanadi
    if (car.creaseNormals && o.material === paint) o.geometry = toCreasedNormals(o.geometry, THREE.MathUtils.degToRad(car.creaseNormals));
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => seen.add(m));
  });

  const mats = [...seen];
  mats.forEach((m) => { m.userData.baseEnv = m.envMapIntensity; });
  return { mats, paint };
}

/** Mashinani "xira" qilish (boshqa mashina tanlanganda) — env yorug'ligini kamaytiradi */
export function setCarDim(mats, k) {
  for (const m of mats) m.envMapIntensity = m.userData.baseEnv * k;
}

import * as THREE from 'three';

const CALIPER_RE = /calip/i;

/**
 * Shinalarni geometriyadan o'lchaydi: yerga tegib turgan vertekslardan boshlab, ular bilan
 * bog'langan butun bo'lak (shina) topiladi va uning chegaralari olinadi. Shina pastda biroz
 * "yassilangan" bo'lishi mumkin, shuning uchun radius uzunlik bo'yicha (z), markaz esa tepadan
 * o'lchanadi. Markaz noto'g'ri bo'lsa g'ildirak boshqa nuqta atrofida aylanib, kuzovdan "chiqib ketadi".
 * Qaytaradi: har chorak uchun { R, cy, zc, x0, x1 } yoki null.
 */
/**
 * Bir xil joydagi (0.5 mm) vertekslarni birlashtiradi — UV/normal choklari bo'linib ketmasin.
 * Typed massivdagi ochiq adresli xesh: Map'dagi katta sonli kalitlardan bir necha baravar tez.
 * Qaytaradi: wid (verteks → guruh), rep (guruh → birinchi verteks), W (guruhlar soni)
 */
function weldIds(pos, n) {
  const size = 1 << Math.ceil(Math.log2(n * 2 + 2));
  const mask = size - 1;
  const table = new Int32Array(size).fill(-1);
  const keys = new Int32Array(n * 3);
  const wid = new Int32Array(n);
  const rep = new Int32Array(n);
  let W = 0;
  for (let i = 0; i < n; i++) {
    const kx = Math.round(pos[i * 3] * 2000), ky = Math.round(pos[i * 3 + 1] * 2000), kz = Math.round(pos[i * 3 + 2] * 2000);
    keys[i * 3] = kx; keys[i * 3 + 1] = ky; keys[i * 3 + 2] = kz;
    let h = (Math.imul(kx, 73856093) ^ Math.imul(ky, 19349663) ^ Math.imul(kz, 83492791)) & mask;
    for (;;) {
      const r = table[h];
      if (r < 0) { table[h] = i; wid[i] = W; rep[W++] = i; break; }
      if (keys[r * 3] === kx && keys[r * 3 + 1] === ky && keys[r * 3 + 2] === kz) { wid[i] = wid[r]; break; }
      h = (h + 1) & mask;
    }
  }
  return { wid, rep, W };
}

function* measureTires(items, quad, minY) {
  const box = Array.from({ length: 4 }, () => ({ x0: Infinity, x1: -Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity, n: 0 }));
  for (const { mesh, pos } of items) {
    const index = mesh.geometry.index?.array;
    if (!index) continue;
    const n = pos.length / 3;
    let seeded = false;
    for (let i = 1; i < pos.length; i += 3) if (pos[i] < minY + 0.004) { seeded = true; break; }
    if (!seeded) continue;
    yield;

    const { wid, rep, W } = weldIds(pos, n);
    yield;
    // verteks → uchburchaklar (CSR)
    const start = new Int32Array(W + 1);
    for (let t = 0; t < index.length; t++) start[wid[index[t]] + 1]++;
    for (let i = 0; i < W; i++) start[i + 1] += start[i];
    const fill = start.slice(0, W);
    const tris = new Int32Array(index.length);
    for (let t = 0; t < index.length; t++) tris[fill[wid[index[t]]]++] = (t / 3) | 0;

    const seen = new Uint8Array(W);
    for (let q = 0; q < 4; q++) {
      yield;
      const stack = [];
      for (let v = 0; v < W; v++) {
        const i = rep[v];
        if (pos[i * 3 + 1] < minY + 0.004 && quad(pos[i * 3], pos[i * 3 + 2]) === q && !seen[v]) { seen[v] = 1; stack.push(v); }
      }
      const b = box[q];
      while (stack.length) {
        const v = stack.pop();
        const i = rep[v];
        const x = Math.abs(pos[i * 3]), y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y);
        b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z); b.n++;
        for (let k = start[v]; k < start[v + 1]; k++) {
          const t = tris[k] * 3;
          for (let j = 0; j < 3; j++) {
            const u = wid[index[t + j]];
            if (seen[u]) continue;
            const ii = rep[u];
            if (pos[ii * 3 + 1] > minY + 1.0 || quad(pos[ii * 3], pos[ii * 3 + 2]) !== q) continue;
            seen[u] = 1;
            stack.push(u);
          }
        }
      }
    }
  }
  return box.map((b) => {
    const R = (b.z1 - b.z0) / 2;
    const h = b.y1 - minY;
    // shinaga o'xshamasa (kuzovga "oqib" ketgan bo'lsa) — ishonmaymiz
    if (!(b.n > 50 && R > 0.25 && R < 0.5 && Math.abs(h - 2 * R) < 0.05)) return null;
    return { R, cy: b.y1 - R, zc: (b.z0 + b.z1) / 2, x0: b.x0, x1: b.x1 };
  });
}

/**
 * G'ildiraklarni modeldan ajratib, aylanadigan qiladi.
 * Optimizatsiyada barcha detallar materiallar bo'yicha birlashtirilgan, shuning uchun
 * g'ildiraklar geometriya bo'yicha topiladi: shinaning yerga tegib turgan joyi o'qni beradi,
 * shu o'q atrofidagi silindr ichidagi uchburchaklar alohida meshga ko'chiriladi.
 *
 * opt.r — g'ildirak radiusi (metr; berilmasa geometriyadan o'lchanadi),
 * opt.inset — silindrni ichkariga qancha cho'zish (disk/tormoz uchun)
 * Qaytaradi: { wheels, radius, roll(masofa), steer(burchak) }
 */
export function rigWheels(model, opt = {}) {
  const steps = rigSteps(model, opt);
  let r;
  while (!(r = steps.next()).done);
  return r.value;
}

/**
 * Xuddi rigWheels, lekin ish bo'laklarga bo'linadi: har bo'lakdan keyin pause() kutiladi (masalan, brauzer bo'sh
 * payti). Sayt ochiq turganda fonda yuklangan mashina bitta uzun vazifa bilan sahifani qotirmaydi.
 */
export async function rigWheelsAsync(model, opt = {}, pause) {
  const steps = rigSteps(model, opt);
  let r;
  while (!(r = steps.next()).done) await pause();
  return r.value;
}

// normallashtirilgan (kvantlangan) pozitsiyalar uchun ko'paytuvchi — three.js denormalize bilan bir xil
const DENORM = new Map([[Int8Array, 127], [Uint8Array, 255], [Int16Array, 32767], [Uint16Array, 65535]]);

/** Mesh vertekslari model koordinatalarida (tez yo'l: oddiy massiv, kerak bo'lsa denormalizatsiya) */
function modelPositions(pa, M) {
  const pos = new Float32Array(pa.count * 3);
  const e = M.elements;
  // oddiy va "interleaved" (kvantlangan modellarda: qadam 4, bitta bo'sh) atributlar bir xil o'qiladi
  const il = pa.isInterleavedBufferAttribute;
  const a = il ? pa.data.array : pa.array;
  const stride = il ? pa.data.stride : pa.itemSize;
  const off = il ? pa.offset : 0;
  if (pa.itemSize < 3) {
    const v = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(M);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    return pos;
  }
  const div = pa.normalized ? DENORM.get(a.constructor) || 1 : 1;
  const signed = a instanceof Int8Array || a instanceof Int16Array;
  for (let i = 0; i < pa.count; i++) {
    const s = i * stride + off;
    let x = a[s] / div, y = a[s + 1] / div, z = a[s + 2] / div;
    if (signed && div !== 1) { x = Math.max(x, -1); y = Math.max(y, -1); z = Math.max(z, -1); }
    pos[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
    pos[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
    pos[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
  }
  return pos;
}

function* rigSteps(model, opt) {
  const inset = opt.inset ?? 0.05;
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();

  // 1) barcha vertekslar model koordinatalarida
  const meshes = [];
  model.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || !o.geometry?.attributes.position) return;
    meshes.push(o);
  });
  const items = [];
  for (const o of meshes) {
    const M = new THREE.Matrix4().multiplyMatrices(toModel, o.matrixWorld);
    items.push({ mesh: o, pos: modelPositions(o.geometry.attributes.position, M) });
    yield;
  }

  // 2) shinalarning yerga tegish joylari → 4 ta g'ildirak markazi
  let minY = Infinity;
  for (const { pos } of items) for (let i = 1; i < pos.length; i += 3) if (pos[i] < minY) minY = pos[i];
  const quad = (x, z) => (x < 0 ? 0 : 1) + (z < 0 ? 0 : 2); // 0 RL, 1 RR, 2 FL, 3 FR
  const acc = Array.from({ length: 4 }, () => ({ z0: Infinity, z1: -Infinity, x0: Infinity, x1: -Infinity }));
  for (const { pos } of items) {
    for (let i = 0; i < pos.length; i += 3) {
      if (pos[i + 1] > minY + 0.02) continue;
      const a = acc[quad(pos[i], pos[i + 2])];
      const ax = Math.abs(pos[i]);
      a.z0 = Math.min(a.z0, pos[i + 2]); a.z1 = Math.max(a.z1, pos[i + 2]);
      a.x0 = Math.min(a.x0, ax); a.x1 = Math.max(a.x1, ax);
    }
  }
  yield;
  const tires = opt.r ? [] : yield* measureTires(items, quad, minY);
  const wheels = acc.map((a, q) => {
    const sx = q % 2 ? 1 : -1;
    const front = q >= 2;
    const t = tires[q];
    const r = opt.r || t?.R || 0.37;
    const z = opt[front ? 'f' : 'b'] ?? t?.zc ?? (a.z0 + a.z1) / 2;
    return {
      front, sx, r,
      center: new THREE.Vector3(sx * (a.x0 + a.x1) / 2, t ? t.cy : minY + r, z),
      xIn: Math.min(a.x0, t?.x0 ?? a.x0) - inset, xOut: Math.max(a.x1 + 0.03, (t?.x1 ?? 0) + 0.01),
      steer: new THREE.Object3D(), spin: new THREE.Object3D(),
    };
  });
  const r = wheels.reduce((s, w) => s + w.r, 0) / 4;
  // kuzov alohida guruhda — tormoz/burilishda g'ildiraklarga nisbatan og'adi (podveska)
  const body = new THREE.Group();
  body.name = 'body';
  [...model.children].forEach((c) => body.add(c));
  model.add(body);
  for (const w of wheels) {
    w.steer.position.copy(w.center);
    w.steer.add(w.spin);
    model.add(w.steer);
  }
  model.updateMatrixWorld(true);

  // 3) silindr ichidagi uchburchaklarni ko'chirish (butun shina, protektor bilan)
  const stats = { spin: 0, steer: 0 };
  for (const { mesh, pos } of items) {
    const geo = mesh.geometry;
    const n = pos.length / 3;
    const tag = new Int8Array(n).fill(-1);
    let any = false;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const w = wheels[quad(x, z)];
      const ax = Math.abs(x);
      if (ax < w.xIn || ax > w.xOut) continue;
      const dy = y - w.center.y, dz = z - w.center.z;
      const rr = w.r + 0.012;
      if (dy * dy + dz * dz > rr * rr) continue;
      tag[i] = quad(x, z);
      any = true;
    }
    if (!any) continue;
    yield;

    // Uchburchaklar 5 guruhga (4 g'ildirak + kuzov) bo'linadi. Ikki o'tish (sanash, to'ldirish) va tayyor typed
    // massivlar: oddiy massivga millionlab push qilish asosiy oqimni o'nlab ms band qilib, sahifani qotirardi
    const index = geo.index ? geo.index.array : null;
    const len = index ? index.length : n;
    const groupOf = (t) => {
      const a = index ? index[t] : t, b = index ? index[t + 1] : t + 1, c = index ? index[t + 2] : t + 2;
      const q = tag[a];
      return q >= 0 && q === tag[b] && q === tag[c] ? q : 4;
    };
    const counts = [0, 0, 0, 0, 0];
    for (let t = 0; t < len; t += 3) counts[groupOf(t)] += 3;
    if (counts[4] === len) continue;
    yield;
    const IndexArray = n > 65535 ? Uint32Array : Uint16Array;
    const groups = counts.map((c) => new IndexArray(c));
    const fill = [0, 0, 0, 0, 0];
    for (let t = 0; t < len; t += 3) {
      const k = groupOf(t), g = groups[k];
      let f = fill[k];
      g[f++] = index ? index[t] : t; g[f++] = index ? index[t + 1] : t + 1; g[f++] = index ? index[t + 2] : t + 2;
      fill[k] = f;
    }
    const parts = groups.slice(0, 4);
    const body = groups[4];

    // geometriya boshqa meshlar bilan bo'lishilgan bo'lishi mumkin — atributlarni ulashib, indeksni almashtiramiz
    const sub = (idx) => {
      const g = new THREE.BufferGeometry();
      for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.boundingSphere = geo.boundingSphere;
      g.boundingBox = geo.boundingBox;
      return g;
    };
    const steerOnly = CALIPER_RE.test(mesh.material?.name || '');
    parts.forEach((p, q) => {
      if (!p.length) return;
      const m = new THREE.Mesh(sub(p), mesh.material);
      m.name = `${mesh.name}_wheel${q}`;
      m.position.copy(mesh.position); m.quaternion.copy(mesh.quaternion); m.scale.copy(mesh.scale);
      mesh.parent.add(m);
      m.updateMatrixWorld(true);
      (steerOnly ? wheels[q].steer : wheels[q].spin).attach(m);
      stats[steerOnly ? 'steer' : 'spin'] += p.length / 3;
    });
    if (body.length) mesh.geometry = sub(body);
    else mesh.removeFromParent();
    yield;
  }

  let travel = 0;
  return {
    wheels,
    body,
    radius: r,
    front: (wheels[2].center.z + wheels[3].center.z) / 2, // old o'q (z)
    back: (wheels[0].center.z + wheels[1].center.z) / 2,  // orqa o'q (z)
    stats,
    /** masofa (metr) — oldinga musbat */
    roll(dist) {
      travel += dist;
      for (const w of wheels) w.spin.rotation.x = travel / w.r;
    },
    /** old g'ildiraklar burilishi (radian, musbat — chapga) */
    steer(a) {
      for (const w of wheels) if (w.front) w.steer.rotation.y = a;
    },
  };
}

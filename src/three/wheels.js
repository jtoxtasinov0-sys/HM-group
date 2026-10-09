import * as THREE from 'three';

const CALIPER_RE = /calip/i;

/**
 * G'ildiraklarni modeldan ajratib, aylanadigan qiladi.
 * Optimizatsiyada barcha detallar materiallar bo'yicha birlashtirilgan, shuning uchun
 * g'ildiraklar geometriya bo'yicha topiladi: shinaning yerga tegib turgan joyi o'qni beradi,
 * shu o'q atrofidagi silindr ichidagi uchburchaklar alohida meshga ko'chiriladi.
 *
 * opt.r — g'ildirak radiusi (metr), opt.inset — silindrni ichkariga qancha cho'zish (disk/tormoz uchun)
 * Qaytaradi: { wheels, radius, roll(masofa), steer(burchak) }
 */
export function rigWheels(model, opt = {}) {
  const r = opt.r || 0.37;
  const inset = opt.inset ?? 0.05;
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();

  // 1) barcha vertekslar model koordinatalarida
  const items = [];
  model.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || !o.geometry?.attributes.position) return;
    const M = new THREE.Matrix4().multiplyMatrices(toModel, o.matrixWorld);
    const pa = o.geometry.attributes.position;
    const pos = new Float32Array(pa.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(M);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    items.push({ mesh: o, pos });
  });

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
  const wheels = acc.map((a, q) => {
    const sx = q % 2 ? 1 : -1;
    const front = q >= 2;
    const z = opt[front ? 'f' : 'b'] ?? (a.z0 + a.z1) / 2;
    return {
      front, sx,
      center: new THREE.Vector3(sx * (a.x0 + a.x1) / 2, minY + r, z),
      xIn: a.x0 - inset, xOut: a.x1 + 0.03,
      steer: new THREE.Object3D(), spin: new THREE.Object3D(),
    };
  });
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

  // 3) silindr ichidagi uchburchaklarni ko'chirish
  const r2 = (r + 0.006) * (r + 0.006);
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
      if (dy * dy + dz * dz > r2) continue;
      tag[i] = quad(x, z);
      any = true;
    }
    if (!any) continue;

    const index = geo.index ? geo.index.array : Array.from({ length: n }, (_, i) => i);
    const body = [];
    const parts = [[], [], [], []];
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t], b = index[t + 1], c = index[t + 2];
      const q = tag[a];
      if (q >= 0 && q === tag[b] && q === tag[c]) parts[q].push(a, b, c);
      else body.push(a, b, c);
    }
    if (parts.every((p) => !p.length)) continue;

    // geometriya boshqa meshlar bilan bo'lishilgan bo'lishi mumkin — atributlarni ulashib, indeksni almashtiramiz
    const sub = (idx) => {
      const g = new THREE.BufferGeometry();
      for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
      g.setIndex(idx);
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
  }

  let angle = 0;
  return {
    wheels,
    body,
    radius: r,
    front: (wheels[2].center.z + wheels[3].center.z) / 2, // old o'q (z)
    back: (wheels[0].center.z + wheels[1].center.z) / 2,  // orqa o'q (z)
    stats,
    /** masofa (metr) — oldinga musbat */
    roll(dist) {
      angle += dist / r;
      for (const w of wheels) w.spin.rotation.x = angle;
    },
    /** old g'ildiraklar burilishi (radian, musbat — chapga) */
    steer(a) {
      for (const w of wheels) if (w.front) w.steer.rotation.y = a;
    },
  };
}

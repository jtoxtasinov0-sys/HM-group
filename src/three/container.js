import * as THREE from 'three';
import { makeContainerDecal, makeContainerDoorDecal } from './textures.js';

// ISO 20ft konteyner (metr)
export const C = { L: 6.058, W: 2.438, H: 2.591, floorY: 0.17 };

/**
 * To'lqinsimon (gofrirovka) panel: profil X bo'ylab, balandlik Y bo'ylab, chuqurlik +Z.
 */
function corrugated(length, height, { pitch = 0.278, depth = 0.036, flat = 0.075 } = {}) {
  const slope = (pitch - 2 * flat) / 2;
  const pts = [[0, 0]];
  let x = 0;
  while (x < length - 1e-4) {
    const seq = [[flat, 0], [slope, depth], [flat, depth], [slope, 0]];
    for (const [dx, z] of seq) { x = Math.min(length, x + dx); pts.push([x, z]); if (x >= length) break; }
  }
  const pos = []; const nor = []; const uv = []; const idx = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i]; const [x1, z1] = pts[i + 1];
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len, nz = dx / len;
    const b = pos.length / 3;
    for (const [px, pz, py] of [[x0, z0, 0], [x1, z1, 0], [x1, z1, height], [x0, z0, height]]) {
      pos.push(px - length / 2, py, pz);
      nor.push(nx, 0, nz);
      uv.push(px / length, py / height);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function createContainer() {
  const { L, W, H } = C;
  const group = new THREE.Group();
  group.name = 'hm-container';

  const paint = new THREE.MeshStandardMaterial({ color: '#1D3E69', roughness: 0.48, metalness: 0.42, side: THREE.DoubleSide });
  const frame = new THREE.MeshStandardMaterial({ color: '#152f52', roughness: 0.5, metalness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c9d2dd', roughness: 0.3, metalness: 0.9 });
  const casting = new THREE.MeshStandardMaterial({ color: '#0e2036', roughness: 0.6, metalness: 0.5 });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#2d3b4f', roughness: 0.75, metalness: 0.1 });

  const box = (w, h, d, x, y, z, mat = frame, parent = group) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // pastki va ustki relslar
  for (const s of [-1, 1]) {
    box(0.1, 0.16, L, s * (W / 2 - 0.05), 0.08, 0);
    box(0.1, 0.1, L, s * (W / 2 - 0.05), H - 0.05, 0);
  }
  box(W, 0.16, 0.1, 0, 0.08, -L / 2 + 0.05);
  box(W, 0.12, 0.12, 0, H - 0.06, -L / 2 + 0.06);
  // pol
  box(W - 0.12, 0.03, L - 0.12, 0, 0.155, 0, floorMat);
  // burchak ustunlari va quymalar
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.15, H, 0.15, sx * (W / 2 - 0.075), H / 2, sz * (L / 2 - 0.075));
    for (const y of [0.09, H - 0.09]) box(0.18, 0.12, 0.18, sx * (W / 2 - 0.09), y, sz * (L / 2 - 0.09), casting);
  }

  // yon devorlar (gofra)
  const sideGeo = corrugated(L - 0.3, H - 0.27);
  // brend yozuvi gofraning o'ziga "bo'yalgan" (xuddi shu geometriya, shaffof tekstura)
  const decalMat = new THREE.MeshStandardMaterial({
    map: makeContainerDecal(), transparent: true, roughness: 0.5, metalness: 0.1,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(sideGeo, paint);
    m.rotation.y = s * Math.PI / 2; // gofra tashqariga qaraydi
    m.position.set(s * (W / 2 - 0.06), 0.16, 0);
    group.add(m);
    const d = new THREE.Mesh(sideGeo, decalMat);
    d.rotation.copy(m.rotation);
    d.position.copy(m.position);
    d.position.x += s * 0.001;
    group.add(d);
  }
  // old (yopiq) tomon
  const endGeo = corrugated(W - 0.3, H - 0.27, { pitch: 0.24, depth: 0.03, flat: 0.06 });
  const endWall = new THREE.Mesh(endGeo, paint);
  endWall.rotation.y = Math.PI;
  endWall.position.set(0, 0.16, -L / 2 + 0.06);
  group.add(endWall);
  // tom: profil Z bo'ylab, kenglik X bo'ylab, gofra yuqoriga
  const roofGeo = corrugated(L - 0.2, W - 0.2, { pitch: 0.5, depth: 0.018, flat: 0.16 });
  const roof = new THREE.Mesh(roofGeo, paint);
  roof.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0),
  ));
  roof.position.set(-(W - 0.2) / 2, H - 0.06, 0);
  group.add(roof);

  // ichki yoritgich (yuklash paytida yonadi)
  const innerLightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8f1ff') });
  const innerStrip = box(0.08, 0.03, L - 0.6, 0, H - 0.12, 0, innerLightMat);
  const innerLight = new THREE.PointLight('#dfeaff', 0, 7, 1.5);
  innerLight.position.set(0, H - 0.4, 0.4);
  group.add(innerLight);

  // ---------- ESHIKLAR ----------
  const doorH = H - 0.3;
  const doorW = W / 2 - 0.08;
  box(W, 0.18, 0.14, 0, H - 0.09, L / 2 - 0.07); // ustki sarlavha
  box(W, 0.14, 0.14, 0, 0.07, L / 2 - 0.07);     // ostona

  const doorGeo = corrugated(doorW - 0.08, doorH - 0.12, { pitch: 0.2, depth: 0.025, flat: 0.05 });
  const doorDecal = new THREE.MeshStandardMaterial({ map: makeContainerDoorDecal(), transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });

  const makeDoor = (side) => {
    // side = -1 chap (ilgagi x=-W/2), +1 o'ng
    const pivot = new THREE.Group();
    pivot.position.set(side * (W / 2 - 0.06), 0.15, L / 2 - 0.02);
    const door = new THREE.Group();
    door.position.x = -side * doorW / 2;
    pivot.add(door);
    const panel = new THREE.Mesh(doorGeo, paint);
    panel.position.set(0, 0.06, -0.012);
    door.add(panel);
    // ramka
    box(doorW, 0.07, 0.06, 0, 0.035, 0.0, frame, door);
    box(doorW, 0.07, 0.06, 0, doorH - 0.035, 0.0, frame, door);
    box(0.06, doorH, 0.06, -doorW / 2 + 0.03, doorH / 2, 0, frame, door);
    box(0.06, doorH, 0.06, doorW / 2 - 0.03, doorH / 2, 0, frame, door);
    // qulf tayoqlari
    for (const k of [0.27, 0.73]) {
      const bx = (k - 0.5) * doorW;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, doorH + 0.05, 10), steel);
      rod.position.set(bx, doorH / 2, 0.06);
      door.add(rod);
      const handle = box(0.035, 0.035, 0.32, bx + 0.0, doorH * 0.45, 0.2, steel, door);
      handle.rotation.y = 0;
      for (const y of [0.25, doorH - 0.25]) box(0.08, 0.06, 0.06, bx, y, 0.05, steel, door);
    }
    // ilgaklar
    for (const y of [0.3, doorH * 0.5, doorH - 0.3]) box(0.05, 0.12, 0.07, side * (doorW / 2 - 0.02), y, 0.03, steel, door);
    if (side > 0) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(doorW * 0.9, doorW * 0.9), doorDecal);
      d.position.set(0, doorH * 0.62, 0.031);
      door.add(d);
    }
    group.add(pivot);
    return pivot;
  };
  const doorL = makeDoor(-1);
  const doorR = makeDoor(1);

  /** t: 0 — yopiq, 1 — to'liq ochiq (yon devorlarga yotadi) */
  const setDoors = (tl, tr = tl) => {
    doorL.rotation.y = -tl * Math.PI * 0.94;
    doorR.rotation.y = tr * Math.PI * 0.94;
  };
  const setInnerLight = (k) => {
    innerLight.intensity = k * 9;
    innerLightMat.color.setRGB(0.91, 0.95, 1).multiplyScalar(0.3 + k * 4.5);
  };
  setDoors(1);
  setInnerLight(1);

  group.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
  return { group, setDoors, setInnerLight, innerStrip };
}

/** Kran "spreader"i va trosslar */
export function createSpreader() {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#e9eef5', roughness: 0.45, metalness: 0.5 });
  const navy = new THREE.MeshStandardMaterial({ color: '#1D3E69', roughness: 0.5, metalness: 0.5 });
  const cableMat = new THREE.MeshStandardMaterial({ color: '#2a3442', roughness: 0.4, metalness: 0.8 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, C.L - 0.2), white);
  beam.position.y = 0.36;
  group.add(beam);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(C.W - 0.1, 0.22, 0.32), navy);
    arm.position.set(0, 0.2, s * (C.L / 2 - 0.25));
    group.add(arm);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.2), white);
  head.position.y = 0.72;
  group.add(head);
  const cables = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), cableMat);
    c.userData.off = new THREE.Vector3(sx * 0.5, 0.95, sz * 0.9);
    cables.push(c);
    group.add(c);
  }
  /** trosslar uzunligi — tepadagi trolleygacha (dunyo Y koordinatasida) */
  const setTop = (worldTopY) => {
    const len = Math.max(0.1, worldTopY - group.position.y - 0.95);
    for (const c of cables) {
      c.scale.y = len;
      c.position.set(c.userData.off.x, c.userData.off.y + len / 2, c.userData.off.z);
    }
  };
  return { group, setTop };
}

import * as THREE from 'three';
import {
  makeContainerDecal, makeContainerDoorDecal, makeWeatheredPaint, makeGrimeTexture, makePlywoodTexture, makeCscPlateTexture,
} from './textures.js';

// ISO 20ft konteyner (metr)
export const C = { L: 6.058, W: 2.438, H: 2.591, floorY: 0.17 };

const NAVY = '#1D3E69';

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

/** Gofra qirralarining UV o'rni — bo'yoq aynan shu joylarda yeyiladi */
function ridgeU(length, { pitch = 0.278, flat = 0.075 } = {}) {
  const slope = (pitch - 2 * flat) / 2;
  const out = [];
  for (let x = 0; x < length; x += pitch) out.push(x + flat, x + flat + slope, x + 2 * flat + slope, x + pitch);
  return out.filter((v) => v < length).map((v) => v / length);
}

export function createContainer() {
  const { L, W, H } = C;
  const group = new THREE.Group();
  group.name = 'hm-container';

  // ---------- materiallar ----------
  const SIDE = { pitch: 0.278, depth: 0.036, flat: 0.075 };
  // deyarli yangi konteyner: nozik iflos va zang izlari (haddan tashqari eskirgan emas)
  const wear = { streaks: 0.45, rust: 0.3, grime: 0.45 };
  const side = makeWeatheredPaint({ base: NAVY, w: 2048, h: 1024, seed: 5, ridges: ridgeU(L - 0.3, SIDE), ...wear });
  const roofP = makeWeatheredPaint({ base: '#1b3a63', w: 1024, h: 512, seed: 6, streaks: 0.3, rust: 0.3, grime: 0 });
  const endP = makeWeatheredPaint({ base: NAVY, w: 512, h: 512, seed: 7, ridges: ridgeU(W - 0.3, { pitch: 0.24, flat: 0.06 }), ...wear });
  const doorP = makeWeatheredPaint({ base: NAVY, w: 512, h: 1024, seed: 8, ridges: ridgeU(W / 2 - 0.16, { pitch: 0.2, flat: 0.05 }), ...wear });
  const paintOf = (p) => new THREE.MeshStandardMaterial({ map: p.map, roughnessMap: p.roughnessMap, roughness: 1, metalness: 0.22 });
  const paint = paintOf(side);
  const roofMat = paintOf(roofP);
  const endMat = paintOf(endP);
  const doorMat = paintOf(doorP);
  doorMat.side = THREE.DoubleSide;
  // ichki devorlar — oddiyroq, och kulrang-ko'k bo'yoq
  const inner = new THREE.MeshStandardMaterial({ color: '#4a5d75', roughness: 0.7, metalness: 0.2, side: THREE.BackSide });
  const grime = makeGrimeTexture(9);
  const frame = new THREE.MeshStandardMaterial({ color: '#1f3b62', map: grime, roughness: 0.55, metalness: 0.4 });
  const casting = new THREE.MeshStandardMaterial({ color: '#1a2d47', map: grime, roughness: 0.7, metalness: 0.45 });
  const steel = new THREE.MeshStandardMaterial({ color: '#7a828b', map: grime, roughness: 0.5, metalness: 0.8 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#0d0f12', roughness: 0.85 });
  const hole = new THREE.MeshBasicMaterial({ color: '#07090c' });
  const plyTex = makePlywoodTexture();
  plyTex.repeat.set(1, 2);
  const floorMat = new THREE.MeshStandardMaterial({ map: plyTex, roughness: 0.8, metalness: 0 });

  const box = (w, h, d, x, y, z, mat = frame, parent = group) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const panel = (geo, outMat, inMat, setup) => {
    const a = new THREE.Mesh(geo, outMat); setup(a); a.castShadow = a.receiveShadow = true; group.add(a);
    if (inMat) { const b = new THREE.Mesh(geo, inMat); setup(b); b.receiveShadow = true; group.add(b); }
    return a;
  };

  // ---------- RAMA: pastki/ustki relslar, burchak ustunlari, quymalar ----------
  for (const s of [-1, 1]) {
    box(0.1, 0.16, L, s * (W / 2 - 0.05), 0.08, 0);
    box(0.1, 0.1, L, s * (W / 2 - 0.05), H - 0.05, 0);
    // vilkali yuklagich cho'ntaklari (pastki relsdagi qora teshiklar)
    for (const z of [-1.03, 1.03]) {
      box(0.06, 0.12, 0.36, s * (W / 2 - 0.02), 0.075, z, casting);
      box(0.02, 0.09, 0.3, s * (W / 2 + 0.012), 0.075, z, hole);
    }
  }
  box(W, 0.16, 0.1, 0, 0.08, -L / 2 + 0.05);
  box(W, 0.12, 0.12, 0, H - 0.06, -L / 2 + 0.06);
  // pol (fanera) va ostidagi ko'ndalang to'sinlar
  const floor = box(W - 0.12, 0.03, L - 0.12, 0, 0.155, 0, floorMat);
  floor.castShadow = false;
  for (let i = 0; i < 11; i++) box(W - 0.2, 0.09, 0.07, 0, 0.05, -L / 2 + 0.35 + i * ((L - 0.7) / 10), frame);
  // burchak ustunlari va quymalar (ISO teshiklari bilan)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.15, H, 0.15, sx * (W / 2 - 0.075), H / 2, sz * (L / 2 - 0.075));
    for (const [y, sy] of [[0.059, -1], [H - 0.059, 1]]) {
      const cx = sx * (W / 2 - 0.089), cz = sz * (L / 2 - 0.081);
      box(0.178, 0.118, 0.162, cx, y, cz, casting);
      // yon, uch va ust/ost tomonlardagi oval teshiklar
      box(0.004, 0.05, 0.075, sx * (W / 2 + 0.001), y, cz, hole);
      box(0.06, 0.05, 0.004, cx, y, sz * (L / 2 + 0.001), hole);
      box(0.06, 0.004, 0.11, cx, y + sy * 0.0595, cz, hole);
    }
  }

  // ---------- YON DEVORLAR (gofra) ----------
  const sideGeo = corrugated(L - 0.3, H - 0.27, SIDE);
  // brend yozuvi gofraning o'ziga "bo'yalgan" (xuddi shu geometriya, shaffof tekstura)
  const decalMat = new THREE.MeshStandardMaterial({
    map: makeContainerDecal(), transparent: true, roughness: 0.6, metalness: 0.05,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  for (const s of [-1, 1]) {
    const setup = (m) => { m.rotation.y = s * Math.PI / 2; m.position.set(s * (W / 2 - 0.06), 0.16, 0); };
    panel(sideGeo, paint, inner, setup);
    const d = new THREE.Mesh(sideGeo, decalMat);
    setup(d);
    d.position.x += s * 0.001;
    d.receiveShadow = true;
    group.add(d);
  }
  // old (yopiq) tomon
  const endGeo = corrugated(W - 0.3, H - 0.27, { pitch: 0.24, depth: 0.03, flat: 0.06 });
  panel(endGeo, endMat, inner, (m) => { m.rotation.y = Math.PI; m.position.set(0, 0.16, -L / 2 + 0.06); });
  // tom: profil Z bo'ylab, kenglik X bo'ylab, gofra yuqoriga
  const roofGeo = corrugated(L - 0.2, W - 0.2, { pitch: 0.5, depth: 0.018, flat: 0.16 });
  panel(roofGeo, roofMat, inner, (m) => {
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0),
    ));
    m.position.set(-(W - 0.2) / 2, H - 0.06, 0);
  });

  // ichki yoritgich (yuklash paytida yonadi)
  const innerLightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8f1ff') });
  const innerStrip = box(0.08, 0.03, L - 0.6, 0, H - 0.12, 0, innerLightMat);
  innerStrip.castShadow = false;
  const innerLight = new THREE.PointLight('#dfeaff', 0, 7, 1.5);
  innerLight.position.set(0, H - 0.4, 0.4);
  group.add(innerLight);

  // ---------- ESHIKLAR ----------
  const doorH = H - 0.3;
  const doorW = W / 2 - 0.08;
  box(W, 0.18, 0.14, 0, H - 0.09, L / 2 - 0.07); // ustki sarlavha
  box(W, 0.14, 0.14, 0, 0.07, L / 2 - 0.07);     // ostona

  const doorGeo = corrugated(doorW - 0.08, doorH - 0.12, { pitch: 0.2, depth: 0.025, flat: 0.05 });
  const doorDecal = new THREE.MeshStandardMaterial({ map: makeContainerDoorDecal(), transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const cscMat = new THREE.MeshStandardMaterial({ map: makeCscPlateTexture(), roughness: 0.35, metalness: 0.7 });
  // qulf tayoqlari tutqichlari ustki/pastki relsda (kulachok ushlagichlari)
  const rodX = (side, k) => side * (W / 2 - 0.06) - side * doorW / 2 + (k - 0.5) * doorW;

  const makeDoor = (side) => {
    // side = -1 chap (ilgagi x=-W/2), +1 o'ng
    const pivot = new THREE.Group();
    pivot.position.set(side * (W / 2 - 0.06), 0.15, L / 2 - 0.02);
    const door = new THREE.Group();
    door.position.x = -side * doorW / 2;
    pivot.add(door);
    const leaf = new THREE.Mesh(doorGeo, doorMat);
    leaf.position.set(0, 0.06, -0.012);
    leaf.castShadow = leaf.receiveShadow = true;
    door.add(leaf);
    // ramka va rezina zichlagich
    box(doorW, 0.07, 0.06, 0, 0.035, 0.0, frame, door);
    box(doorW, 0.07, 0.06, 0, doorH - 0.035, 0.0, frame, door);
    box(0.06, doorH, 0.06, -doorW / 2 + 0.03, doorH / 2, 0, frame, door);
    box(0.06, doorH, 0.06, doorW / 2 - 0.03, doorH / 2, 0, frame, door);
    box(0.025, doorH - 0.02, 0.03, -side * (doorW / 2 + 0.006), doorH / 2, -0.01, rubber, door);
    // qulf tayoqlari: ikkitadan, kulachoklar, yo'naltiruvchilar, yotqizilgan dastaklar
    for (const k of [0.27, 0.73]) {
      const bx = (k - 0.5) * doorW;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, doorH + 0.1, 12), steel);
      rod.position.set(bx, doorH / 2, 0.065);
      rod.castShadow = true;
      door.add(rod);
      for (const y of [-0.02, doorH + 0.02]) box(0.07, 0.07, 0.07, bx, y, 0.065, steel, door);         // kulachok
      for (const y of [0.35, doorH * 0.5, doorH - 0.35]) box(0.075, 0.05, 0.05, bx, y, 0.045, steel, door); // yo'naltiruvchi
      // dastak: eshikka yotqizilgan, uchi ushlagichga kiradi
      box(0.03, 0.03, 0.06, bx, doorH * 0.42, 0.09, steel, door);
      box(0.3, 0.028, 0.028, bx + 0.15, doorH * 0.42, 0.105, steel, door);
      box(0.05, 0.08, 0.04, bx + 0.29, doorH * 0.42, 0.075, steel, door);
    }
    // ilgaklar (4 ta) — tashqi chetda
    for (const y of [0.25, doorH * 0.36, doorH * 0.64, doorH - 0.25]) {
      box(0.1, 0.13, 0.07, side * (doorW / 2 - 0.02), y, 0.035, steel, door);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 10), steel);
      pin.position.set(side * (doorW / 2 + 0.035), y, 0.03);
      door.add(pin);
    }
    if (side > 0) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(doorW * 0.9, doorW * 0.9), doorDecal);
      d.position.set(0, doorH * 0.62, 0.031);
      door.add(d);
    } else {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.15), cscMat);
      plate.position.set(0, doorH * 0.3, 0.032);
      door.add(plate);
    }
    group.add(pivot);
    return pivot;
  };
  const doorL = makeDoor(-1);
  const doorR = makeDoor(1);
  // kulachok ushlagichlari (sarlavha va ostonada)
  for (const side of [-1, 1]) for (const k of [0.27, 0.73]) {
    box(0.1, 0.06, 0.09, rodX(side, k), H - 0.2, L / 2 + 0.02, steel);
    box(0.1, 0.06, 0.09, rodX(side, k), 0.15, L / 2 + 0.02, steel);
  }

  /** t: 0 — yopiq, 1 — to'liq ochiq (yon devorlarga yotadi) */
  const setDoors = (tl, tr = tl) => {
    doorL.rotation.y = -tl * Math.PI * 0.94;
    doorR.rotation.y = tr * Math.PI * 0.94;
  };
  const setInnerLight = (k) => {
    innerLight.intensity = k * 2.5;
    innerLightMat.color.setRGB(0.91, 0.95, 1).multiplyScalar(0.3 + k * 2.2);
  };
  setDoors(1);
  setInnerLight(1);

  group.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
  return { group, setDoors, setInnerLight, innerStrip };
}

/** Qora-sariq xavf chiziqlari (spreader chetlari uchun) */
function hazardTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#e0b021'; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#16171a';
  for (let x = -64; x < 320; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x + 24, 64); ctx.lineTo(x + 88, 0); ctx.lineTo(x + 64, 0); ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/**
 * Kran "spreader"i: konteynerni burchak teshiklaridan (twistlock) ushlovchi sariq teleskopik ramka,
 * chetlarida xavf chiziqlari, yo'naltiruvchi "flipper"lar, tepada tros g'altakli bosh blok.
 */
export function createSpreader() {
  const group = new THREE.Group();
  const grime = makeGrimeTexture(19);
  const yellow = new THREE.MeshStandardMaterial({ color: '#e3b122', map: grime, roughness: 0.45, metalness: 0.25 });
  const hz = hazardTexture();
  hz.repeat.set(3, 1);
  const hazard = new THREE.MeshStandardMaterial({ map: hz, roughness: 0.5, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b323b', map: grime, roughness: 0.5, metalness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: '#9aa2ab', roughness: 0.3, metalness: 0.9 });
  const cableMat = new THREE.MeshStandardMaterial({ color: '#23282f', roughness: 0.35, metalness: 0.85 });
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, 0, rz);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // markaziy quti to'sin va ichidan chiqadigan teleskopik qo'llar
  add(B(0.62, 0.46, 2.6), yellow, 0, 0.42, 0);
  for (const s of [-1, 1]) {
    add(B(0.5, 0.36, C.L / 2 - 1.5), yellow, 0, 0.4, s * (C.L / 4 + 0.62));
    // chetdagi ko'ndalang to'sin: tashqi yuzasi xavf chiziqli
    add(B(C.W + 0.12, 0.34, 0.42), [yellow, yellow, yellow, yellow, s > 0 ? hazard : yellow, s > 0 ? yellow : hazard], 0, 0.27, s * (C.L / 2 - 0.2));
    for (const sx of [-1, 1]) {
      add(B(0.26, 0.2, 0.26), dark, sx * (C.W / 2 - 0.1), 0.06, s * (C.L / 2 - 0.12));                // twistlock korpusi
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10), steel, sx * (C.W / 2 - 0.1), -0.07, s * (C.L / 2 - 0.12)); // twistlock tishi
      add(B(0.05, 0.55, 0.42), yellow, sx * (C.W / 2 + 0.06), -0.08, s * (C.L / 2 - 0.25), 0, sx * 0.18); // flipper
      add(B(0.5, 0.18, 0.18), dark, sx * 0.55, 0.62, s * (C.L / 2 - 1.1));                               // gidravlika
    }
  }
  // bosh blok (headblock) va tros g'altaklari
  add(B(1.7, 0.5, 2.5), yellow, 0, 0.92, 0);
  add(B(1.72, 0.08, 2.52), hazard, 0, 1.2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 18), dark, sx * 0.5, 1.32, sz * 0.9, 0, Math.PI / 2);
  }
  const cables = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cbl = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 6), cableMat);
    cbl.userData.off = new THREE.Vector3(sx * 0.5, 1.5, sz * 0.9);
    cbl.castShadow = true;
    cables.push(cbl);
    group.add(cbl);
  }
  /** trosslar uzunligi — tepadagi trolleygacha (dunyo Y koordinatasida) */
  const setTop = (worldTopY) => {
    const len = Math.max(0.1, worldTopY - group.position.y - 1.5);
    for (const cbl of cables) {
      cbl.scale.y = len;
      cbl.position.set(cbl.userData.off.x, cbl.userData.off.y + len / 2, cbl.userData.off.z);
    }
  };
  return { group, setTop };
}

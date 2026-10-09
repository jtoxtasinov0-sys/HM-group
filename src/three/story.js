import * as THREE from 'three';
import { G } from './garage.js';
import { C } from './container.js';
import { P } from './port.js';

// ---------- yordamchilar ----------
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const seg = (p, a, b) => clamp01((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
const lerpAngle = (a, b, t) => {
  const d = ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return a + d * t;
};
const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Hikoya vaqt jadvali (scroll progress 0..1)
export const T = {
  heroEnd: 0.015,
  moveA: 0.015, moveB: 0.11,
  showA: 0.11, showB: 0.25,
  turnA: 0.25, turnB: 0.29,
  shutA: 0.27, shutB: 0.32,
  driveA: 0.30, driveB: 0.42,
  closeA: 0.42, closeB: 0.465,
  // hovlidan portga o'tish: konteyner joyida qoladi, atrofi (hovli → port) asta almashadi ("match dissolve").
  // Oq tuman yo'q — kadr oqarib-qorayib miltillamaydi
  xfadeA: 0.462, xfadeB: 0.5,
  spreadA: 0.49, spreadB: 0.53,
  liftA: 0.53, liftB: 0.64,
  moveXA: 0.64, moveXB: 0.70,
  lowerA: 0.70, lowerB: 0.76,
  releaseA: 0.76, releaseB: 0.79,
  sailA: 0.80, sailB: 1.0,
};

const STAGE_YAW = 0.55;
const LIFT_TOP = 30;
export const GARAGE_FOG = new THREE.Color('#dfe6ee'); // hovli ufqidagi havo rangi
export const FOG_NEAR = 70, FOG_FAR = 340;
export const PORT_HAZE = new THREE.Color('#d3e1ef');  // dengiz ufqidagi havo

export function createStory(world) {
  const { camera, garage, port, container, spreader } = world;
  const ents = world.entities;
  const A = garage.anim;

  const shipBase = port.shipHolder.position.clone();
  const slot = shipBase.clone().add(P.slotLocal); // kemadagi joy
  const slotLocal = new THREE.Vector3();
  const updateSlotLocal = () => slotLocal.copy(slot).sub(shipBase);
  updateSlotLocal();

  const tmpA = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const camTgt = new THREE.Vector3();
  const contPos = new THREE.Vector3();
  const shadowFocus = new THREE.Vector3().copy(G.container);
  let curFov = 34;
  let curShift = 0;
  let appliedShift = 0;

  function onShipLoaded() {
    // konteyner kemadagi bo'shatilgan uyachaga — qo'shni konteynerlar bilan bir qatorda tushadi
    slot.copy(shipBase).add(P.slotLocal);
    updateSlotLocal();
  }

  // ---------- kamera kalit kadrlari ----------
  const heroCam = () => {
    const a = camera.aspect;
    if (world.portrait) {
      const f = world.focusSmooth;
      const i0 = Math.floor(f), i1 = Math.min(ents.length - 1, i0 + 1), t = f - i0;
      const s0 = G.slots[i0], s1 = G.slots[i1];
      const sx = lerp(s0.x, s1.x, t), sz = lerp(s0.z, s1.z, t);
      return {
        pos: V(sx * 0.82, 3.1, sz + 13.5 / Math.max(0.6, a) * 0.62),
        tgt: V(sx, 1.0, sz),
        fov: 46,
        shift: 0.16,
      };
    }
    const h = world.heroTune;
    const tanH = Math.tan(THREE.MathUtils.degToRad(h.fov / 2)) * a;
    const D = THREE.MathUtils.clamp(h.fit / tanH - 2.5, 14, 34);
    const m = world.mouseSmooth;
    // sichqoncha bilan garaj bo'ylab yengil "panorama"
    return { pos: V(m.x * h.pan, h.y + m.y * 0.25, D), tgt: V(m.x * h.pan * 0.8, h.ty, -1.5), fov: h.fov, shift: h.shift };
  };
  const pr = () => world.portrait;
  const KF = [
    { p: 0, cam: heroCam },
    { p: T.moveB, cam: () => ({ pos: pr() ? V(4.2, 2.6, 16.5) : V(4.7, 1.95, 12.6), tgt: V(0, 0.85, G.stage.z), fov: pr() ? 50 : 30 }) },
    { p: T.showB, cam: () => ({ pos: pr() ? V(-4.4, 2.8, 16.2) : V(-4.9, 2.2, 12.0), tgt: V(0, 0.85, G.stage.z), fov: pr() ? 50 : 30 }) },
    { p: T.driveA, cam: () => ({ pos: V(2.4, 2.9, 11.2), tgt: V(0, 1.3, -8), fov: pr() ? 52 : 34 }) },
    { p: 0.36, cam: () => ({ pos: V(1.6, 2.6, 5.0), tgt: V(0, 1.2, -12), fov: pr() ? 52 : 36 }) },
    { p: T.driveB, cam: () => ({ pos: V(0.9, 2.3, -8.3), tgt: V(0, 1.2, -16.5), fov: pr() ? 56 : 38 }) },
    { p: T.closeB, cam: () => ({ pos: V(4.6, 2.3, -10.5), tgt: V(0, 1.3, -13.6), fov: pr() ? 56 : 38 }) },
    { p: T.spreadB, cam: () => ({ pos: V(8.5, 3.6, -11.2), tgt: V(0, 2.0, G.container.z), fov: pr() ? 58 : 38 }) },
    // ko'tarilish — kamera konteyner bilan birga, kran portali ichida (oyoqlar va to'sinlardan uzoqda):
    // eshiklar va yon tomon ko'rinadi, orqada port steklari
    { p: 0.545, cam: () => ({ pos: contPos.clone().add(V(7.2, 1.9, 5.6)), tgt: contPos.clone().add(V(0, 1.4, 0)), fov: pr() ? 58 : 38 }) },
    { p: 0.63, cam: () => ({ pos: contPos.clone().add(V(7.4, 2.6, 3.0)), tgt: contPos.clone().add(V(0, 1.2, 0)), fov: pr() ? 58 : 40 }) },
    // konteyner strela bo'ylab kemaga ketadi: kamera portaldan oyoqlar orasidagi "deraza" orqali
    // (to'sinlardan 5 m+ uzoqda) dengiz tomonga chiqadi — konteyner yo'lidan doim 10 m+ narida,
    // quyosh kamera orqasida
    { p: T.moveXB, cam: () => ({ pos: V(42, 34, 4), tgt: contPos.clone().add(V(0, -3, 0)), fov: pr() ? 62 : 42 }) },
    // kemaga tushirish — dengiz tomondan
    { p: T.lowerB, cam: () => ({ pos: V(44, 25, 10), tgt: V(slot.x, slot.y + 0.5, slot.z), fov: pr() ? 60 : 38 }) },
    { p: 0.83, cam: () => ({ pos: V(72, 40, 36), tgt: V(P.shipX - 2, 6, -18), fov: pr() ? 62 : 40 }) },
    // yakun: kema quyosh tomon, ufqqa suzib ketadi
    { p: 1.0, cam: () => ({ pos: V(80, 28, -50), tgt: V(14, 4, 210), fov: pr() ? 60 : 36 }) },
  ];

  function sampleCam(p) {
    let i = 0;
    while (i < KF.length - 2 && p >= KF[i + 1].p) i++;
    const a = KF[i], b = KF[i + 1];
    const t = ease(seg(p, a.p, b.p));
    const ca = a.cam(), cb = b.cam();
    camPos.lerpVectors(ca.pos, cb.pos, t);
    camTgt.lerpVectors(ca.tgt, cb.tgt, t);
    curShift = lerp(ca.shift || 0, cb.shift || 0, t);
    return lerp(ca.fov, cb.fov, t);
  }

  // ---------- tanlangan mashina yo'li ----------
  const bez = (p0, p1, p2, p3, t, out) => {
    const u = 1 - t;
    return out.set(0, 0, 0)
      .addScaledVector(p0, u * u * u).addScaledVector(p1, 3 * u * u * t)
      .addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t);
  };
  const wrapPi = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  const dirOf = (yaw) => V(Math.sin(yaw), 0, Math.cos(yaw));

  /** Yo'l jadvali: uzunlik bo'yicha nuqta, yo'nalish (yaw) va egrilik (k = dyaw/ds) */
  function makePath(p0, p1, p2, p3, n = 160) {
    const xs = new Float32Array(n + 1), zs = new Float32Array(n + 1), len = new Float32Array(n + 1);
    const yaws = new Float32Array(n + 1), ks = new Float32Array(n + 1);
    const q = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      bez(p0, p1, p2, p3, i / n, q);
      xs[i] = q.x; zs[i] = q.z;
      if (i) len[i] = len[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
    }
    for (let i = 0; i <= n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n, i + 1);
      yaws[i] = Math.atan2(xs[b] - xs[a], zs[b] - zs[a]);
    }
    for (let i = 0; i <= n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n, i + 1);
      ks[i] = wrapPi(yaws[b] - yaws[a]) / Math.max(1e-4, len[b] - len[a]);
    }
    const L = len[n];
    return {
      length: L,
      endYaw: yaws[n],
      sample(s, out) {
        s = Math.min(L, Math.max(0, s));
        let lo = 0, hi = n;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (len[m] <= s) lo = m; else hi = m; }
        const t = (s - len[lo]) / Math.max(1e-6, len[hi] - len[lo]);
        out.x = lerp(xs[lo], xs[hi], t);
        out.z = lerp(zs[lo], zs[hi], t);
        out.yaw = lerpAngle(yaws[lo], yaws[hi], t);
        out.k = lerp(ks[lo], ks[hi], t);
        return out;
      },
    };
  }

  /** Tezlik profili: sekin tezlanadi, bir tekis yuradi, yumshoq tormoz beradi (u → yo'l ulushi) */
  function makeProfile(acc, brake, n = 240) {
    const pos = new Float32Array(n + 1);
    for (let i = 1; i <= n; i++) {
      const u = (i - 0.5) / n;
      pos[i] = pos[i - 1] + smooth(0, acc, u) * (1 - smooth(1 - brake, 1, u));
    }
    for (let i = 0; i <= n; i++) pos[i] /= pos[n];
    return (u) => {
      const f = clamp01(u) * n, i = Math.min(n - 1, Math.floor(f));
      return lerp(pos[i], pos[i + 1], f - i);
    };
  }
  const profIn = makeProfile(0.3, 0.42);
  const profOut = makeProfile(0.38, 0.32);
  const EXIT_LEN = G.stage.z - (G.container.z + 0.1);

  // joydan sahnaga: oldinga chiqib, bir tekis yoy bo'ylab burilib, sahnaga kiradi.
  // Koeffitsientlar qo'shni mashinalarga tegmaslik uchun tanlangan (eng kichik burilish radiusi ~6.6 m)
  const pathCache = new Map();
  const pathFor = (i) => {
    if (pathCache.has(i)) return pathCache.get(i);
    const s = G.slots[i];
    const p0 = V(s.x, 0, s.z);
    const p3 = V(G.stage.x, 0, G.stage.z);
    const chord = Math.atan2(p3.x - p0.x, p3.z - p0.z);
    const endYaw = chord + (chord - s.yaw) * 1.1;
    const d = p0.distanceTo(p3);
    const p1 = p0.clone().addScaledVector(dirOf(s.yaw), d * 0.66);
    const p2 = p3.clone().addScaledVector(dirOf(endYaw), -d * 0.25);
    const path = makePath(p0, p1, p2, p3);
    pathCache.set(i, path);
    return path;
  };
  /** Platformada aylanish: kelgan yo'nalishdan ko'rgazma burchagigacha + to'liq aylanish */
  const showTurn = (from) => {
    const r = ((STAGE_YAW - from) % TAU + TAU) % TAU;
    return r < Math.PI ? r + TAU : r;
  };

  // pol balandligi: platformalar va konteyner ostonasi (old va orqa g'ildiraklar alohida o'lchanadi)
  const doorZ = G.container.z + C.L / 2;
  const groundH = (x, z) => {
    let h = A.groundAt(x, z);
    if (Math.abs(x) < C.W / 2 && z < doorZ + 0.8 && z > G.container.z - C.L / 2) {
      h = Math.max(h, C.floorY * smooth(doorZ + 0.6, doorZ - 0.3, z));
    }
    return h;
  };

  const smp = { x: 0, z: 0, yaw: 0, k: 0 };
  // haydash holati: tezlik, tezlanish, kuzov og'ishi, rul
  const drv = { car: -1, x: 0, z: 0, v: 0, acc: 0, pitch: 0, roll: 0, steer: 0 };

  function placeSelected(e, p, dt) {
    const path = pathFor(world.selected);
    let x, z, yaw, k = 0;

    if (p < T.moveB) {
      path.sample(profIn(seg(p, T.moveA, T.moveB)) * path.length, smp);
      x = smp.x; z = smp.z; yaw = smp.yaw; k = smp.k;
    } else if (p < T.driveA) {
      // sahnada — platforma aylanadi (g'ildiraklar turadi)
      x = G.stage.x; z = G.stage.z;
      yaw = path.endYaw + ease(seg(p, T.showA, T.showB)) * showTurn(path.endYaw);
      yaw = lerpAngle(yaw, Math.PI, ease(seg(p, T.turnA, T.turnB)));
    } else if (p < T.driveB) {
      x = 0; z = G.stage.z - profOut(seg(p, T.driveA, T.driveB)) * EXIT_LEN; yaw = Math.PI;
    } else {
      e.root.position.copy(contPos).add(V(0, C.floorY, 0.1));
      e.root.rotation.set(0, Math.PI, 0);
      drv.car = -1;
      return;
    }

    // g'ildiraklar yerga tegib turadi: old/orqa o'q balandligidan kuzov qiyaligi
    const rig = e.rig;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const hf = groundH(x + fx * rig.front, z + fz * rig.front);
    const hb = groundH(x + fx * rig.back, z + fz * rig.back);
    const wb = rig.front - rig.back;
    e.root.position.set(x, hb + (hf - hb) * (-rig.back / wb), z);
    e.root.rotation.set(-Math.atan2(hf - hb, wb), yaw, 0);

    // kinematika: g'ildirak aylanishi, rul, tormoz/tezlanishda kuzov og'ishi
    if (drv.car !== world.selected) Object.assign(drv, { car: world.selected, x, z, v: 0, acc: 0 });
    const ds = (x - drv.x) * fx + (z - drv.z) * fz;
    drv.x = x; drv.z = z;
    rig.roll(ds);
    const v = dt > 0 ? ds / dt : 0;
    drv.acc = damp(drv.acc, dt > 0 ? (v - drv.v) / dt : 0, 6, dt);
    drv.v = v;
    const cl = (a, m) => Math.max(-m, Math.min(m, a));
    drv.pitch = damp(drv.pitch, cl(-drv.acc * 0.004, 0.024), 7, dt);
    drv.roll = damp(drv.roll, cl(v * v * k * 0.0045, 0.03), 7, dt);
    drv.steer = damp(drv.steer, cl(Math.atan(wb * k), 0.6), 9, dt);
    rig.body.rotation.set(drv.pitch, 0, drv.roll);
    rig.steer(drv.steer);
  }

  function parkAtSlot(e) {
    e.root.position.set(e.slot.x, G.ttH, e.slot.z);
    e.root.rotation.set(0, e.slot.yaw, 0);
    e.rig.body.rotation.set(0, 0, 0);
    e.rig.steer(0);
  }

  // ---------- har kadr ----------
  function update(p, dt, time) {
    // kema harakati: prichalda arqonlar bilan bog'langan — deyarli qimirlamaydi (ingichka panjaralar
    // "jimirlamaydi"), ochiq suvga chiqqach chayqalish biroz kuchayadi
    const sail = seg(p, T.sailA, T.sailB);
    const ship = port.shipHolder;
    const sway = 0.35 + 0.65 * smooth(0.15, 0.6, sail);
    ship.position.set(shipBase.x + 6 * sail * sail, shipBase.y + Math.sin(time * 0.6) * 0.06 * sway, shipBase.z + 200 * Math.pow(sail, 1.6));
    ship.rotation.z = Math.sin(time * 0.45) * 0.005 * sway;
    ship.rotation.x = Math.sin(time * 0.33 + 1) * 0.0025 * sway;

    // --- konteyner holati ---
    // nishon — kemadagi uyacha, kema bilan birga chayqaladi: tushayotganda ham unga ergashadi,
    // aks holda oxirida konteyner pastdagi konteynerga kirib-chiqib miltillaydi
    contPos.copy(G.container);
    let low = 0;
    if (p >= T.liftA) {
      const lift = easeSine(seg(p, T.liftA, T.liftB));
      const mx = ease(seg(p, T.moveXA, T.moveXB));
      low = ease(seg(p, T.lowerA, T.lowerB));
      tmpA.copy(ship.position).add(slotLocal);
      contPos.set(lerp(0, tmpA.x, mx), lerp(lift * LIFT_TOP, tmpA.y, low), lerp(G.container.z, tmpA.z, mx));
    }
    container.group.position.copy(contPos);
    container.group.rotation.set(ship.rotation.x * low, 0, ship.rotation.z * low);

    // eshiklar va ichki chiroq
    const closeL = ease(seg(p, T.closeA, T.closeA + 0.035));
    const closeR = ease(seg(p, T.closeA + 0.015, T.closeB));
    container.setDoors(1 - closeL, 1 - closeR);
    container.setInnerLight(seg(p, T.shutA, T.shutB) * (1 - seg(p, T.closeB - 0.01, T.closeB + 0.01)));

    // --- spreader / kran ---
    const spreadVis = p > T.spreadA - 0.005 && p < T.releaseB + 0.01;
    world.spreaderOn = spreadVis; // spreader faqat port kadrida chiziladi
    if (spreadVis) {
      const down = ease(seg(p, T.spreadA, T.spreadB));
      const up = ease(seg(p, T.releaseA, T.releaseB));
      const sy = contPos.y + C.H + (1 - down) * 14 + up * 18;
      spreader.group.position.set(contPos.x, sy, contPos.z);
      spreader.setTop(port.crane.ropeTop);
    }
    port.crane.trolley.position.x = spreadVis ? contPos.x : port.crane.trolley.position.x;
    // kran relslar bo'ylab konteyner bilan birga siljiydi (kemadagi joy biroz boshqa z da)
    port.crane.group.position.z = (slot.z - G.container.z) * ease(seg(p, T.moveXA, T.moveXB));

    // --- dunyolar: garaj/hovli → port (world.render ikkalasini kerakli ulushda chizadi) ---
    const blend = easeSine(seg(p, T.xfadeA, T.xfadeB));
    world.blend = blend;
    const garageOn = blend < 1, portOn = blend > 0;
    // port havosi: suzish davomida ufq uzoqlashadi
    world.worlds.port.fog.far = lerp(1600, 2600, seg(p, 0.8, 1));

    // ekspozitsiya / bloom — dunyolar bilan birga asta o'zgaradi
    // bloom faqat dengizda (quyosh diski); garajda yorug'lik "tuman" bo'lib ketmasin
    world.bloom.enabled = blend > 0.001;
    world.bloom.strength = 0.16 * blend;
    world.bloom.threshold = 5.5;
    world.bloom.radius = 0.3;
    world.renderer.toneMappingExposure = lerp(1.0, 0.92, blend);
    world.final.uniforms.uVignette.value = lerp(0.6, 0.35, blend);

    // --- garaj ichidagi animatsiyalar ---
    if (garageOn) {
      // roll-darvoza va hovlidagi quyosh
      const sh = ease(seg(p, T.shutA, T.shutB)) * (1 - ease(seg(p, T.closeB + 0.005, T.closeB + 0.04)));
      A.setShutter(sh);
      A.outdoor(seg(p, T.shutA - 0.01, T.shutA + 0.02));

      // katta nom
      const show = seg(p, 0.06, 0.1) * (1 - seg(p, T.showB - 0.01, T.turnB));
      world.outline.material.opacity = show * 0.85;
      world.outline.visible = show > 0.001;

      // sahna logosi va chiroqlar
      A.stageLogo.material.opacity = 0.55 * (1 - seg(p, 0.03, 0.08));
      const stageOn = seg(p, 0.05, 0.11) * (1 - seg(p, T.driveA, T.driveA + 0.05));
      A.stageSpot.intensity = 55 * stageOn;
      A.stage.rimMat.color.copy(A.stage.base).multiplyScalar(1 + 2.2 * stageOn);
      A.stage.group.rotation.y = (p >= T.moveB && p < T.driveA) ? ents[world.selected].root.rotation.y : A.stage.group.rotation.y;

      // mashinalar
      const heroLive = p < T.heroEnd;
      const selDim = seg(p, T.heroEnd, 0.09);
      let hoverSpotTarget = null;
      ents.forEach((e, i) => {
        const isSel = i === world.selected;
        const target = heroLive && i === world.hovered ? 1 : 0;
        e.hover = damp(e.hover, target, target ? 6 : 4, dt);
        const h = ease(clamp01(e.hover));

        // aylanish: hover bo'lsa aylanadi, aks holda eng yaqin to'liq aylanishga qaytadi
        if (target) {
          e.spinVel = damp(e.spinVel, 0.85, 3, dt);
          e.spinAngle += e.spinVel * dt;
        } else {
          e.spinVel = damp(e.spinVel, 0, 5, dt);
          const home = Math.round(e.spinAngle / TAU) * TAU;
          e.spinAngle = damp(e.spinAngle + e.spinVel * dt, home, heroLive ? 1.6 : isSel ? 14 : 5, dt);
        }
        e.spin.rotation.y = e.spinAngle;
        e.lift.scale.setScalar(1 + 0.12 * h);
        e.lift.position.y = 0.05 * h;
        e.turntable.group.rotation.y = e.slot.yaw + e.spinAngle;
        e.turntable.rimMat.color.copy(e.turntable.base).multiplyScalar(1 + 3.2 * h - (isSel ? 0 : 0.6 * selDim));

        if (isSel && p > T.heroEnd) placeSelected(e, p, dt);
        else parkAtSlot(e);

        const anyHover = heroLive && world.hovered >= 0;
        let k = 1;
        if (anyHover && i !== world.hovered) k = 0.62;
        if (!isSel) k *= 1 - 0.45 * selDim;
        world.setDim(e, k);
        e.root.visible = !(isSel && p > T.closeB + 0.02); // eshik yopilgach ichidagi mashina ko'rinmaydi
        if (h > 0.02) hoverSpotTarget = e;
      });
      if (hoverSpotTarget) {
        A.hoverSpot.target.position.copy(hoverSpotTarget.root.position);
        A.hoverSpot.position.set(hoverSpotTarget.root.position.x + 1.2, G.ceilY - 0.3, hoverSpotTarget.root.position.z + 2.5);
        A.hoverSpot.intensity = 50 * hoverSpotTarget.hover;
      } else A.hoverSpot.intensity = damp(A.hoverSpot.intensity, 0, 5, dt);

      // showcase paytida garaj "teatr" kabi xiralashadi
      const stageMood = seg(p, 0.03, 0.1) * (1 - seg(p, T.turnB, T.driveA + 0.03));
      A.ambient(1 - 0.3 * stageMood);

      // mobil fokus silliq o'tishi
      world.focusSmooth = damp(world.focusSmooth, world.focus, 5, dt);
    }

    // --- port ---
    if (portOn) {
      port.wake.update(ship.position.x, ship.position.z + port.sternZ, shipBase.z + port.sternZ, seg(p, T.sailA, T.sailA + 0.08));
      // soya kamerasi: konteynerga ergashadi; suzish boshlangach kemaning prichaldagi joyida qotadi
      if (p < T.sailA) shadowFocus.copy(contPos);
      else shadowFocus.copy(slot);
    }

    // --- kamera ---
    const fov = sampleCam(p);
    if (Math.abs(fov - curFov) > 0.01 || Math.abs(curShift - appliedShift) > 1e-4 || world.projDirty) {
      curFov = fov; camera.fov = fov; camera.updateProjectionMatrix();
      // lens shift: rasmni vertikal siljitadi (perspektiva buzilmaydi)
      camera.projectionMatrix.elements[9] = curShift;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      appliedShift = curShift;
      world.projDirty = false;
    }
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    if (world.debugCam) { // faqat sozlash uchun
      camera.position.fromArray(world.debugCam.pos);
      camera.lookAt(new THREE.Vector3().fromArray(world.debugCam.tgt));
    }
  }

  if (world.ship) onShipLoaded();
  return { update, onShipLoaded, slot, shadowFocus };
}

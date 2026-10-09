import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { rand } from './textures.js';

/** Joyida radix-2 FFT (inv — teskari) */
function fft(re, im, n, inv) {
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((2 * Math.PI) / len) * (inv ? 1 : -1);
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const br = re[b] * cr - im[b] * ci, bi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - br; im[b] = im[a] - bi;
        re[a] += br; im[a] += bi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

function ifft2(re, im, n) {
  const rr = new Float64Array(n), ri = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) { rr[x] = re[y * n + x]; ri[x] = im[y * n + x]; }
    fft(rr, ri, n, true);
    for (let x = 0; x < n; x++) { re[y * n + x] = rr[x]; im[y * n + x] = ri[x]; }
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) { rr[y] = re[y * n + x]; ri[y] = im[y * n + x]; }
    fft(rr, ri, n, true);
    for (let y = 0; y < n; y++) { re[y * n + x] = rr[y]; im[y * n + x] = ri[y]; }
  }
}

/**
 * Okean to'lqinlarining normal xaritasi — Phillips spektri (shamol yo'nalishidagi haqiqiy
 * dengiz to'lqinlari, Tessendorf usuli). FFT natijasi o'z-o'zidan takrorlanuvchi (tileable).
 * N — piksel, L — bitta tekstura necha metrni bildiradi, V — shamol tezligi (m/s).
 */
export function makeOceanNormalMap({ N = 256, L = 103, V = 9, wind = [0.86, 0.5], seed = 7 } = {}) {
  const g = 9.81;
  const Lw = (V * V) / g;
  const small = L / N * 0.8; // eng mayda to'lqinlarni so'ndirish
  const wl = Math.hypot(wind[0], wind[1]);
  const wx = wind[0] / wl, wz = wind[1] / wl;
  const r = rand(seed);
  const gauss = () => {
    const u = Math.max(1e-9, r()), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const kOf = (i) => (2 * Math.PI * (i < N / 2 ? i : i - N)) / L;
  const h0r = new Float64Array(N * N), h0i = new Float64Array(N * N);
  for (let m = 0; m < N; m++) {
    for (let n = 0; n < N; n++) {
      const kx = kOf(n), kz = kOf(m);
      const k = Math.hypot(kx, kz);
      if (k < 1e-6) continue;
      const kd = (kx * wx + kz * wz) / k;
      let P = (Math.exp(-1 / ((k * Lw) * (k * Lw))) / (k * k * k * k)) * kd * kd * Math.exp(-(k * small) * (k * small));
      if (kd < 0) P *= 0.12; // shamolga qarshi to'lqinlar kuchsiz
      const s = Math.sqrt(P / 2);
      h0r[m * N + n] = gauss() * s;
      h0i[m * N + n] = gauss() * s;
    }
  }
  // H(k) = h0(k) + conj(h0(-k)) — natija haqiqiy son bo'lishi uchun
  // qiyaliklar: X = i·kx·H, Z = i·kz·H; ikkalasini bitta kompleks IFFT'ga joylaymiz: X + i·Z
  const re = new Float64Array(N * N), im = new Float64Array(N * N);
  for (let m = 0; m < N; m++) {
    for (let n = 0; n < N; n++) {
      const i = m * N + n, j = ((N - m) % N) * N + ((N - n) % N);
      const Hr = h0r[i] + h0r[j], Hi = h0i[i] - h0i[j];
      const kx = kOf(n), kz = kOf(m);
      // i·kx·H = (-kx·Hi) + i(kx·Hr);  i·(i·kz·H) = -(kz·Hr) + i(-kz·Hi)
      re[i] = -kx * Hi - kz * Hr;
      im[i] = kx * Hr - kz * Hi;
    }
  }
  ifft2(re, im, N);
  let ss = 0;
  for (let i = 0; i < N * N; i++) ss += re[i] * re[i] + im[i] * im[i];
  const scale = 0.26 / Math.sqrt(ss / (N * N)); // o'rtacha qiyalik ~0.26
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const sx = re[i] * scale, sz = im[i] * scale;
    const l = Math.hypot(sx, 1, sz);
    // Water shaderi: xzy — R = x, G = z, B = yuqori
    data[i * 4] = (-sx / l * 0.5 + 0.5) * 255;
    data[i * 4 + 1] = (-sz / l * 0.5 + 0.5) * 255;
    data[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Aks beruvchi okean: kema, kran va osmon suvda aks etadi (to'lqinlar bilan buziladi),
 * Frenel, quyosh yo'lakchasi, soyalar. three.js Water asosida, shaderi biroz boyitilgan:
 *  - uzoqda to'lqin normallari silliqlanadi (ufqda aliasing bo'lmasin, akslar tiniqroq);
 *  - suv rangi chuqur ko'k + to'lqin cho'qqilarida yorug'lik o'tishi (subsurface).
 */
export function createOcean({ sunDir, sunColor = '#fff3df', waterColor = '#0b2c45', size = 9000, reflectRes = 512, y = 0 }) {
  const normals = makeOceanNormalMap();
  const water = new Water(new THREE.PlaneGeometry(size, size), {
    textureWidth: reflectRes,
    textureHeight: reflectRes,
    waterNormals: normals,
    sunDirection: sunDir.clone().normalize(),
    sunColor: new THREE.Color(sunColor),
    waterColor: new THREE.Color(waterColor),
    distortionScale: 2.4,
    fog: true,
    clipBias: 0.002,
  });
  const mat = water.material;
  mat.fragmentShader = mat.fragmentShader
    .replace('vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );', `
      float camDist = length( eye - worldPosition.xyz );
      vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );
      surfaceNormal = normalize( mix( surfaceNormal, vec3( 0.0, 1.0, 0.0 ), smoothstep( 180.0, 2600.0, camDist ) * 0.72 ) );`)
    .replace('vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;', `
      vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;
      // to'lqin yon tomonida quyosh nuri suv ichidan o'tadi (yashil-ko'k porlash)
      float sss = pow( max( 0.0, dot( eyeDirection, -sunDirection ) ), 3.0 ) * max( 0.0, surfaceNormal.x * 0.5 + surfaceNormal.z * 0.5 + 0.2 );
      scatter += vec3( 0.05, 0.22, 0.24 ) * sss * 0.6 + waterColor * 0.35;`);
  mat.uniforms.size.value = 1.0;
  water.rotation.x = -Math.PI / 2;
  water.position.y = y;
  water.receiveShadow = true;
  water.frustumCulled = false;

  return {
    mesh: water,
    uniforms: mat.uniforms,
    update(time) { mat.uniforms.time.value = time * 0.9; },
  };
}

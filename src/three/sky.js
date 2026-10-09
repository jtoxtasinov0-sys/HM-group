import * as THREE from 'three';

/**
 * Osmon: tepada chuqur ko'k, ufqqa qarab ochiladi, quyosh atrofida oltin nur (past quyoshda
 * ufq bo'ylab tarqaladi), quyosh diski va to'p-to'p bulutlar (quyosh tomoni oltin rangda yoritiladi).
 * Ranglar qo'lda boshqariladi — fizik modellar past quyoshda osmonni oqartirib yuboradi.
 *
 * uFade / uFadeColor — tuman ichida osmonni bir rangga "eritish" (hikoya o'tishlari uchun).
 */
const SKY_FRAG = /* glsl */`
  uniform vec3 sunPosition;
  uniform float time;
  uniform float uGain;
  uniform float uFade;
  uniform vec3 uFadeColor;
  uniform float showSunDisc;
  uniform float cloudCoverage;
  uniform float cloudScale;
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunGlow;
  uniform vec3 uSunColor;
  varying vec3 vWorldPosition;

  vec2 grad2(vec2 i) {
    vec3 p = fract(i.xyx * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.xx + p.yz) * p.zy) * 2.0 - 1.0;
  }
  float gnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = dot(grad2(i), f);
    float b = dot(grad2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
    float c = dot(grad2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
    float d = dot(grad2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.6;
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 1.0;
    for (int i = 0; i < 5; i++) { s += a * gnoise(p); a *= 0.5; p = p * 2.03 + 7.1; }
    return s;
  }

  void main() {
    vec3 d = normalize(vWorldPosition - cameraPosition);
    vec3 sun = normalize(sunPosition);
    float hp = max(d.y, 0.0);
    float cs = max(dot(d, sun), 0.0);

    // ko'k gradient
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.16, hp));
    col = mix(col, uZenith, smoothstep(0.1, 0.8, hp));
    // quyosh atrofidagi nur: past quyoshda ufq bo'ylab keng oltin tasma
    float band = exp(-hp * 9.0);
    float sunLow = 1.0 - smoothstep(0.05, 0.6, sun.y);
    col += uSunGlow * (pow(cs, 3.0) * band * 0.38 * sunLow + pow(cs, 10.0) * 0.45 + pow(cs, 80.0) * 0.9 + pow(cs, 900.0) * 2.5);
    // quyosh diski
    col += uSunColor * smoothstep(0.99986, 0.99993, cs) * 14.0 * showSunDisc;

    // bulutlar
    if (d.y > 0.0 && cloudCoverage > 0.0) {
      vec2 uv = d.xz / (d.y * 0.55 + 0.04) * cloudScale + vec2(time * 0.004, time * 0.0015);
      float n = fbm(uv) * 0.6 + 0.5;
      float region = gnoise(uv * 0.23) * 0.35 + 0.5;
      float cov = clamp(cloudCoverage + (region - 0.5) * 0.7, 0.0, 1.0);
      float th = 1.0 - cov;
      float m = smoothstep(th, th + 0.22, n) * smoothstep(0.0, 0.06, d.y);
      float dens = clamp((n - th) * 3.0, 0.0, 1.0);
      vec3 lit = mix(vec3(0.92, 0.94, 0.97), uSunGlow * 1.25 + 0.25, pow(cs, 4.0) * 0.85);
      vec3 shade = mix(uMid * 0.8, uHorizon * 0.7, 0.4);
      vec3 cc = mix(lit, shade, dens * 0.55);
      cc += uSunGlow * pow(cs, 12.0) * (1.0 - dens) * 1.2;      // quyosh tomonidagi yorqin chet
      // uzoqdagi bulutlar havoda eriydi
      cc = mix(col, cc, smoothstep(0.0, 0.25, d.y) * 0.6 + 0.4);
      col = mix(col, cc, m * 0.92);
    }
    // ufqdan pastda (akslar uchun): to'q dengiz / yer
    col = mix(col, uGround, smoothstep(0.0, -0.06, d.y));

    col = min(col * uGain, vec3(8.0));
    col = mix(col, uFadeColor, uFade);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SKY_VERT = /* glsl */`
  varying vec3 vWorldPosition;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    gl_Position.z = gl_Position.w; // har doim eng uzoqda
  }
`;

/**
 * opts: { sunDir, zenith, mid, horizon, ground, sunGlow, sunColor, clouds, cloudScale, gain }
 */
export function createSky(opts = {}) {
  const c = (v, d) => new THREE.Color(v || d);
  const uniforms = {
    sunPosition: { value: opts.sunDir.clone().normalize() },
    time: { value: 0 },
    uGain: { value: opts.gain ?? 1 },
    uFade: { value: 0 },
    uFadeColor: { value: new THREE.Color('#d3e1ef') },
    showSunDisc: { value: 1 },
    cloudCoverage: { value: opts.clouds ?? 0.35 },
    cloudScale: { value: opts.cloudScale ?? 1.4 },
    uZenith: { value: c(opts.zenith, '#3567a8') },
    uMid: { value: c(opts.mid, '#7aa6d6') },
    uHorizon: { value: c(opts.horizon, '#cfdcea') },
    uGround: { value: c(opts.ground, '#22384c') },
    uSunGlow: { value: c(opts.sunGlow, '#ffcf8f') },
    uSunColor: { value: c(opts.sunColor, '#fff3d8') },
  };
  const material = new THREE.ShaderMaterial({
    name: 'HMSky',
    uniforms,
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.scale.setScalar(1800);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  return {
    mesh,
    uniforms,
    sunDir: uniforms.sunPosition.value,
    /** kamerani kuzatadi (osmon har doim cheksiz uzoqda) + bulutlar siljiydi */
    update(time, camera) {
      mesh.position.copy(camera.position);
      uniforms.time.value = time;
    },
  };
}

/**
 * Osmondan muhit xaritasi (PBR akslar va yoritish uchun). Quyosh diski o'chiriladi —
 * aks ichida "yorqin nuqta" chiqmasin. gain — osmonga nisbatan yorqinlik (to'g'ridan-to'g'ri
 * quyosh nuri alohida chiroq bilan beriladi, shuning uchun muhit biroz xiraroq bo'lishi kerak).
 */
export function createSkyEnvMap(renderer, sky, gain = 0.5) {
  const scene = new THREE.Scene();
  const m = sky.mesh.material.clone(); // uniformlar ham nusxalanadi
  m.uniforms.showSunDisc.value = 0;
  m.uniforms.uGain.value *= gain;
  m.uniforms.uFade.value = 0;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m);
  mesh.scale.setScalar(50);
  scene.add(mesh);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02, 0.1, 200);
  pmrem.dispose();
  m.dispose();
  return rt.texture;
}

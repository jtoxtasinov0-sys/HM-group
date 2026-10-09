import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

/**
 * Fizik osmon (Preetham modeli: atmosferada yorug'lik sochilishi) + bulutlar.
 * three.js Sky shaderiga ikki narsa qo'shilgan:
 *  - uGain — sahna ekspozitsiyasiga moslash (asl shader juda xira chiqaradi);
 *  - uFade / uFadeColor — tuman ichida osmonni bir rangga "eritish" (hikoya o'tishlari uchun).
 *
 * opts: { sunDir, turbidity, rayleigh, mie, mieG, clouds, cloudScale, gain }
 */
export function createSky(opts = {}) {
  const shader = Sky.SkyShader;
  const uniforms = THREE.UniformsUtils.clone(shader.uniforms);
  uniforms.turbidity.value = opts.turbidity ?? 3.2;
  uniforms.rayleigh.value = opts.rayleigh ?? 1.4;
  uniforms.mieCoefficient.value = opts.mie ?? 0.004;
  uniforms.mieDirectionalG.value = opts.mieG ?? 0.82;
  uniforms.sunPosition.value.copy(opts.sunDir).normalize();
  uniforms.cloudCoverage.value = opts.clouds ?? 0.32;
  uniforms.cloudDensity.value = opts.cloudDensity ?? 0.55;
  uniforms.cloudScale.value = opts.cloudScale ?? 0.00018;
  uniforms.cloudSpeed.value = 0.00004;
  uniforms.cloudElevation.value = 0.45;
  uniforms.uGain = { value: opts.gain ?? 2.2 };
  uniforms.uFade = { value: 0 };
  uniforms.uFadeColor = { value: new THREE.Color('#d3e1ef') };

  const fragmentShader = shader.fragmentShader
    .replace('uniform float time;', 'uniform float time;\nuniform float uGain;\nuniform float uFade;\nuniform vec3 uFadeColor;')
    .replace('gl_FragColor = vec4( texColor, 1.0 );', `
      // quyosh diski juda yorqin (minglab) — bloom butun kadrni yutmasligi uchun cheklanadi
      texColor = min( texColor * uGain, vec3( 4.5 ) );
      texColor = mix( texColor, uFadeColor, uFade );
      gl_FragColor = vec4( texColor, 1.0 );`);

  const material = new THREE.ShaderMaterial({
    name: 'HMSky',
    uniforms,
    vertexShader: shader.vertexShader,
    fragmentShader,
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
  // pastki yarim shar: yer (osmon pastida juda qorong'i chiqmasin)
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(40, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(sky.groundColor || '#5d6670') }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  scene.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02, 0.1, 200);
  pmrem.dispose();
  m.dispose();
  ground.geometry.dispose();
  ground.material.dispose();
  return rt.texture;
}

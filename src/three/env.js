import * as THREE from 'three';

const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

/**
 * Garaj aksi (reflection) uchun sun'iy "studiya": oq dumaloq xona, shiftda katta yorug' doira,
 * pastda kulrang pol chizig'i (ufq). Mashina lakida yumshoq oq akslar beradi.
 */
export function createGarageEnv(renderer) {
  const scene = new THREE.Scene();
  // devorlar: tepasi yorug'roq, pasti biroz quyuqroq — lakda "ufq" chizig'i paydo bo'ladi
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(24, 24, 16, 64, 8, true),
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }),
  );
  const pa = wall.geometry.attributes.position;
  const cols = [];
  const top = hdr('#f1f3f6', 1.25), low = hdr('#c9ced5', 0.9);
  for (let i = 0; i < pa.count; i++) {
    const t = THREE.MathUtils.smoothstep(pa.getY(i), -8, 8);
    const c = low.clone().lerp(top, t);
    cols.push(c.r, c.g, c.b);
  }
  wall.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  wall.position.y = 6;
  scene.add(wall);

  const ceil = new THREE.Mesh(new THREE.CircleGeometry(24, 64), new THREE.MeshBasicMaterial({ color: hdr('#eef0f3', 1.1), side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 13.9;
  scene.add(ceil);
  // katta yorug' doira (skylight)
  const sky = new THREE.Mesh(new THREE.CircleGeometry(7.5, 64), new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 7), side: THREE.DoubleSide }));
  sky.rotation.x = Math.PI / 2; sky.position.y = 13.8;
  scene.add(sky);
  // kichik doiralar va nuqtali chiroqlar
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const d = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 3.5), side: THREE.DoubleSide }));
    d.rotation.x = Math.PI / 2; d.position.set(Math.cos(a) * 15, 13.7, Math.sin(a) * 15);
    scene.add(d);
  }
  // yon panellar — kuzov yon tomonida uzun yumshoq yorug' chiziq
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(26, 1.6), new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 2.2), side: THREE.DoubleSide }));
    p.position.set(s * 23, 3.2, 0); p.rotation.y = Math.PI / 2;
    scene.add(p);
  }
  // pol — kulrang (kuzovning pastki qismida to'qroq aks)
  const floor = new THREE.Mesh(new THREE.CircleGeometry(24, 64), new THREE.MeshBasicMaterial({ color: hdr('#9ba2ab', 1) }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.9;
  scene.add(floor);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.015);
  pmrem.dispose();
  scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return rt.texture;
}

/** Osmon gradienti — dengiz sahnasi va uning aksi uchun umumiy shader funksiyasi */
export const SKY_GLSL = /* glsl */`
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  vec3 skyColor(vec3 dir) {
    float h = dir.y;
    vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
    col = mix(col, uGround, smoothstep(0.0, -0.08, h));
    float s = max(dot(normalize(dir), normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(s, 900.0) * 6.0 + pow(s, 28.0) * 0.35 + pow(s, 4.0) * 0.08);
    // yengil bulut qatlami — gorizontga yaqin
    float band = exp(-pow((h - 0.06) * 14.0, 2.0));
    col = mix(col, vec3(1.0), band * 0.18);
    return col;
  }
`;

export function makeSkyUniforms() {
  return {
    uZenith: { value: new THREE.Color('#2a5a94') },
    uHorizon: { value: new THREE.Color('#dce8f5') },
    uGround: { value: new THREE.Color('#9fb5cc') },
    uSunDir: { value: new THREE.Vector3(-0.22, 0.12, 0.97).normalize() },
    uSunColor: { value: new THREE.Color('#fffaf0') },
    uFade: { value: 0 },
    uFadeColor: { value: new THREE.Color('#07111f') },
  };
}

export function makeSkyMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform float uFade;
      uniform vec3 uFadeColor;
      ${SKY_GLSL}
      void main() {
        vec3 c = skyColor(normalize(vDir));
        gl_FragColor = vec4(mix(c, uFadeColor, uFade), 1.0);
      }`,
  });
}

export function createSkyEnv(renderer, uniforms) {
  const scene = new THREE.Scene();
  const u = THREE.UniformsUtils.clone(uniforms);
  u.uFade.value = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    side: THREE.BackSide,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      ${SKY_GLSL}
      void main() { gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0); }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  mat.dispose();
  return rt.texture;
}

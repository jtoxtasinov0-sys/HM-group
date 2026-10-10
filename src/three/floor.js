import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

/**
 * Yaltiroq pol: oddiy PBR material + tekis aks (planar reflection).
 * Reflector faqat aks teksturasini chizadi, rangni esa MeshStandardMaterial beradi.
 */
export function createGlossyFloor({ width, depth, color, map, roughnessMap, repeat = 1, roughness = 0.4, strength = 0.55, resolution = 0.5, reflect = true, seams = true }) {
  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.1, map, roughnessMap, envMapIntensity: 0.3 });
  for (const t of [map, roughnessMap]) if (t) t.repeat.set(repeat * width / depth, repeat);
  // plitka choklarida aks so'nadi; choksiz polda — g'adirroq joylarda
  const seamGLSL = seams
    ? '#ifdef USE_MAP\n seam = smoothstep(0.75, 0.95, texture2D(map, vMapUv).r);\n #endif'
    : '#ifdef USE_ROUGHNESSMAP\n seam = 1.0 - 0.6 * smoothstep(0.2, 0.45, texture2D(roughnessMap, vRoughnessMapUv).g);\n #endif';

  if (!reflect) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    return { mesh, setSize() {}, setReflect() {}, uniforms: null };
  }

  const w = Math.round(window.innerWidth * resolution);
  const h = Math.round(window.innerHeight * resolution);
  const mesh = new Reflector(geo, { textureWidth: w, textureHeight: h, multisample: 0, clipBias: 0.003 });
  const textureMatrix = mesh.material.uniforms.textureMatrix.value;
  const rt = mesh.getRenderTarget();
  mesh.material.dispose();

  const uniforms = {
    tReflect: { value: rt.texture },
    uTexMatrix: { value: textureMatrix },
    uReflStrength: { value: strength },
    uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uTexMatrix;\nvarying vec4 vReflUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvReflUv = uTexMatrix * vec4(position, 1.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tReflect;
        uniform float uReflStrength;
        uniform vec2 uTexel;
        varying vec4 vReflUv;
        vec3 sampleRefl(vec2 uv) {
          vec3 c = texture2D(tReflect, uv).rgb * 0.36;
          c += texture2D(tReflect, uv + vec2( uTexel.x * 1.5, 0.0)).rgb * 0.16;
          c += texture2D(tReflect, uv + vec2(-uTexel.x * 1.5, 0.0)).rgb * 0.16;
          c += texture2D(tReflect, uv + vec2(0.0,  uTexel.y * 2.0)).rgb * 0.16;
          c += texture2D(tReflect, uv + vec2(0.0, -uTexel.y * 2.0)).rgb * 0.16;
          return c;
        }`)
      .replace('#include <opaque_fragment>', `
        {
          vec2 ruv = vReflUv.xy / vReflUv.w;
          float seam = 1.0;
          ${seamGLSL}
          float ndv = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
          float fres = 0.25 + 0.75 * pow(1.0 - ndv, 3.0);
          outgoingLight += sampleRefl(ruv) * uReflStrength * seam * fres;
        }
        #include <opaque_fragment>`);
  };
  mesh.material = mat;
  mesh.rotation.x = -Math.PI / 2;
  const renderReflection = mesh.onBeforeRender;

  return {
    mesh,
    uniforms,
    /** Kuchsiz GPU'da aks o'chiriladi: sahna kadrda bir marta kam chiziladi */
    setReflect(on) {
      mesh.onBeforeRender = on ? renderReflection : () => {};
      uniforms.uReflStrength.value = on ? strength : 0;
    },
    setSize(width2, height2) {
      const rw = Math.round(width2 * resolution), rh = Math.round(height2 * resolution);
      rt.setSize(rw, rh);
      uniforms.uTexel.value.set(1 / rw, 1 / rh);
    },
  };
}

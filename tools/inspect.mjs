import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder } from 'meshoptimizer';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.decoder': MeshoptDecoder,
});
await MeshoptDecoder.ready;
const file = process.argv[2];
const doc = await io.read(file);
const root = doc.getRoot();
const scene = root.getDefaultScene() || root.listScenes()[0];
const b = getBounds(scene);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  const idx = p.getIndices(); const pos = p.getAttribute('POSITION');
  tris += idx ? idx.getCount() / 3 : pos.getCount() / 3;
}
console.log('FILE', file);
console.log('bounds min', b.min.map(v=>v.toFixed(2)).join(','), 'max', b.max.map(v=>v.toFixed(2)).join(','));
console.log('size', b.max.map((v,i)=>(v-b.min[i]).toFixed(2)).join(' x '));
console.log('nodes', root.listNodes().length, 'meshes', root.listMeshes().length, 'tris', Math.round(tris), 'anims', root.listAnimations().map(a=>a.getName()).join('|'));
console.log('extensions', root.listExtensionsUsed().map(e=>e.extensionName).join(','));
const texs = root.listTextures();
let texBytes = 0;
for (const t of texs) texBytes += t.getImage()?.byteLength || 0;
console.log('textures', texs.length, 'bytes', (texBytes/1e6).toFixed(1)+'MB', texs.slice(0,40).map(t=>`${t.getName()||t.getURI()}:${t.getSize()?.join('x')}`).join(' ; '));
console.log('materials:');
for (const m of root.listMaterials()) {
  const c = m.getBaseColorFactor().map(v=>v.toFixed(2)).join(',');
  console.log(`  - "${m.getName()}" col(${c}) met ${m.getMetallicFactor().toFixed(2)} rough ${m.getRoughnessFactor().toFixed(2)} alpha ${m.getAlphaMode()} tex:${m.getBaseColorTexture()?'B':''}${m.getNormalTexture()?'N':''}${m.getMetallicRoughnessTexture()?'MR':''}${m.getEmissiveTexture()?'E':''}`);
}
const top = scene.listChildren();
const pr = (n, d) => { if (d > 3) return; const kids = n.listChildren(); console.log('  '.repeat(d) + '* ' + n.getName() + (n.getMesh() ? ' [mesh]' : '') + (kids.length? ` (${kids.length})`:'')); if (kids.length < 40) kids.forEach(k => pr(k, d+1)); };
console.log('tree:'); top.forEach(n => pr(n, 1));

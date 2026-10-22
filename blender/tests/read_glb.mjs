// Prints what a GLB really contains (bounds, texture count, animations) as JSON.
// Used by the Blender tests so they check the exported file, not Blender's memory of it.
import { NodeIO } from '@gltf-transform/core';

const [path] = process.argv.slice(2);
const doc = await new NodeIO().read(path);
const root = doc.getRoot();

const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const v = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); }
    }
  }
}

const animations = root.listAnimations().map((a) => {
  const rotation = a.listChannels().find((c) => c.getTargetPath() === 'rotation');
  let last = null;
  if (rotation) {
    const out = rotation.getSampler().getOutput();
    last = out.getElement(out.getCount() - 1, [0, 0, 0, 0]);
  }
  return { name: a.getName(), channels: a.listChannels().length, rotation_last: last };
});

console.log(JSON.stringify({ bounds: { min, max }, textures: root.listTextures().length, animations }));

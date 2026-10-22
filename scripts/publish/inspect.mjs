// Reads a GLB and checks it against a budget. The numbers come from the file itself.
import { statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import draco3d from 'draco3d';

export const DEFAULT_BUDGET = { maxMb: 3, maxTriangles: 30000, maxTexture: 1024 };

export async function inspectGlb(file) {
  // The decoder is only needed to read a Draco-compressed file, which is what publish produces.
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression, EXTTextureWebP])
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const doc = await io.read(file);
  const root = doc.getRoot();

  let triangles = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const count = indices ? indices.getCount() : prim.getAttribute('POSITION').getCount();
      triangles += Math.floor(count / 3);
    }
  }

  const textures = root.listTextures().map((t) => {
    const [width, height] = t.getSize() ?? [0, 0];
    return { name: t.getName(), mime: t.getMimeType(), width, height };
  });

  return {
    file,
    bytes: statSync(file).size,
    triangles,
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    textures,
    animations: root.listAnimations().map((a) => a.getName()),
    extensions: root.listExtensionsUsed().map((e) => e.extensionName),
  };
}

// Returns a list of problems; empty means the file is within budget.
export function checkBudget(report, budget = DEFAULT_BUDGET) {
  const problems = [];
  const mb = report.bytes / (1024 * 1024);
  if (mb > budget.maxMb) problems.push(`file is ${mb.toFixed(2)} MB, budget is ${budget.maxMb} MB`);
  if (report.triangles > budget.maxTriangles) problems.push(`${report.triangles} triangles, budget is ${budget.maxTriangles}`);
  for (const t of report.textures) {
    if (Math.max(t.width, t.height) > budget.maxTexture) problems.push(`texture ${t.name || '(unnamed)'} is ${t.width}×${t.height}, budget is ${budget.maxTexture}px`);
  }
  // A part animation always comes as an open/close pair, so the viewer can play it both ways.
  const clips = new Set(report.animations);
  for (const name of report.animations) {
    const m = name.match(/^(.+)\.(open|close)$/);
    if (m && !clips.has(`${m[1]}.${m[2] === 'open' ? 'close' : 'open'}`)) problems.push(`clip ${name} has no matching ${m[2] === 'open' ? 'close' : 'open'} clip`);
  }
  return problems;
}

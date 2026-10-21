import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { buildFlat, imageSize } from './flat.mjs';

const png = readFileSync(new URL('../../design/kodak.png', import.meta.url));
const jpg = readFileSync(new URL('../../design/dig-photo.jpg', import.meta.url));

const bounds = (doc) => {
  const acc = doc.getRoot().listMeshes()[0].listPrimitives().map((p) => p.getAttribute('POSITION'));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const a of acc) { const v = [0, 0, 0]; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); v.forEach((x, k) => { min[k] = Math.min(min[k], x); max[k] = Math.max(max[k], x); }); } }
  return max.map((m, k) => m - min[k]);
};

test('imageSize reads PNG and JPEG headers', () => {
  assert.deepEqual(imageSize(png), { w: 443, h: 327, mime: 'image/png' });
  assert.deepEqual(imageSize(jpg), { w: 1600, h: 901, mime: 'image/jpeg' });
  assert.throws(() => imageSize(Buffer.from('nope')));
});

test('a card with a measured size becomes a 100 × 74 × 1.2 mm slab with three materials', async () => {
  const { doc, assumedSize } = buildFlat({ id: '017', front: png, back: jpg, kind: 'card', sizeMm: [100, 74] });
  assert.equal(assumedSize, false);
  assert.equal(doc.getRoot().listMaterials().length, 3);
  assert.equal(doc.getRoot().listTextures().length, 2);
  const [w, h, t] = bounds(doc);
  assert.ok(Math.abs(w - 0.1) < 1e-6 && Math.abs(h - 0.074) < 1e-6 && Math.abs(t - 0.0012) < 1e-6);
});

test('without a measured size the long side is assumed 200 mm and flagged', () => {
  const { doc, assumedSize, sizeMm } = buildFlat({ id: '011', front: jpg, kind: 'sheet' });
  assert.equal(assumedSize, true);
  assert.ok(Math.abs(Math.max(sizeMm[0], sizeMm[1]) - 200) < 1e-6);
  assert.equal(doc.getRoot().listTextures().length, 1); // no back photo
});

test('a disc is round, with caps and an edge strip', () => {
  const { doc } = buildFlat({ id: '001', front: png, kind: 'disc', sizeMm: [180, 180] });
  const [w, h, t] = bounds(doc);
  assert.ok(Math.abs(w - 0.18) < 1e-3 && Math.abs(h - 0.18) < 1e-3 && Math.abs(t - 0.0015) < 1e-6);
});

test('the GLB survives a write and read round trip', async () => {
  const { doc } = buildFlat({ id: '010', front: png, back: png, kind: 'booklet', sizeMm: [105, 170] });
  const dir = mkdtempSync(join(tmpdir(), 'flat-'));
  const io = new NodeIO();
  await io.write(join(dir, '010.glb'), doc);
  const back = await io.read(join(dir, '010.glb'));
  assert.equal(back.getRoot().listMeshes()[0].listPrimitives().length, 3);
  assert.equal(back.getRoot().listTextures().length, 2);
});

test('an unknown kind is rejected', () => {
  assert.throws(() => buildFlat({ id: 'x', front: png, kind: 'brick' }), /Unknown kind/);
});

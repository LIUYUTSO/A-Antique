import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { buildFlat } from '../flat/flat.mjs';
import { DEFAULT_BUDGET, checkBudget, inspectGlb } from './inspect.mjs';
import { pickSource } from './run.mjs';

import { readFileSync } from 'node:fs';
const png = readFileSync(new URL('../../design/kodak.png', import.meta.url));

// A PNG header is all the size reader needs, so a big texture costs nothing to fake.
function fakePng(width, height) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

async function writeGlb(dir, name, front) {
  const { doc } = buildFlat({ id: '017', front, kind: 'card', sizeMm: [100, 74] });
  const file = join(dir, name);
  await new NodeIO().write(file, doc);
  return file;
}

test('inspectGlb reports triangles, textures and size from the file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'inspect-'));
  const r = await inspectGlb(await writeGlb(dir, 'a.glb', png));
  assert.equal(r.triangles, 12); // six faces, two triangles each
  assert.equal(r.textures.length, 1);
  assert.deepEqual([r.textures[0].width, r.textures[0].height], [443, 327]);
  assert.ok(r.bytes > 0);
  assert.deepEqual(r.animations, []);
});

test('a small model is within the default budget', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'budget-'));
  const r = await inspectGlb(await writeGlb(dir, 'a.glb', png));
  assert.deepEqual(checkBudget(r), []);
});

test('too many triangles, too big a file and an oversized texture are each reported', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'budget-'));
  const r = await inspectGlb(await writeGlb(dir, 'big.glb', fakePng(2048, 2048)));
  const problems = checkBudget(r, { maxMb: 0.00001, maxTriangles: 5, maxTexture: 1024 });
  assert.equal(problems.length, 3, problems.join(' | '));
  assert.match(problems.join(' '), /2048×2048/);
  assert.match(problems.join(' '), /12 triangles/);
});

test('a clip without its pair is a problem, a full pair is fine', () => {
  const base = { bytes: 1000, triangles: 10, textures: [] };
  assert.deepEqual(checkBudget({ ...base, animations: ['lid.open', 'lid.close'] }), []);
  assert.match(checkBudget({ ...base, animations: ['lid.open'] })[0], /no matching close/);
  assert.match(checkBudget({ ...base, animations: ['lid.close'] })[0], /no matching open/);
  assert.deepEqual(checkBudget({ ...base, animations: ['spin'] }), []);
});

test('the default budget is 3 MB, 30k triangles, 1024px', () => {
  assert.deepEqual(DEFAULT_BUDGET, { maxMb: 3, maxTriangles: 30000, maxTexture: 1024 });
});

test('pickSource takes the most finished stage that exists', () => {
  const root = mkdtempSync(join(tmpdir(), 'pick-'));
  for (const s of ['models', 'clean']) { mkdirSync(join(root, 'out', s), { recursive: true }); writeFileSync(join(root, 'out', s, '012.glb'), 'x'); }
  assert.equal(pickSource(root, '012').stage, 'clean');
  assert.equal(pickSource(root, '012', 'models').stage, 'models');
  mkdirSync(join(root, 'out', 'final'), { recursive: true });
  writeFileSync(join(root, 'out', 'final', '012.glb'), 'x');
  assert.equal(pickSource(root, '012').stage, 'final');
  assert.equal(pickSource(root, '099'), null);
  assert.equal(pickSource(root, '012', 'final').stage, 'final');
});

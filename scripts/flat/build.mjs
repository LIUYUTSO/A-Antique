#!/usr/bin/env node
// Usage: node scripts/flat/build.mjs <id|all> [--compress] [--upload]
// Reads shoot/<id>/still.(jpg|png) as the front, shoot/<id>/back.(jpg|png) as the optional back,
// and kind / sizeMm from data/objects.json. Writes out/models/<id>.glb.
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { buildFlat } from './flat.mjs';
import { compressGlb, uploadToR2 } from '../meshy/pipeline.mjs';

try { process.loadEnvFile('.env'); } catch { /* no .env */ }

const firstExisting = (dir, names) => names.map((n) => join(dir, n)).find(existsSync);

async function main() {
  const argv = process.argv.slice(2);
  const target = argv.find((a) => !a.startsWith('--'));
  const compress = argv.includes('--compress');
  const upload = argv.includes('--upload');
  if (!target) throw new Error('Pass an object id (e.g. 010) or "all"');

  const root = process.cwd();
  const { objects } = JSON.parse(readFileSync('data/objects.json', 'utf8'));
  const flat = objects.filter((o) => o.method === 'flat' && (target === 'all' || o.id === target));
  if (flat.length === 0) throw new Error(`No flat object matches "${target}". Only method "flat" objects are built here.`);

  const log = (m) => console.log(m);
  let built = 0;
  for (const o of flat) {
    const dir = join(root, 'shoot', o.id);
    const front = firstExisting(dir, ['still.jpg', 'still.jpeg', 'still.png']);
    if (!front) { log(`${o.id}  skip  no shoot/${o.id}/still.jpg`); continue; }
    const back = firstExisting(dir, ['back.jpg', 'back.jpeg', 'back.png']);
    const { doc, assumedSize, sizeMm } = buildFlat({
      id: o.id, kind: o.kind, sizeMm: o.sizeMm ?? null, thicknessMm: o.thicknessMm ?? null,
      front: readFileSync(front), back: back ? readFileSync(back) : null,
    });
    const out = join(root, 'out', 'models', `${o.id}.glb`);
    mkdirSync(join(root, 'out', 'models'), { recursive: true });
    await new NodeIO().write(out, doc);
    const dims = sizeMm.map((v) => v.toFixed(1)).join(' × ');
    log(`${o.id}  built  ${o.kind}  ${dims} mm${assumedSize ? '  (size not measured, long side assumed 200 mm)' : ''}${back ? '' : '  (no back photo)'}`);
    if (compress) compressGlb(out, log);
    if (upload) await uploadToR2({ root, id: o.id, log });
    built++;
  }
  log(`\n${built} built, ${flat.length - built} skipped. No Meshy credits used.`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });

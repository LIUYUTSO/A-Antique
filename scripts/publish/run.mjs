#!/usr/bin/env node
// Final step before the site: compress, check the budget, optionally upload.
// Usage: node scripts/publish/run.mjs <id> [--stage final|clean|models] [--max-mb 3] [--max-triangles 30000]
//        [--upload] [--dry-run]
//
// Reads the most finished GLB that exists (out/final, then out/clean, then out/models), never changes it,
// and writes the compressed result to out/publish/<id>.glb with a report next to it.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { compressGlb, uploadToR2 } from '../meshy/pipeline.mjs';
import { DEFAULT_BUDGET, checkBudget, inspectGlb } from './inspect.mjs';

try { process.loadEnvFile('.env'); } catch { /* no .env */ }

const STAGES = ['final', 'clean', 'models'];

export function pickSource(root, id, stage) {
  const order = stage ? [stage] : STAGES;
  for (const s of order) {
    const file = join(root, 'out', s, `${id}.glb`);
    if (existsSync(file)) return { stage: s, file };
  }
  return null;
}

function parseArgs(argv) {
  const a = { id: null, stage: null, upload: false, dryRun: false, budget: { ...DEFAULT_BUDGET } };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--upload') a.upload = true;
    else if (v === '--dry-run') a.dryRun = true;
    else if (v === '--stage') { a.stage = argv[++i]; if (!STAGES.includes(a.stage)) throw new Error(`--stage is one of ${STAGES.join(', ')}`); }
    else if (v === '--max-mb') a.budget.maxMb = Number(argv[++i]);
    else if (v === '--max-triangles') a.budget.maxTriangles = Number(argv[++i]);
    else if (v.startsWith('--')) throw new Error(`Unknown flag ${v}`);
    else a.id = v;
  }
  if (!a.id) throw new Error('Pass an object id, e.g. 012');
  return a;
}

function validate(file) {
  // gltf-transform prints "No errors found." when the file is valid.
  const r = spawnSync('npx', ['-y', '@gltf-transform/cli', 'validate', file], { encoding: 'utf8' });
  const text = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { ok: /No errors found/i.test(text), text };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const log = (m) => console.log(m);

  const source = pickSource(root, args.id, args.stage);
  if (!source) throw new Error(`No GLB for ${args.id} in out/${args.stage ?? 'final, out/clean or out/models'}. Run the Meshy, flat or Blender step first.`);
  const before = await inspectGlb(source.file);
  log(`source  out/${source.stage}/${args.id}.glb  ${(before.bytes / 1048576).toFixed(2)} MB  ${before.triangles} triangles  ${before.textures.length} textures  clips: ${before.animations.join(', ') || 'none'}`);
  if (args.dryRun) { log('Dry run, nothing written.'); return; }

  const dest = join(root, 'out', 'publish', `${args.id}.glb`);
  compressGlb(source.file, log, dest);
  const after = await inspectGlb(dest);
  const problems = checkBudget(after, args.budget);
  const check = validate(dest);
  if (!check.ok) problems.push('gltf-transform validate reported errors, see the report');

  const reportPath = join(root, 'out', 'publish', `${args.id}.report.json`);
  mkdirSync(join(root, 'out', 'publish'), { recursive: true });
  writeFileSync(reportPath, JSON.stringify({ source: source.stage, before, after, budget: args.budget, problems, validate: check.ok ? 'ok' : check.text }, null, 2) + '\n');

  log(`result  out/publish/${args.id}.glb  ${(after.bytes / 1048576).toFixed(2)} MB  ${after.triangles} triangles  textures ${after.textures.map((t) => `${t.width}×${t.height}`).join(', ') || 'none'}`);
  if (problems.length) {
    for (const p of problems) log(`PROBLEM ${p}`);
    process.exitCode = 1;
    log('Not uploading: fix the problems above first.');
    return;
  }
  log('Within budget.');
  if (args.upload) await uploadToR2({ root, id: args.id, log, file: dest });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}

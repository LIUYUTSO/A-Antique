#!/usr/bin/env node
// Usage: node scripts/blender/run.mjs clean <id> [--target-faces N] [--dry-run]
//        node scripts/blender/run.mjs work  <id> [--dry-run]
//        node scripts/blender/run.mjs open  <id> --part lid --hinge back-top [--angle 110] [--dry-run]
//
// clean: out/models/<id>.glb -> out/clean/<id>.glb (weld, strip stray bits, trim polygons, real size, origin)
// work:  out/clean/<id>.glb  -> work/<id>.blend, the file you open in Blender for hand work
// open:  work/<id>.blend     -> out/final/<id>.glb with a <part>.open / <part>.close clip
// Blender is found through BLENDER_BIN, then the macOS app, then `blender` on PATH.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { blenderBin, cleanCommand, openCommand, workCommand } from './command.mjs';

try { process.loadEnvFile('.env'); } catch { /* no .env */ }

function parse(argv) {
  const [verb, id, ...rest] = argv;
  const o = { verb, id, dryRun: false, targetFaces: undefined, part: undefined, hinge: undefined, angle: undefined };
  for (let i = 0; i < rest.length; i++) {
    const v = rest[i];
    if (v === '--dry-run') o.dryRun = true;
    else if (v === '--target-faces') o.targetFaces = Number(rest[++i]);
    else if (v === '--part') o.part = rest[++i];
    else if (v === '--hinge') o.hinge = rest[++i];
    else if (v === '--angle') o.angle = Number(rest[++i]);
    else throw new Error(`Unknown flag ${v}`);
  }
  if (!['clean', 'work', 'open'].includes(verb)) throw new Error('First word is clean, work or open');
  if (!/^\d{3}$/.test(id ?? '')) throw new Error('Second word is an object id, e.g. 012');
  if (verb === 'open' && (!o.part || !o.hinge)) throw new Error('open needs --part and --hinge, e.g. --part lid --hinge back-top');
  return o;
}

function main() {
  const o = parse(process.argv.slice(2));
  const root = process.cwd();
  const { objects } = JSON.parse(readFileSync(`${root}/data/objects.json`, 'utf8'));
  const entry = objects.find((x) => x.id === o.id);
  if (!entry) {
    const main = objects.find((x) => (x.aliases ?? []).includes(o.id));
    throw new Error(main ? `${o.id} is part of the set ${main.id}. Use ${main.id}.` : `${o.id} is not in data/objects.json`);
  }
  const bin = blenderBin();
  const input = { clean: `out/models/${o.id}.glb`, work: `out/clean/${o.id}.glb`, open: `work/${o.id}.blend` }[o.verb];
  const { cmd, args } = { clean: cleanCommand, work: workCommand, open: openCommand }[o.verb]({ bin, root, id: o.id, entry, ...o });

  console.log([cmd, ...args].join(' '));
  if (o.dryRun) return;
  if (!existsSync(`${root}/${input}`)) throw new Error(`${input} is missing. ${o.verb === 'clean' ? 'Run the Meshy or flat step first.' : o.verb === 'work' ? 'Run `clean` first.' : 'Run `work`, then do the hand work and save.'}`);
  for (const dir of ['out/clean', 'out/final', 'work']) mkdirSync(`${root}/${dir}`, { recursive: true });
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.error) throw new Error(`Could not start Blender (${cmd}): ${r.error.message}. Set BLENDER_BIN to the Blender executable.`);
  process.exitCode = r.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (err) { console.error(err.message); process.exit(1); }
}

// Builds the Blender command lines. Pure functions, so they are tested without Blender installed.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const MAC_APP = '/Applications/Blender.app/Contents/MacOS/Blender';

export function blenderBin(env = process.env, exists = existsSync) {
  if (env.BLENDER_BIN) return env.BLENDER_BIN;
  return exists(MAC_APP) ? MAC_APP : 'blender';
}

// sizeMm is [width, height] in the object list; the second number is the upright height.
export function heightMm(entry) {
  return Array.isArray(entry?.sizeMm) && entry.sizeMm[1] > 0 ? entry.sizeMm[1] : null;
}

export function cleanCommand({ bin, root, id, entry, targetFaces }) {
  const out = join(root, 'out', 'clean');
  const args = ['-b', '-P', join(root, 'blender', 'clean_model.py'), '--',
    '--in', join(root, 'out', 'models', `${id}.glb`),
    '--out', join(out, `${id}.glb`),
    '--report', join(out, `${id}.report.json`)];
  const h = heightMm(entry);
  if (h) args.push('--height-mm', String(h));
  if (targetFaces) args.push('--target-faces', String(targetFaces));
  return { cmd: bin, args };
}

// Starts a .blend work file from the cleaned GLB, for the hand work (splitting a lid, painting the inside).
export function workCommand({ bin, root, id }) {
  return { cmd: bin, args: ['-b', '-P', join(root, 'blender', 'start_work.py'), '--',
    '--in', join(root, 'out', 'clean', `${id}.glb`),
    '--blend', join(root, 'work', `${id}.blend`)] };
}

// Turns the hand-separated part into an open/close clip and exports the finished GLB.
export function openCommand({ bin, root, id, part, hinge, angle }) {
  const blend = join(root, 'work', `${id}.blend`);
  const args = [blend, '-b', '-P', join(root, 'blender', 'make_openable.py'), '--',
    '--part', part, '--hinge', hinge, '--out', join(root, 'out', 'final', `${id}.glb`)];
  if (angle) args.push('--angle', String(angle));
  return { cmd: bin, args };
}

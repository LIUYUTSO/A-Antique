import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blenderBin, cleanCommand, heightMm, openCommand, workCommand } from './command.mjs';

const root = '/repo';

test('BLENDER_BIN wins, then the macOS app, then plain blender', () => {
  assert.equal(blenderBin({ BLENDER_BIN: '/opt/b' }, () => true), '/opt/b');
  assert.equal(blenderBin({}, () => true), '/Applications/Blender.app/Contents/MacOS/Blender');
  assert.equal(blenderBin({}, () => false), 'blender');
});

test('the upright height is the second number of sizeMm', () => {
  assert.equal(heightMm({ sizeMm: [100, 74] }), 74);
  assert.equal(heightMm({ sizeMm: null }), null);
  assert.equal(heightMm({}), null);
  assert.equal(heightMm(undefined), null);
});

test('clean reads the raw model, writes the clean one and passes the real height', () => {
  const { cmd, args } = cleanCommand({ bin: 'blender', root, id: '012', entry: { sizeMm: [90, 120] }, targetFaces: 20000 });
  assert.equal(cmd, 'blender');
  assert.deepEqual(args.slice(0, 4), ['-b', '-P', '/repo/blender/clean_model.py', '--']);
  const flag = (name) => args[args.indexOf(name) + 1];
  assert.equal(flag('--in'), '/repo/out/models/012.glb');
  assert.equal(flag('--out'), '/repo/out/clean/012.glb');
  assert.equal(flag('--report'), '/repo/out/clean/012.report.json');
  assert.equal(flag('--height-mm'), '120');
  assert.equal(flag('--target-faces'), '20000');
});

test('clean leaves the size alone when none is measured', () => {
  const { args } = cleanCommand({ bin: 'blender', root, id: '012', entry: { sizeMm: null } });
  assert.ok(!args.includes('--height-mm'));
  assert.ok(!args.includes('--target-faces'));
});

test('work builds a .blend from the clean model', () => {
  const { args } = workCommand({ bin: 'blender', root, id: '012' });
  assert.equal(args[args.indexOf('--in') + 1], '/repo/out/clean/012.glb');
  assert.equal(args[args.indexOf('--blend') + 1], '/repo/work/012.blend');
});

test('open starts from the work file and writes the final model', () => {
  const { args } = openCommand({ bin: 'blender', root, id: '012', part: 'lid', hinge: 'back-top', angle: 100 });
  assert.equal(args[0], '/repo/work/012.blend');
  const flag = (name) => args[args.indexOf(name) + 1];
  assert.equal(flag('--part'), 'lid');
  assert.equal(flag('--hinge'), 'back-top');
  assert.equal(flag('--angle'), '100');
  assert.equal(flag('--out'), '/repo/out/final/012.glb');
});

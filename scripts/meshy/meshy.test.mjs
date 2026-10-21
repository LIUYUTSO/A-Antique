import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, buildPayload, getApiKey } from './client.mjs';
import { planWork, processObject, runAll, loadState, assertBudget } from './pipeline.mjs';

// A fake Meshy: POST creates a task, GET walks PENDING → IN_PROGRESS → SUCCEEDED (or FAILED).
function startMock({ failIds = [], busyOnce = false } = {}) {
  const tasks = new Map();
  const log = { posts: 0, auth: [], fileAuth: [] };
  let busy = busyOnce;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/openapi/')) log.auth.push(req.headers.authorization);
    else log.fileAuth.push(req.headers.authorization);
    const send = (code, obj, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(obj)); };
    if (req.method === 'POST' && url.pathname === '/openapi/v1/multi-image-to-3d') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        if (busy) { busy = false; return send(429, { message: 'NoMorePendingTasks: queue full' }); }
        const p = JSON.parse(body);
        if (!p.image_urls?.length || p.image_urls.length > 4) return send(400, { message: 'bad image count' });
        log.posts++;
        const id = `task-${log.posts}`;
        tasks.set(id, { polls: 0, fail: failIds.includes(p.__id) });
        send(200, { result: id });
      });
      return;
    }
    const m = url.pathname.match(/^\/openapi\/v1\/multi-image-to-3d\/(.+)$/);
    if (req.method === 'GET' && m) {
      const t = tasks.get(m[1]);
      if (!t) return send(404, { message: 'not found' });
      t.polls++;
      if (t.polls < 2) return send(200, { id: m[1], status: 'PENDING', progress: 0 });
      if (t.polls < 3) return send(200, { id: m[1], status: 'IN_PROGRESS', progress: 50 });
      if (t.fail || failIds.includes('*')) return send(200, { id: m[1], status: 'FAILED', task_error: { message: 'bad geometry' }, consumed_credits: 0 });
      return send(200, { id: m[1], status: 'SUCCEEDED', progress: 100, consumed_credits: 30,
        model_urls: { glb: `http://127.0.0.1:${server.address().port}/files/m.glb` },
        thumbnail_url: `http://127.0.0.1:${server.address().port}/files/t.png` });
    }
    if (url.pathname === '/files/m.glb') { res.writeHead(200); return res.end(Buffer.from('glTFmock')); }
    if (url.pathname === '/files/t.png') { res.writeHead(200); return res.end(Buffer.from('pngmock')); }
    send(404, {});
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, log, base: `http://127.0.0.1:${server.address().port}` })));
}

function makeRoot(ids) {
  const root = mkdtempSync(join(tmpdir(), 'meshy-'));
  for (const id of ids) {
    const dir = join(root, 'shoot', id, 'views');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2-left.jpg'), 'img');
    writeFileSync(join(dir, '1-front.jpg'), 'img');
    writeFileSync(join(dir, '10-back.jpg'), 'img');
  }
  return root;
}

function makeCtx(root, base) {
  return {
    root, state: loadState(root), fetchImpl: fetch,
    client: createClient({ apiKey: 'test-key', baseUrl: base }),
    sleep: () => new Promise((r) => setTimeout(r, 1)),
    log: () => {},
    opts: { intervalMs: 1, queueWaitMs: 1, compress: false, upload: false },
  };
}

test('buildPayload enforces 1 to 4 images and the Meshy defaults', () => {
  assert.throws(() => buildPayload([]));
  assert.throws(() => buildPayload(['a', 'b', 'c', 'd', 'e']));
  const p = buildPayload(['a']);
  assert.equal(p.ai_model, 'meshy-7.1');
  assert.deepEqual(p.target_formats, ['glb']);
  assert.equal(p.remove_lighting, true);
});

test('planWork sorts photos naturally and caps new tasks at --limit', () => {
  const root = makeRoot(['001', '002']);
  const plan = planWork({ root, objects: [{ id: '001' }, { id: '002' }, { id: '003' }], state: {}, limit: 1 });
  assert.deepEqual(plan.map((p) => p.action), ['create', 'skip', 'skip']);
  assert.match(plan[0].views[0], /1-front\.jpg$/);
  assert.match(plan[0].views[2], /10-back\.jpg$/);
  assert.match(plan[1].reason, /over --limit/);
  assert.match(plan[2].reason, /no photos/);
});

test('create → poll → download writes the GLB, thumbnail and state', async () => {
  const { server, log, base } = await startMock();
  try {
    const root = makeRoot(['012']);
    const ctx = makeCtx(root, base);
    const [item] = planWork({ root, objects: [{ id: '012' }], state: ctx.state, limit: 1 });
    const out = await processObject(ctx, item);
    assert.equal(log.posts, 1);
    assert.equal(out.status, 'SUCCEEDED');
    assert.equal(out.credits, 30);
    assert.equal(readFileSync(join(root, 'out', 'models', '012.glb'), 'utf8'), 'glTFmock');
    assert.ok(existsSync(join(root, 'out', 'thumbnails', '012.png')));
    assert.equal(loadState(root)['012'].status, 'SUCCEEDED');
    assert.ok(log.auth.length > 0 && log.auth.every((a) => a === 'Bearer test-key'));
    assert.ok(log.fileAuth.length > 0 && log.fileAuth.every((a) => a === undefined), 'signed downloads must not carry the API key');
  } finally { server.close(); }
});

test('a saved task id is resumed, never re-created (no double spend)', async () => {
  const { server, log, base } = await startMock();
  try {
    const root = makeRoot(['012']);
    let ctx = makeCtx(root, base);
    // First run creates the task, then pretend the process died before it finished.
    let [item] = planWork({ root, objects: [{ id: '012' }], state: ctx.state, limit: 1 });
    ctx.client = { ...ctx.client, getTask: async () => { throw new Error('process killed'); } };
    await assert.rejects(processObject(ctx, item));
    assert.equal(log.posts, 1);
    assert.equal(loadState(root)['012'].taskId, 'task-1');

    ctx = makeCtx(root, base);
    [item] = planWork({ root, objects: [{ id: '012' }], state: ctx.state, limit: 1 });
    assert.equal(item.action, 'resume');
    await processObject(ctx, item);
    assert.equal(log.posts, 1, 'resume must not POST again');
    assert.equal(loadState(root)['012'].status, 'SUCCEEDED');

    const again = planWork({ root, objects: [{ id: '012' }], state: loadState(root), limit: 1 });
    assert.equal(again[0].action, 'skip');
  } finally { server.close(); }
});

test('a FAILED task is recorded and the next run creates a fresh one', async () => {
  const { server, log, base } = await startMock({ failIds: ['*'] });
  try {
    const root = makeRoot(['012']);
    const ctx = makeCtx(root, base);
    const [item] = planWork({ root, objects: [{ id: '012' }], state: ctx.state, limit: 1 });
    await assert.rejects(processObject(ctx, item), /FAILED: bad geometry/);
    assert.equal(loadState(root)['012'].status, 'FAILED');
    const next = planWork({ root, objects: [{ id: '012' }], state: loadState(root), limit: 1 });
    assert.equal(next[0].action, 'create');
    assert.equal(log.posts, 1);
  } finally { server.close(); }
});

test('429 queue-full on create is retried', async () => {
  const { server, log, base } = await startMock({ busyOnce: true });
  try {
    const root = makeRoot(['012']);
    const ctx = makeCtx(root, base);
    const [item] = planWork({ root, objects: [{ id: '012' }], state: ctx.state, limit: 1 });
    await processObject(ctx, item);
    assert.equal(log.posts, 1);
    assert.equal(loadState(root)['012'].status, 'SUCCEEDED');
  } finally { server.close(); }
});

test('runAll processes several objects and keeps going when one fails', async () => {
  const { server, base } = await startMock();
  try {
    const root = makeRoot(['001', '002']);
    const ctx = makeCtx(root, base);
    const plan = planWork({ root, objects: [{ id: '001' }, { id: '002' }], state: ctx.state, limit: Infinity });
    ctx.client = { ...ctx.client, createTask: (() => { let n = 0; const real = ctx.client.createTask; return (p) => (++n === 1 ? Promise.reject(new Error('boom')) : real(p)); })() };
    const results = await runAll(ctx, plan, 2);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(results.filter((r) => !r.ok).length, 1);
  } finally { server.close(); }
});

test('flat objects never go to Meshy, even with photos', () => {
  const root = makeRoot(['010', '012']);
  const plan = planWork({ root, objects: [{ id: '010', method: 'flat' }, { id: '012', method: 'meshy' }], state: {}, limit: Infinity });
  assert.deepEqual(plan.map((p) => p.action), ['skip', 'create']);
  assert.match(plan[0].reason, /flat/);
});

test('assertBudget refuses a run the balance cannot cover', () => {
  assert.equal(assertBudget(774, 17), 510);
  assert.throws(() => assertBudget(774, 26), /Need 780 credits.*has 774/);
});

test('the key is read from MESHY_APIKEY, with MESHY_API_KEY as a fallback', () => {
  assert.equal(getApiKey({ MESHY_APIKEY: 'a' }), 'a');
  assert.equal(getApiKey({ MESHY_API_KEY: 'b' }), 'b');
  assert.equal(getApiKey({ MESHY_APIKEY: 'a', MESHY_API_KEY: 'b' }), 'a');
  assert.equal(getApiKey({}), undefined);
});

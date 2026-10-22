// Photos in shoot/<id>/views → Meshy task → GLB in out/models → optional compress → optional R2 upload.
// Task ids are written to .meshy/state.json before polling, so a re-run resumes instead of paying twice.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, extname, basename, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildPayload, waitForTask, MeshyError } from './client.mjs';

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const collator = new Intl.Collator(undefined, { numeric: true });
export const CREDITS_TEXTURED = 30; // meshy-7.1 / meshy-6, 2K or 4K textures

export function listViews(root, id) {
  const dir = join(root, 'shoot', id, 'views');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => MIME[extname(f).toLowerCase()])
    .sort(collator.compare)
    .map((f) => join(dir, f));
}

export function toDataUri(file) {
  const buf = readFileSync(file);
  if (buf.length > MAX_IMAGE_BYTES) throw new Error(`${file} is over 20 MB`);
  return `data:${MIME[extname(file).toLowerCase()]};base64,${buf.toString('base64')}`;
}

const stateFile = (root) => join(root, '.meshy', 'state.json');
export function loadState(root) {
  return existsSync(stateFile(root)) ? JSON.parse(readFileSync(stateFile(root), 'utf8')) : {};
}
export function saveState(root, state) {
  mkdirSync(dirname(stateFile(root)), { recursive: true });
  writeFileSync(stateFile(root), JSON.stringify(state, null, 2));
}

// `limit` caps NEW tasks (the ones that spend credits). Resuming a saved task is free.
export function planWork({ root, objects, state, limit = 1, force = false }) {
  let created = 0;
  return objects.map((o) => {
    if (o.method === 'flat') return { id: o.id, views: [], ignored: 0, action: 'skip', reason: 'flat item, built locally (npm run flat)' };
    const all = listViews(root, o.id);
    const views = all.slice(0, 4);
    const base = { id: o.id, views, ignored: all.length - views.length };
    const st = state[o.id];
    if (st?.glb && !force) return { ...base, action: 'skip', reason: 'done' };
    if (views.length === 0) return { ...base, action: 'skip', reason: `no photos in shoot/${o.id}/views` };
    const live = st?.taskId && st.status !== 'FAILED' && st.status !== 'CANCELED';
    if (live && !force) return { ...base, action: 'resume', taskId: st.taskId };
    if (created >= limit) return { ...base, action: 'skip', reason: 'over --limit' };
    created++;
    return { ...base, action: 'create' };
  });
}

// Refuse to start when the account cannot cover every new task in this run.
export function assertBudget(balance, newTasks) {
  const needed = newTasks * CREDITS_TEXTURED;
  if (balance < needed) throw new Error(`Need ${needed} credits for ${newTasks} new task(s) but the account has ${balance}. Lower --limit or top up.`);
  return needed;
}

async function createWithRetry(ctx, payload) {
  const { client, sleep, log } = ctx;
  for (let attempt = 1; ; attempt++) {
    try {
      return await client.createTask(payload);
    } catch (err) {
      if (!(err instanceof MeshyError)) throw err;
      if (err.status === 402) throw new Error('Meshy says insufficient credits (402). Top up, then run again.');
      if (err.status !== 429 || attempt >= 20) throw err;
      // Per-second limit sends Retry-After; "NoMorePendingTasks" (queue full) does not.
      const wait = err.retryAfter ? err.retryAfter * 1000 : ctx.opts.queueWaitMs;
      log(`queue busy (429), waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
}

async function download(ctx, url, dest) {
  const res = await ctx.fetchImpl(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url.slice(0, 80)}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

// 1024px WebP textures + Draco, nothing else. Geometry is already sized (Meshy remesh or Blender clean),
// and the other optimize passes would change the scene: flatten and join would break animated parts such
// as a lid, and palette would merge materials. Writes to `outFile`, which defaults to compressing in place.
export const OPTIMIZE_ARGS = [
  '--simplify', 'false', '--join', 'false', '--flatten', 'false', '--instance', 'false', '--palette', 'false',
  '--compress', 'draco', '--texture-compress', 'webp', '--texture-size', '1024',
];

export function compressGlb(file, log, outFile = file) {
  mkdirSync(dirname(outFile), { recursive: true });
  const r = spawnSync('npx', ['-y', '@gltf-transform/cli', 'optimize', file, outFile, ...OPTIMIZE_ARGS], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`gltf-transform failed for ${file}`);
  log(`compressed ${basename(file)}${outFile === file ? '' : ` -> ${outFile}`}`);
}

// `file` overrides which GLB is uploaded as models/<id>.glb (default out/models/<id>.glb).
export async function uploadToR2({ root, id, log, file }) {
  const need = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing R2 env: ${missing.join(', ')}`);
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
  const jobs = [
    [file ?? join(root, 'out', 'models', `${id}.glb`), `models/${id}.glb`, 'model/gltf-binary'],
    [join(root, 'out', 'thumbnails', `${id}.png`), `thumbnails/${id}.png`, 'image/png'],
  ];
  const urls = {};
  for (const [file, key, type] of jobs) {
    if (!existsSync(file)) continue;
    await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: readFileSync(file), ContentType: type }));
    urls[key] = process.env.R2_PUBLIC_BASE_URL ? `${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}` : key;
  }
  log(`uploaded ${Object.keys(urls).join(', ')}`);
  return urls;
}

export async function processObject(ctx, item) {
  const { root, client, state, log, sleep, opts } = ctx;
  const { id } = item;
  let taskId = item.taskId;

  if (item.action === 'create') {
    const payload = buildPayload(item.views.map(toDataUri), opts);
    taskId = await createWithRetry(ctx, payload);
    state[id] = { taskId, status: 'PENDING', createdAt: new Date().toISOString(), views: item.views.map((f) => basename(f)) };
    saveState(root, state);
    log(`${id} task ${taskId} created`);
  }

  let task;
  let lastProgress = -1;
  try {
    task = await waitForTask(client, taskId, {
      sleep,
      intervalMs: opts.intervalMs,
      onProgress: (t) => {
        if (t.progress !== lastProgress && t.progress % 25 === 0) log(`${id} ${t.status} ${t.progress ?? 0}%`);
        lastProgress = t.progress;
      },
    });
  } catch (err) {
    if (err.taskStatus) {
      state[id] = { ...state[id], status: err.taskStatus, error: err.message };
      saveState(root, state);
    }
    throw err;
  }

  const glbUrl = task.model_urls?.glb;
  if (!glbUrl) throw new Error(`Task ${taskId} succeeded but has no GLB url`);
  const glbPath = join(root, 'out', 'models', `${id}.glb`);
  await download(ctx, glbUrl, glbPath); // signed urls expire, so download right away
  if (task.thumbnail_url) {
    try { await download(ctx, task.thumbnail_url, join(root, 'out', 'thumbnails', `${id}.png`)); }
    catch (err) { log(`${id} thumbnail skipped: ${err.message}`); }
  }

  if (opts.compress) compressGlb(glbPath, log);
  const urls = opts.upload ? await uploadToR2({ root, id, log }) : undefined;

  state[id] = {
    ...state[id],
    status: 'SUCCEEDED',
    credits: task.consumed_credits,
    glb: relative(root, glbPath),
    compressed: Boolean(opts.compress),
    uploaded: urls,
    finishedAt: new Date().toISOString(),
  };
  saveState(root, state);
  log(`${id} done, ${task.consumed_credits ?? '?'} credits`);
  return state[id];
}

// Runs `items` with at most `concurrency` in flight. One failure does not stop the others.
export async function runAll(ctx, items, concurrency) {
  const results = [];
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      try { results.push({ id: item.id, ok: true, state: await processObject(ctx, item) }); }
      catch (err) { ctx.log(`${item.id} FAILED: ${err.message}`); results.push({ id: item.id, ok: false, error: err.message }); }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return results;
}

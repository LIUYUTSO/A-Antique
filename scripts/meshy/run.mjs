#!/usr/bin/env node
// Usage: node scripts/meshy/run.mjs <id|all> [--dry-run] [--limit N|all] [--concurrency N]
//        [--force] [--model meshy-7.1] [--compress] [--upload]
import { readFileSync } from 'node:fs';
import { createClient, buildPayload, getApiKey } from './client.mjs';
import { CREDITS_TEXTURED, assertBudget, loadState, planWork, runAll, toDataUri } from './pipeline.mjs';

try { process.loadEnvFile('.env'); } catch { /* no .env, use the shell environment */ }

function parseArgs(argv) {
  const a = { target: null, dryRun: false, limit: 1, concurrency: 3, force: false, model: undefined, compress: false, upload: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--dry-run') a.dryRun = true;
    else if (v === '--force') a.force = true;
    else if (v === '--compress') a.compress = true;
    else if (v === '--upload') a.upload = true;
    else if (v === '--limit') { const n = argv[++i]; a.limit = n === 'all' ? Infinity : Number(n); }
    else if (v === '--concurrency') a.concurrency = Number(argv[++i]);
    else if (v === '--model') a.model = argv[++i];
    else if (v.startsWith('--')) throw new Error(`Unknown flag ${v}`);
    else a.target = v;
  }
  if (!a.target) throw new Error('Pass an object id (e.g. 012) or "all"');
  if (!(a.limit >= 1)) throw new Error('--limit must be a number >= 1, or "all"');
  if (!(a.concurrency >= 1 && a.concurrency <= 10)) throw new Error('--concurrency must be 1 to 10 (Pro plan queue is 10)');
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const { objects } = JSON.parse(readFileSync('data/objects.json', 'utf8'));
  const targets = args.target === 'all' ? objects : objects.filter((o) => o.id === args.target);
  if (targets.length === 0) throw new Error(`No object with id ${args.target}`);

  const state = loadState(root);
  const plan = planWork({ root, objects: targets, state, limit: args.limit, force: args.force });

  const creates = plan.filter((p) => p.action === 'create').length;
  for (const p of plan) {
    const extra = p.ignored ? ` (+${p.ignored} extra photos ignored, max 4)` : '';
    console.log(`${p.id}  ${p.action.padEnd(6)}  ${p.views.length} photos${p.reason ? `  — ${p.reason}` : ''}${extra}`);
  }
  console.log(`\n${creates} new task(s) × ${CREDITS_TEXTURED} credits = up to ${creates * CREDITS_TEXTURED} credits (failed tasks are refunded)`);

  if (args.dryRun) {
    const first = plan.find((p) => p.action === 'create');
    if (first) {
      const payload = buildPayload(first.views.map(toDataUri), { model: args.model });
      payload.image_urls = payload.image_urls.map((u) => `[data URI, ${u.length} chars]`);
      console.log(`\nPayload for ${first.id}:\n${JSON.stringify(payload, null, 2)}`);
    }
    console.log('\nDry run, nothing sent.');
    return;
  }

  const work = plan.filter((p) => p.action === 'create' || p.action === 'resume');
  if (work.length === 0) { console.log('Nothing to do.'); return; }

  const client = createClient({ apiKey: getApiKey() });
  const { balance } = await client.getBalance();
  console.log(`Account balance: ${balance} credits`);
  assertBudget(balance, creates);

  const ctx = {
    root,
    client,
    state,
    fetchImpl: fetch,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`),
    opts: { model: args.model, compress: args.compress, upload: args.upload, intervalMs: 5000, queueWaitMs: 30_000 },
  };
  const results = await runAll(ctx, work, args.concurrency);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} done, ${failed.length} failed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => { console.error(err.message); process.exit(1); });

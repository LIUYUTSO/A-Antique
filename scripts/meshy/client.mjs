// Minimal Meshy client for the multi-image-to-3d endpoint. No dependencies (Node 20+ fetch).
// Endpoint, parameters and credit costs: https://docs.meshy.ai/en/api/multi-image-to-3d

const DEFAULT_BASE = 'https://api.meshy.ai';
const ENDPOINT = '/openapi/v1/multi-image-to-3d';

export class MeshyError extends Error {
  constructor(message, { status, body, retryAfter } = {}) {
    super(message);
    this.name = 'MeshyError';
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createClient({ apiKey, baseUrl = DEFAULT_BASE, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('MESHY_API_KEY is not set');

  async function request(method, path, body) {
    const res = await fetchImpl(baseUrl + path, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) {
      throw new MeshyError(
        `Meshy ${method} ${path} → ${res.status}: ${json.message ?? text.slice(0, 200)}`,
        { status: res.status, body: json, retryAfter: Number(res.headers.get('retry-after')) || undefined },
      );
    }
    return json;
  }

  return {
    createTask: async (payload) => (await request('POST', ENDPOINT, payload)).result,
    getTask: (id) => request('GET', `${ENDPOINT}/${id}`),
    deleteTask: (id) => request('DELETE', `${ENDPOINT}/${id}`),
    getBalance: () => request('GET', '/openapi/v1/balance'), // { balance, monthly_credits, permanent_credits, ... }
  };
}

// First image is the primary (front) view for meshy-7.1. 1 to 4 images, data URI or public URL.
export function buildPayload(imageUris, o = {}) {
  if (imageUris.length < 1 || imageUris.length > 4) {
    throw new Error(`multi-image-to-3d takes 1 to 4 images, got ${imageUris.length}`);
  }
  return {
    image_urls: imageUris,
    ai_model: o.model ?? 'meshy-7.1',
    should_texture: true,
    enable_pbr: true,
    texture_resolution: o.textureResolution ?? '2k', // 4k costs the same, but we shrink to 1024 afterwards
    should_remesh: true,
    topology: 'triangle',
    target_polycount: o.targetPolycount ?? 30000,
    target_formats: ['glb'],
    image_enhancement: true,
    remove_lighting: true, // strip the light baked into the photos
    moderation: false,
  };
}

export async function waitForTask(client, id, { intervalMs = 5000, timeoutMs = 30 * 60_000, sleep = defaultSleep, onProgress } = {}) {
  const t0 = Date.now();
  let transient = 0;
  for (;;) {
    let task;
    try {
      task = await client.getTask(id);
      transient = 0;
    } catch (err) {
      const retryable = !(err instanceof MeshyError) || err.status === 429 || err.status >= 500;
      if (!retryable || ++transient > 5) throw err;
      await sleep(Math.max(intervalMs, (err.retryAfter ?? 0) * 1000));
      continue;
    }
    onProgress?.(task);
    if (task.status === 'SUCCEEDED') return task;
    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      const err = new Error(`Task ${id} ${task.status}: ${task.task_error?.message || 'no message'}`);
      err.taskStatus = task.status;
      throw err;
    }
    if (Date.now() - t0 > timeoutMs) {
      throw new Error(`Task ${id} still ${task.status} after ${Math.round(timeoutMs / 60000)} min; run again to resume`);
    }
    await sleep(intervalMs);
  }
}

// Thin edge API. The site itself is static; this only exists for the things that cannot be:
// Square checkout links and webhooks later. Right now it answers /api/health and nothing else.

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/health') return json({ ok: true });
    if (pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    return env.ASSETS.fetch(request);
  },
};

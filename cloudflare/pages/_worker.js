const ORIGIN = 'https://houdini-bet.ivanmarrtin2703.workers.dev';

function shouldProxyToApi(pathname) {
  return pathname === '/health' || pathname.startsWith('/api/');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API/health → Worker origin. Static shell → Pages ASSETS (uploaded files).
    if (shouldProxyToApi(url.pathname)) {
      const target = new URL(request.url);
      const origin = new URL(ORIGIN);
      target.protocol = origin.protocol;
      target.host = origin.host;
      return fetch(new Request(target.toString(), request));
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Fallback if ASSETS binding is missing (should not happen on Pages).
    const target = new URL(request.url);
    const origin = new URL(ORIGIN);
    target.protocol = origin.protocol;
    target.host = origin.host;
    return fetch(new Request(target.toString(), request));
  },
};

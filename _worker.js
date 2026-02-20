/**
 * Cloudflare Pages Worker
 * Serves static files from the Pages distribution
 */

export default {
  async fetch(request, env, ctx) {
    try {
      // Get the requested path
      const url = new URL(request.url);
      let pathname = url.pathname;

      // Handle root path
      if (pathname === '/') {
        pathname = '/index.html';
      }

      // Try to get the asset
      const asset = await env.ASSETS.fetch(
        new Request(`${url.origin}${pathname}`, request)
      );

      if (asset.status === 404) {
        // If not found, try index.html for SPA routing
        return env.ASSETS.fetch(new Request(`${url.origin}/index.html`, request));
      }

      return asset;
    } catch (error) {
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

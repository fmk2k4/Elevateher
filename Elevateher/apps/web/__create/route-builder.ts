import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

const routeModules = import.meta.glob('../src/app/api/**/route.js');

function getPattern(segment: string) {
  const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
  if (!match) return segment;
  const [_, dots, param] = match;
  return dots === '...' ? `:${param}{.+}` : `:${param}`;
}

function getHonoPath(routeKey: string) {
  const relativePath = routeKey.replace('../src/app/api/', '').replace('/route.js', '');
  const parts = relativePath.split('/').filter(Boolean);
  const patterns = parts.map(getPattern);
  return patterns.length ? `/${patterns.join('/')}` : '/';
}

async function registerRoutes() {
  api.routes = [];
  const entries = Object.entries(routeModules).sort(([a], [b]) => b.length - a.length);

  for (const [routeKey, loader] of entries) {
    try {
      const route = await loader();
      const honoPath = getHonoPath(routeKey);
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        if (!route[method]) continue;
        const handler: Handler = async (c) => {
          const params = c.req.param();
          let currentRoute = route;
          try {
            if (import.meta.env.DEV) {
              currentRoute = await loader();
            }
          } catch (err) {
            console.error("HMR loader error, using cached route");
          }
          return await currentRoute[method](c.req.raw, { params });
        };

        switch (method.toLowerCase()) {
          case 'get':
            api.get(honoPath, handler);
            break;
          case 'post':
            api.post(honoPath, handler);
            break;
          case 'put':
            api.put(honoPath, handler);
            break;
          case 'delete':
            api.delete(honoPath, handler);
            break;
          case 'patch':
            api.patch(honoPath, handler);
            break;
        }
      }
    } catch (error) {
      console.error(`Error registering route ${routeKey}:`, error);
    }
  }
}

await registerRoutes();

if (import.meta.env.DEV && import.meta.hot) {
  import.meta.hot.accept(Object.values(routeModules), () => {
    registerRoutes().catch((err) => {
      console.error('Error reloading routes:', err);
    });
  });
}

export { api, API_BASENAME };

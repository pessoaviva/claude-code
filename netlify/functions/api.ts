/**
 * Netlify Function entrypoint for the FinTrack Pro API.
 *
 * Netlify cannot run a long-lived Express server (`app.listen`). Instead it runs
 * serverless functions, so we wrap the SAME Express app with `serverless-http`.
 * The `netlify.toml` redirect maps `/api/*` to this function.
 *
 * Imports the COMPILED server (`server/dist`) so esbuild bundles plain JS with
 * resolvable `.js` imports. Requires `npm run build` to have produced dist.
 */
import serverless from "serverless-http";
import { createApp } from "../../server/dist/app.js";
import { ensureSchema } from "../../server/dist/db/pool.js";

const app = createApp();

const wrapped = serverless(app, {
  request(req: { url?: string }) {
    // Depending on Netlify's version the function may receive either the
    // original `/api/...` path or the resolved `/.netlify/functions/api/...`
    // path. Normalize so the Express routers (mounted at /api) always match.
    const prefix = "/.netlify/functions/api";
    if (typeof req.url === "string" && req.url.startsWith(prefix)) {
      req.url = "/api" + req.url.slice(prefix.length);
    }
  },
});

export const handler = async (event: unknown, context: unknown) => {
  // Reuse the pool across warm invocations; do not close it between requests.
  (context as { callbackWaitsForEmptyEventLoop?: boolean }).callbackWaitsForEmptyEventLoop = false;

  // No separate migrate step in serverless: bootstrap the (idempotent) schema
  // on the first request of a cold start. Fail loudly — never mask DB errors.
  try {
    await ensureSchema();
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: `Banco de dados indisponível: ${(err as Error).message}. ` +
          `Verifique DATABASE_URL (Postgres gerenciado com SSL, ex.: Neon/Supabase).`,
      }),
    };
  }

  return wrapped(event as never, context as never);
};

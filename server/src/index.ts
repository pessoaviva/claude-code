import { createApp } from "./app.js";
import { config } from "./config.js";
import { ensureSchema, pool } from "./db/pool.js";

async function main() {
  // Create the (idempotent) schema on startup so platforms like Render/Railway
  // work with no separate migrate step. Fail loudly if the DB is unreachable.
  try {
    await ensureSchema();
    console.log("✓ Schema verificado.");
  } catch (err) {
    console.error("Falha ao conectar/criar schema no banco:", (err as Error).message);
    await pool.end().catch(() => {});
    process.exit(1);
  }

  const app = createApp();
  // 0.0.0.0 so cloud platforms can route external traffic to the container.
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`FinTrack Pro → http://0.0.0.0:${config.port}`);
  });
}

main();

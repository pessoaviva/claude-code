import { pool, ensureSchema } from "./pool.js";

async function migrate() {
  console.log("Applying schema...");
  await ensureSchema();
  console.log("✓ Schema applied.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

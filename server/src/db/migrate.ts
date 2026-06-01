import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf8");
  console.log("Applying schema...");
  await pool.query(sql);
  console.log("✓ Schema applied.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

import { pool } from "./pool.js";

/** Optional demo data. Idempotent-ish: only inserts when tables are empty. */
async function seed() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS c FROM income");
  if (rows[0].c > 0) {
    console.log("Dados já existem — seed ignorado.");
    await pool.end();
    return;
  }

  await pool.query(`INSERT INTO income (category, description, amount) VALUES
    ('salario', 'Salário', '5000.00'),
    ('dividendos', 'Dividendos PETR4', '120.50')`);
  await pool.query(`INSERT INTO expenses (category, description, amount) VALUES
    ('alimentacao', 'Mercado', '420.30'),
    ('transporte', 'Combustível', '180.00'),
    ('assinaturas', 'Streaming', '49.90')`);
  await pool.query(`INSERT INTO stocks (company, ticker, quantity, avg_price, broker) VALUES
    ('Petrobras', 'PETR4', '100', '31.27', 'XP'),
    ('Itaú', 'ITUB4', '50', '28.10', 'XP')`);
  await pool.query(`INSERT INTO quotes (ticker, price, source) VALUES
    ('PETR4', '38.50', 'manual'),
    ('ITUB4', '32.00', 'manual')`);
  await pool.query(`INSERT INTO goals (type, name, target, current) VALUES
    ('patrimonio', 'Primeiro R$ 100 mil', '100000', '8500'),
    ('renda_passiva', 'Renda passiva R$ 500/mês', '500', '0')`);

  console.log("✓ Seed concluído.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed falhou:", err);
  process.exit(1);
});

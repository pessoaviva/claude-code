-- FinTrack Pro — schema
-- Monetary precision: NUMERIC(20,2) for currency, NUMERIC(24,8) for quantities/prices.
-- All money math in the application uses fixed-point BigInt (see lib/decimal.ts).

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  category    TEXT NOT NULL CHECK (category IN ('change','quote','error','integration','manual')),
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  action      TEXT NOT NULL,
  actor       TEXT NOT NULL DEFAULT 'system',
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  before_data JSONB,
  after_data  JSONB
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_log (category);

CREATE TABLE IF NOT EXISTS income (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  category    TEXT NOT NULL CHECK (category IN ('salario','mesada','vendas','dividendos','rendimentos','outros')),
  description TEXT NOT NULL DEFAULT '',
  amount      NUMERIC(20,2) NOT NULL CHECK (amount >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  category    TEXT NOT NULL CHECK (category IN ('assinaturas','saidas_casa','alimentacao','transporte','saude','educacao','lazer','outros')),
  description TEXT NOT NULL DEFAULT '',
  amount      NUMERIC(20,2) NOT NULL CHECK (amount >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stocks (
  id            BIGSERIAL PRIMARY KEY,
  company       TEXT NOT NULL,
  ticker        TEXT NOT NULL,
  quantity      NUMERIC(24,8) NOT NULL CHECK (quantity >= 0),
  avg_price     NUMERIC(24,8) NOT NULL CHECK (avg_price >= 0),
  broker        TEXT NOT NULL DEFAULT '',
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stocks_ticker ON stocks (ticker);

-- Latest known quote per ticker, plus full history via append-only rows.
CREATE TABLE IF NOT EXISTS quotes (
  id         BIGSERIAL PRIMARY KEY,
  ticker     TEXT NOT NULL,
  price      NUMERIC(24,8) NOT NULL CHECK (price >= 0),
  source     TEXT NOT NULL CHECK (source IN ('auto','manual')),
  provider   TEXT,                       -- which provider supplied an auto quote
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotes_ticker_time ON quotes (ticker, fetched_at DESC);
-- Backfill for databases created before the `provider` column existed.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS provider TEXT;

-- Append-only log of every provider fetch attempt (success or failure).
-- Powers the per-asset Diagnóstico tab and the reliability score.
CREATE TABLE IF NOT EXISTS quote_attempts (
  id          BIGSERIAL PRIMARY KEY,
  ticker      TEXT NOT NULL,
  provider    TEXT NOT NULL,
  url         TEXT NOT NULL,
  ok          BOOLEAN NOT NULL,
  http_status INT,
  response_ms INT,
  price       NUMERIC(24,8),
  error       TEXT,
  raw_excerpt TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quote_attempts_ticker ON quote_attempts (ticker, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_attempts_provider ON quote_attempts (provider, created_at DESC);

-- Aportes (contributions) to stock positions. Each aporte recomputes the
-- weighted average price of the matching position in `stocks`.
CREATE TABLE IF NOT EXISTS stock_contributions (
  id         BIGSERIAL PRIMARY KEY,
  ticker     TEXT NOT NULL,
  company    TEXT NOT NULL DEFAULT '',
  quantity   NUMERIC(24,8) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(24,8) NOT NULL CHECK (unit_price >= 0),
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_contributions_ticker ON stock_contributions (ticker);

-- Patrimônio (net worth) assets. official = confirmed value, estimated = mark-to-market.
CREATE TABLE IF NOT EXISTS assets (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'outros',
  official_value  NUMERIC(20,2) NOT NULL DEFAULT 0,
  estimated_value NUMERIC(20,2) NOT NULL DEFAULT 0,
  as_of           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inventory / Vendas
CREATE TABLE IF NOT EXISTS products (
  id         BIGSERIAL PRIMARY KEY,
  sku        TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  stock_qty  NUMERIC(24,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchases (
  id         BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty        NUMERIC(24,3) NOT NULL CHECK (qty > 0),
  unit_cost  NUMERIC(20,2) NOT NULL CHECK (unit_cost >= 0),
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Backfill for databases created before the `note` column existed.
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS sales (
  id           BIGSERIAL PRIMARY KEY,
  product_id   BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty          NUMERIC(24,3) NOT NULL CHECK (qty > 0),
  unit_price   NUMERIC(20,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost    NUMERIC(20,2) NOT NULL DEFAULT 0,  -- COGS snapshot at sale time
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_product ON sales (product_id);

CREATE TABLE IF NOT EXISTS goals (
  id        BIGSERIAL PRIMARY KEY,
  type      TEXT NOT NULL CHECK (type IN ('patrimonio','investimentos','economia','renda_passiva')),
  name      TEXT NOT NULL,
  target    NUMERIC(20,2) NOT NULL CHECK (target >= 0),
  current   NUMERIC(20,2) NOT NULL DEFAULT 0,
  deadline  DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

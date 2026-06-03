-- ============================================================
-- Projeto Macarujá v2.0 — Esquema Supabase com SEGURANÇA (RLS por dono)
-- Engorda de gado de corte: rebanho, semiconfinamento, dietas,
-- custos, pesagens, saúde e RFID.
--
-- COMO USAR:
--   Supabase → SQL Editor → cole TUDO → Run.
--   Depois, no app, crie sua conta (Auth) e faça login antes de sincronizar.
--
-- PRINCÍPIO DE SEGURANÇA:
--   * RLS LIGADO em todas as tabelas.
--   * Cada linha guarda owner_id = auth.uid() (preenchido por default).
--   * Políticas só permitem o DONO ler/gravar suas próprias linhas.
--   * NUNCA exponha a service_role key no front-end/Vercel.
-- ============================================================

-- Limpa políticas/tabelas antigas e abertas (opcional, idempotente)
-- (mantém dados se as tabelas já existirem com owner_id)

-- ---------- DIETAS / INGREDIENTES ----------
create table if not exists dietas (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null,
  observacoes text,
  created_at  timestamptz default now()
);

create table if not exists ingredientes (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome       text not null,
  preco_kg   numeric(12,4) default 0,
  created_at timestamptz default now()
);

create table if not exists dieta_itens (
  id                 bigint generated always as identity primary key,
  owner_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dieta_id           bigint references dietas(id) on delete cascade,
  ingrediente_id     bigint references ingredientes(id),
  kg_animal_dia      numeric(10,3) default 0,
  preco_kg_snapshot  numeric(12,4) default 0,
  created_at         timestamptz default now()
);

-- ---------- SEMICONFINAMENTOS (lotes) ----------
create table if not exists semiconfinamentos (
  id            bigint generated always as identity primary key,
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome          text not null,
  dieta_id      bigint references dietas(id),
  data_inicio   date,
  meta_gmd      numeric(6,3) default 1.6,   -- objetivo de GMD
  duracao_dias  integer default 90,         -- p/ data prevista de saída e cronômetro
  peso_alvo     numeric(10,2) default 0,    -- peso alvo de saída
  observacoes   text,
  created_at    timestamptz default now()
);

-- ---------- ANIMAIS (rebanho completo) ----------
create table if not exists animais (
  id                   bigint generated always as identity primary key,
  owner_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  eid                  text,                 -- brinco eletrônico / RFID
  ferro                text,                 -- marca a ferro
  raca                 text,                 -- Angus / Nelore / Mestiço
  categoria            text,                 -- Bezerro / Garrote / Animal adulto
  sexo                 text,                 -- Macho / Fêmea / Castrado
  idade                integer,              -- meses
  local                text default 'pasto', -- 'pasto' | 'semi'
  origem               text,
  fornecedor           text,
  data_compra          date,
  data_entrada_fazenda date,                 -- p/ "dias na Fazenda Macarujá"
  peso_compra          numeric(10,2),
  valor_compra         numeric(12,2) default 0,
  status               text default 'ativo', -- 'ativo' | 'vendido'
  created_at           timestamptz default now()
);
create index if not exists idx_animais_owner on animais(owner_id);
create index if not exists idx_animais_eid   on animais(owner_id, eid);

-- ---------- PESAGENS ----------
create table if not exists pesagens (
  id            bigint generated always as identity primary key,
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  animal_id     bigint references animais(id) on delete cascade,
  data_pesagem  date not null,
  peso          numeric(10,2) not null,
  origem_leitura text default 'manual',      -- manual | balança | RFID
  created_at    timestamptz default now()
);
create index if not exists idx_pesagens_animal on pesagens(owner_id, animal_id, data_pesagem);

-- ---------- MOVIMENTAÇÕES (pasto <-> semi) ----------
create table if not exists movimentacoes (
  id                   bigint generated always as identity primary key,
  owner_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  animal_id            bigint references animais(id) on delete cascade,
  semiconfinamento_id  bigint references semiconfinamentos(id) on delete set null,
  entrada              date,
  saida                date,
  tipo                 text default 'Entrada',  -- Entrada | Movimentação | Pasto
  created_at           timestamptz default now()
);

-- ---------- CUSTOS (sanitário, frete, mão de obra...) ----------
create table if not exists custos (
  id                   bigint generated always as identity primary key,
  owner_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  semiconfinamento_id  bigint references semiconfinamentos(id) on delete set null,
  tipo                 text,
  descricao            text,
  valor                numeric(12,2) default 0,
  data_lancamento      date default now(),
  created_at           timestamptz default now()
);

-- ---------- SAÚDE (vacinas, vermífugos, vitaminas, modificadores) ----------
create table if not exists saude (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  animal_id    bigint references animais(id) on delete cascade,
  data_evento  date not null,
  tipo         text,        -- Vacina | Vermífugo | Vitamina | Modificador orgânico
  produto      text,        -- Clostridiose, Doramectina, ADE, Monensina, etc.
  dose         text,
  observacao   text,
  created_at   timestamptz default now()
);
create index if not exists idx_saude_animal on saude(owner_id, animal_id, data_evento);

-- ---------- VENDAS ----------
create table if not exists vendas (
  id                  bigint generated always as identity primary key,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  animal_id           bigint references animais(id) on delete cascade,
  data_venda          date,
  peso_venda          numeric(10,2),
  arrobas             numeric(10,3),
  valor_arroba        numeric(12,2),
  comprador           text,
  cpf_comprador       text,                      -- CPF/CNPJ do comprador
  lote_nome           text,                      -- lote de origem (snapshot)
  semiconfinamento_id bigint references semiconfinamentos(id) on delete set null,
  observacao          text,                      -- GTA, nota, transporte...
  valor_total         numeric(14,2),
  created_at          timestamptz default now()
);

-- ---------- BAIXAS / MORTES ----------
create table if not exists baixas (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  animal_id   bigint references animais(id) on delete cascade,
  data_morte  date not null,
  causa       text,                              -- timpanismo, acidente, doença...
  cercado     text,                              -- cercado/pasto onde ocorreu
  observacao  text,
  created_at  timestamptz default now()
);
create index if not exists idx_baixas_animal on baixas(owner_id, animal_id, data_morte);

-- ---------- LEITURAS RFID (integração futura com bastão/balança) ----------
create table if not exists leituras_rfid (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  eid          text,
  peso         numeric(10,2),
  data_leitura timestamptz default now(),
  equipamento  text,
  processado   boolean default false,
  bruto        jsonb,
  created_at   timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — o dono só enxerga as próprias linhas
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'dietas','ingredientes','dieta_itens','semiconfinamentos','animais',
    'pesagens','movimentacoes','custos','saude','vendas','baixas','leituras_rfid'
  ] loop
    execute format('alter table %I enable row level security;', t);
    -- remove eventuais políticas abertas herdadas de versões antigas
    execute format('drop policy if exists macaruja_owner_all on %I;', t);
    -- política única: dono autenticado faz tudo apenas nas suas linhas
    execute format($f$
      create policy macaruja_owner_all on %I
        for all to authenticated
        using (owner_id = auth.uid())
        with check (owner_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- Pronto. Agora só usuários autenticados acessam, e cada um vê apenas
-- os próprios dados. Sem login (anon) => nenhum acesso.

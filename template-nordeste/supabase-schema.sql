-- ============================================================================
-- Template Nordeste — Banco de dados (Supabase)
-- Modelo: SIMPLES (pragmático) — dados protegidos por login (RLS).
--
-- Como usar: Supabase → SQL Editor → New query → cole TUDO → Run.
-- O script é seguro de rodar mais de uma vez (não duplica nada).
-- ============================================================================

-- 1) Estado do app (todo o banco em uma linha, JSON)
create table if not exists public.app_state (
  id          text primary key default 'main',
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 2) Liga a segurança por linha (RLS)
alter table public.app_state enable row level security;

-- 3) Políticas: só usuários LOGADOS leem/gravam
drop policy if exists app_state_select on public.app_state;
drop policy if exists app_state_insert on public.app_state;
drop policy if exists app_state_update on public.app_state;
create policy app_state_select on public.app_state for select to authenticated using (true);
create policy app_state_insert on public.app_state for insert to authenticated with check (true);
create policy app_state_update on public.app_state for update to authenticated using (true) with check (true);

-- 4) Cria a linha única do estado
insert into public.app_state (id, data) values ('main', '{}'::jsonb)
on conflict (id) do nothing;

-- ============================================================================
-- 5) DEPOIS de criar o usuário admin (Authentication → Users → Add user, com
--    e-mail no formato login@SEU-DOMINIO), rode este trecho para marcá-lo como
--    administrador. Troque o e-mail pelo do admin.
-- ============================================================================
-- update auth.users
-- set raw_user_meta_data = coalesce(raw_user_meta_data,'{}'::jsonb)
--     || '{"name":"Administrador","username":"Admin","is_admin":true}'::jsonb
-- where email = 'admin@SEU-DOMINIO';

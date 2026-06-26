# Plugin: Fábrica de Sites

Agentes do **Fábrica de Sites** para criar e vender sites (React + Vite + TypeScript +
Tailwind, 100% no navegador, com back-end opcional no Supabase).

## Os 3 agentes
- **construtor-de-sites** — Monta o sistema novo do zero a partir do briefing (estrutura,
  login, bloqueio por tentativas, criptografia, tema, backup, dois builds). Deixa a
  persistência atrás de uma fachada pra facilitar plugar a nuvem depois.
- **integrador-supabase** — Adiciona o back-end a um app existente (Supabase Auth + tabela
  `app_state` com RLS + Edge Function pra criar contas). Já evita as 5 armadilhas clássicas.
  Entrega a "primeira passada" de código + SQL + função + checklist — os cliques no painel
  e o teste continuam sendo do usuário.
- **caca-bugs-deploy** — Diagnostica erros de Vercel/Supabase/CORS/branch e diz o que clicar.
  **Só leitura** de código (sem alterar).

## Como instalar

### Opção A — automática por projeto (recomendada na web)
Commite o arquivo [`templates/projeto-cliente.settings.json`](templates/projeto-cliente.settings.json)
como `.claude/settings.json` na raiz do repositório do projeto do cliente. É o que faz o
plugin funcionar nas sessões do Claude Code na web (cada sessão é um ambiente novo).

### Opção B — manual (dentro de uma sessão)
```
/plugin marketplace add pessoaviva/claude-code
/plugin install fabrica-de-sites@fabrica
/reload-plugins
```

## Como operam (termos)
- Não são robôs autônomos: só existem dentro de uma sessão, acionados sob demanda.
- Derivam do Claude (mesma IA, com o manual focado).
- Acesso **igual ou menor** que o seu; **nunca** têm suas senhas nem acessam Supabase/Vercel
  (cliques no painel são sempre seus).

# FinTrack Pro

Sistema financeiro completo para gerenciar **ganhos, gastos, patrimônio, ações,
vendas/estoque, metas e relatórios** — com foco em **precisão financeira
auditável** e funcionamento **mesmo sem APIs externas** (cotações manuais).

## Princípios de projeto

- **Precisão financeira**: toda aritmética monetária usa ponto-fixo com `BigInt`
  (`server/src/lib/decimal.ts`), eliminando o erro de arredondamento do `float`.
  O Postgres armazena `NUMERIC` e o driver preserva a precisão como string.
- **Cálculos auditáveis**: cada criação/alteração/exclusão, cada cotação (auto e
  manual), cada erro e cada integração geram um registro imutável em `audit_log`.
- **Nunca mascarar erros**: entradas inválidas e divisões por zero lançam
  exceções explícitas; erros HTTP retornam a mensagem real e são auditados.
- **Resiliência**: se a cotação automática falhar, o sistema **não inventa
  preço** — retorna `502` sinalizando `manual_required` e a UI abre o modo
  manual, que recalcula a carteira inteira.

## Arquitetura

```
fintrack-pro/                 (monorepo npm workspaces)
├── docker-compose.yml        Postgres 16 para desenvolvimento
├── server/                   API — Node + Express + TypeScript + pg
│   └── src/
│       ├── config.ts         Configuração via .env
│       ├── app.ts            Montagem do Express e rotas
│       ├── index.ts          Bootstrap do servidor
│       ├── db/
│       │   ├── schema.sql     Schema do banco
│       │   ├── pool.ts        Pool pg (NUMERIC -> string)
│       │   ├── migrate.ts     Aplica o schema
│       │   └── seed.ts        Dados de exemplo (opcional)
│       ├── lib/
│       │   ├── decimal.ts     Aritmética ponto-fixo (BigInt)
│       │   ├── audit.ts       Gravação de auditoria
│       │   ├── http.ts        Validação + AppError
│       │   └── asyncHandler.ts
│       ├── services/
│       │   ├── quoteProvider.ts  Integração de cotações (auto)
│       │   └── portfolio.ts      Cálculo da carteira
│       ├── middleware/errorHandler.ts
│       ├── routes/            dashboard, income, expenses, stocks,
│       │                      quotes, networth, sales, goals, audit
│       └── tests/decimal.test.ts
└── web/                       UI — React + TypeScript + Vite + Tailwind
    └── src/
        ├── App.tsx            Shell + navegação
        ├── lib/               api client, formatação, useFetch
        ├── components/ui.tsx  Card, Stat, Table, BarChart, etc.
        └── pages/             Dashboard, Transactions, Stocks, Quotes,
                               NetWorth, Sales, Goals, Audit
```

## Banco de dados

Tabelas: `audit_log`, `income`, `expenses`, `stocks`, `quotes`, `assets`,
`products`, `purchases`, `sales`, `goals`. Categorias de ganhos/gastos e tipos
de metas são validados via `CHECK`. Cotações são *append-only* (histórico
completo); a cotação vigente é o registro mais recente por ticker.

## Integrações

- **Cotações (auto)**: `QUOTE_PROVIDER_URL` (ex.: `brapi.dev`). Com timeout e
  tratamento de falha. Token opcional via `QUOTE_PROVIDER_TOKEN`.
- **Cotações (manual)**: sempre disponível — registra preço, data/hora e fonte,
  e recalcula a carteira. O sistema é totalmente funcional offline.

## Cálculos principais

| Métrica | Fórmula |
|---|---|
| Valor investido | Σ (quantidade × preço médio) |
| Valor atual | Σ (quantidade × cotação vigente) |
| Lucro/Prejuízo | valor atual − valor investido |
| Rentabilidade | lucro / investido × 100 |
| COGS (vendas) | custo médio ponderado das compras |
| Patrimônio oficial | caixa + ativos oficiais + ações ao custo |
| Patrimônio estimado | caixa + ativos estimados + ações a mercado |

## Como executar

```bash
# 1. Banco (Docker) — ou use um Postgres local
docker compose up -d db

# 2. Configurar e migrar
cp server/.env.example server/.env      # ajuste DATABASE_URL se necessário
npm install
npm run migrate                          # aplica o schema
npm run seed --workspace=server          # (opcional) dados de exemplo

# 3. Rodar API + Web
npm run dev                              # API :4000  |  Web :5173
```

Front-end em `http://localhost:5173` (proxy `/api` → `:4000`).

## Deploy no Netlify

### Caminho rápido (botão)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/pessoaviva/claude-code)

> Troque a URL do botão pelo seu repositório, se for outro. O assistente já
> pergunta a `DATABASE_URL` (e as chaves opcionais) durante o deploy — basta
> colar a connection string do seu Postgres gerenciado.

Netlify **não** roda um servidor Express persistente nem fornece banco de dados.
Por isso o backend é empacotado como **Netlify Function** (mesma app Express via
`serverless-http`) e o Postgres é externo (gerenciado, com SSL).

Arquitetura em produção:

```
Browser ── /api/* ──▶ Netlify redirect ──▶ /.netlify/functions/api ──▶ Express (serverless)
   │                                                                         │
   └── arquivos estáticos (web/dist, React)                                  └── Postgres gerenciado (Neon/Supabase, SSL)
```

Passos:

1. **Banco**: crie um Postgres gerenciado (ex.: [Neon](https://neon.tech) free).
   Use a connection string *pooled* com `sslmode=require`.
2. No Netlify, conecte o repositório. O `netlify.toml` já define:
   - `command = "npm run build"` · `publish = "web/dist"`
   - função em `netlify/functions/api.ts` (bundler esbuild)
   - redirects `/api/*` → função e fallback SPA `/*` → `index.html`
3. **Variáveis de ambiente** (Site settings → Environment):
   - `DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.neon.tech/fintrack?sslmode=require`
   - (opcional) chaves de cotação: `BRAPI_TOKEN`, `ALPHAVANTAGE_KEY`, `FINNHUB_KEY`
4. Deploy. O schema é criado automaticamente no primeiro acesso (idempotente);
   não há passo de `migrate` separado em serverless.

Pontos que evitam o "erro no servidor":
- **SSL automático** para hosts remotos (`pool.ts`) — Neon/Supabase exigem SSL.
- **Sem `app.listen`** no caminho serverless; a função reaproveita o pool entre invocações.
- **Falha de DB nunca é mascarada**: retorna `500` com mensagem clara em vez de cair.

> Local dev continua igual: `npm run dev` sobe a API em `:4000` (sem SSL para
> `localhost`) e o front em `:5173`.

## Testes

```bash
npm test            # testes da aritmética financeira (node:test)
```

## Módulos da UI

Dashboard · Ganhos · Gastos · Ações · Cotações · Patrimônio · Vendas · Metas ·
Auditoria (abas **Logs**, **Diagnóstico** e **Saúde**).

## Confiabilidade A/B/C das cotações

Cada cotação é classificada automaticamente pela idade e validade:

| Nível | Condição | L/P e Rentabilidade | Patrimônio |
|-------|----------|---------------------|------------|
| **A** Confiável | fonte real, válida, < 15 min | ✅ permitido | ✅ oficial + estimado |
| **B** Desatualizada | 15–60 min | ❌ bloqueado ("Cotação desatualizada") | ✅ oficial + estimado |
| **C** Não confiável | API falhou / inválida / ausente / > 60 min | ❌ bloqueado ("Cotação não confiável") | ⚠️ só estimado (última cotação) |

- **Patrimônio Oficial** = caixa + ativos oficiais + ações **A e B**.
- **Patrimônio Estimado** = caixa + ativos estimados + ações **A, B e C** (última cotação conhecida).
- **Patrimônio Parcial**: quando há ativos C, exibe quantidade bloqueada, impacto e motivo.
- **Nota de confiabilidade (0–100)** por ativo: sucesso/falha das integrações, frescor, frequência e consistência (breakdown auditável).

## Provedores de cotação (fallback)

Brapi → Yahoo Finance → Alpha Vantage → Finnhub. Cada tentativa é registrada
(`quote_attempts`) para diagnóstico e score. Se todos falharem, o modo **manual**
mantém o sistema 100% funcional. Botão **Verificar na internet** (Google/Yahoo/Brapi)
permite conferência manual por ativo.

## Status dos requisitos (auditoria final)

| Requisito | Status |
|-----------|--------|
| 1. Sistema de confiabilidade A/B/C | ✅ |
| 2. Patrimônio Oficial × Estimado + diferença | ✅ |
| 3. Patrimônio Parcial (bloqueados, impacto, motivo) | ✅ |
| 4. Aba Diagnóstico (por ativo + painel geral) | ✅ |
| 5. Múltiplos provedores com fallback | ✅ |
| 6. Aporte para Ações (recalcula preço médio) | ✅ |
| 7. Aporte para Vendas (entrada de estoque + observação) | ✅ |
| 8. Meta de Renda Passiva (mensal, progresso, estimativa) | ✅ |
| 9. Dashboard de Saúde (aba Saúde) | ✅ |
| 10. Nota de confiabilidade por ativo (0–100) | ✅ |
| 11. Botão Verificar na Internet | ✅ |

> Observação: as integrações externas dependem de acesso de rede de saída. No
> ambiente de teste os provedores retornaram 403, o que exercitou exatamente o
> fallback (multi-provedor → manual). Com `*_KEY`/rede configurados, o modo
> automático passa a funcionar sem alterações no código.
```

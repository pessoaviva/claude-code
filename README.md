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

## Testes

```bash
npm test            # testes da aritmética financeira (node:test)
```

## Módulos da UI

Dashboard · Ganhos · Gastos · Ações · Cotações · Patrimônio · Vendas · Metas ·
Auditoria (abas **Logs** e **Diagnóstico**).
```

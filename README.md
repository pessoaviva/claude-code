# FinTrack Pro

Sistema financeiro completo para gerenciar **ganhos, gastos, patrimônio, ações,
vendas/estoque, metas e relatórios** — com foco em **precisão financeira
auditável**.

## Como funciona — app 100% no navegador (sem banco)

O FinTrack Pro roda inteiro no **navegador**: todos os dados ficam no
`localStorage` (nada é enviado a servidores) e toda a lógica financeira
(precisão decimal, carteira, A/B/C, score, COGS, metas, auditoria) executa no
front-end. Resultado: **site estático**, deploy de 1 clique, **sem banco de
dados e sem variáveis de ambiente**.

- ✅ Todas as funções funcionam offline. Cotações são **manuais** (a busca
  automática por APIs externas não está disponível no modo navegador).
- ⚠️ Os dados ficam **somente neste navegador/dispositivo** (sem sincronização).
  Limpar os dados do navegador apaga tudo. Há um botão "Limpar todos os dados".

> **Modo servidor (opcional, legado):** a pasta `server/` traz a mesma lógica
> como API Node + Express + PostgreSQL, caso você queira persistência
> centralizada/multi-dispositivo. Não é necessária para usar o app.

### Rodar local

```bash
npm install
npm run dev          # Vite em http://localhost:5173
```

### Deploy (Netlify, estático, 1 clique)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/pessoaviva/claude-code)

`netlify.toml` já define build (`web/dist`) e fallback SPA. **Não precisa
configurar banco nem variáveis.** Serve em qualquer host estático (Netlify,
Vercel, GitHub Pages, etc.).

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
│       │   ├── schema.ts      Schema do banco (string SQL)
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

## Modo servidor (opcional, legado)

A pasta `server/` mantém a mesma lógica como API Node + Express + PostgreSQL,
para quem quer persistência centralizada/multi-dispositivo. **Não é necessária**
para o app, que por padrão usa o `localStorage` (modo navegador).

```bash
docker compose up -d db
cp server/.env.example server/.env
npm install
npm run migrate --workspace=server       # aplica o schema
npm run seed --workspace=server           # (opcional) dados de exemplo
npm run dev --workspace=server            # API em :4000
```

Para usar esse backend, o cliente (`web/src/lib/api.ts`) precisaria voltar a
fazer chamadas HTTP a `/api` (hoje ele chama o store local do navegador).

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

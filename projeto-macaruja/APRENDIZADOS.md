# Projeto Macarujá — Aprendizados & Decisões

> Documento de memória do projeto (engorda de precisão · Fazenda Macarujá · marca AB).
> Importável no Notion: **Import → Markdown**.

---

## 1. Contexto do negócio

- Fazenda **Macarujá**, marca **AB**, engorda de **gado de corte**.
- Operação mista: **gado à pasto** + **semiconfinamento** (geridos separadamente).
- Foco econômico: **custo por arroba (@) produzida** e **resultado por lote/animal**.
- Hospedagem desejada: **Vercel + Supabase + domínio próprio**; uso intenso no **iPhone**.
- Estilo de trabalho: **incremental e objetivo** — evolução por camadas; quando dito
  “faça o que achar melhor”, espera-se **priorizar e entregar**, não reperguntar.

### Vocabulário do domínio (vira requisito de produto)
- **GMD** (ganho médio diário) e **intervalo em dias** entre pesagens.
- Raças: **Angus, Nelore, Mestiço**.
- Categorias: **bezerro, garrote, animal adulto**; sexo: macho/fêmea/castrado.
- Vermífugos: ivermectina 3,5%, doramectina, longamectina, ripercol…
- Modificadores orgânicos: monensina, virginiamicina…
- Venda com **CPF/CNPJ**; morte/baixa com **causa e cercado**.

---

## 2. Lições técnicas

### Persistência de dados
- **`localStorage` é frágil no iOS**: o Safari pode apagar dados de sites pouco
  usados após ~7 dias. Solução em **3 camadas**: local + backup JSON/Share + Supabase.
- Isso motivou o **lembrete de backup**, o **compartilhar p/ iCloud** e o **auto-sync**.
- **Web Share API** (`navigator.canShare({files})`) é o caminho certo no iPhone para
  salvar o JSON direto no app **Arquivos/iCloud**, com fallback para download.

### Auto-sincronização
- Precisa de **trava anti-loop**: `save()` agenda o sync e `saveCloud()` chama `save()`
  no fim → sem um guard (`syncing`) viraria ciclo infinito a cada 4 s.
- Resolvido com **flag `syncing` + debounce** e variante **`saveCloud(silent)`**.
- Modelo adotado: **“local manda”** (sobrescreve a nuvem). Simples e seguro contra
  perda, **mas não é multi-usuário simultâneo** (precisaria de merge/last-write-wins).

### iOS / PWA “de verdade”
- Inputs **16px** (senão dá zoom), alvos de toque **≥44px**, **safe-area insets**.
- **Bottom sheets** no lugar de `prompt`; metatags Apple; dock inferior estilo iOS.
- **`apple-touch-startup-image`** com *media queries* por device (manutenção recorrente).
- Ícone **maskable** com **zona segura** (conteúdo a ~84%).

### Segurança (Supabase + Vercel)
- RLS `anon using(true)` é catástrofe → o certo é **Auth + RLS por `auth.uid()`**.
- Só a **anon/publishable key** no front; **nunca** a `service_role`.
- **CSP/HSTS/X-Frame-Options** no `vercel.json`.
- **Escape anti-XSS** em todo dado livre renderizado via `innerHTML`.

### Design gerado por código
- Desenhar em **canvas “no escuro” erra fácil**: a 1ª silhueta de boi saiu cabra/cervo.
- Só acertei **renderizando → olhando o screenshot → iterando** (chifres em crescente,
  cabeça larga, **AB gravado na testa** como marca a ferro). **Ver > confiar no código.**

---

## 3. Lições de processo (incl. tropeços)

- **Editar cirurgicamente** arquivos grandes e **revalidar a cada passo**
  (`node --check` + teste de runtime com stubs) evita regressões e pega bugs cedo.
- **Stubs do harness importam**: testes quebraram por faltar `location`; `eval` com
  `'use strict'` isola escopo (foi preciso injetar o teste dentro do código avaliado).
- **O cwd reseta a cada comando** de shell: esquecer o `cd` fez o servidor servir a
  pasta errada (404). Usar **caminhos/`cd` explícitos**.
- **Rede restrita**: o download do Chromium é bloqueado, **mas havia um pré-instalado
  em `/opt/pw-browsers`** — usado para gerar ícones/splash via canvas e screenshots.
  *Checar o que já existe antes de concluir “não dá”.*
- **Confirmar decisões de arquitetura** no início (login obrigatório vs PIN; navegação
  mobile) poupa retrabalho; o resto, decidir e seguir.
- **Mostrar, não só afirmar**: enviar screenshots e arquivos torna cada entrega
  verificável — e força a olhar o resultado de fato.

---

## 4. Pontos de atenção / dívidas técnicas

- **Auto-sync** sobrescreve a nuvem (modelo “local manda”): rever se um dia houver
  **múltiplos usuários** editando ao mesmo tempo.
- **Splash screens** cobrem iPhones comuns, mas a matriz da Apple muda a cada modelo.
- O repositório “hospedeiro” (FinTrack) não tem relação; tudo isolado em
  `projeto-macaruja/` para não misturar.

---

## 5. Estado atual (v2.1) — entregue

| Área | Entregue |
|---|---|
| Custos | Custo por @ produzida (lote/geral) e ração por kg |
| Lotes | Entrada, GMD, objetivo de GMD, saída prevista, peso alvo, cronômetro, dias na dieta, sugestão de dieta |
| Rebanho | Raça/categoria/sexo em listas; pasto × semi; dias na fazenda; alocação p/ montar lotes |
| Pesagens | Intervalo em dias + GMD por período |
| Saúde | Vacinas, vermífugos, vitaminas, modificadores (com “Outro”) |
| Vendidos & Baixas | Venda com comprador/CPF/lote; botão Morreu (causa + cercado); sem carimbo “VENDIDO” |
| Segurança | Supabase Auth + RLS por dono; anti-XSS; CSP/HSTS |
| App iOS/PWA | Dock, bottom sheets, ícone de boi com AB, splash nativas, instalável e offline |
| Dados | Lembrete de backup, compartilhar p/ iCloud, prazo configurável, auto-sync |

**Repositório:** `projeto-macaruja/` · **PR:** #1

---

## 6. Próximos passos sugeridos

- **Integração RFID** real (bastão/balança) gravando pesagens automaticamente.
- **Projeção de peso** até o alvo (data ótima de abate) e **conversão alimentar**.
- **Multi-usuário** com sync mais fino (last-write-wins / merge).
- Acompanhar o **PR #1** (CI + revisões).

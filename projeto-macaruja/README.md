# Projeto Macarujá v2.1 — Gestão de Engorda de Precisão

App de página única (HTML + JavaScript) para gestão de engorda de gado de corte
da **Fazenda Macarujá (marca AB)**. Funciona **offline** (localStorage) e,
opcionalmente, sincroniza com **Supabase** com **login obrigatório e RLS por
dono** (cada usuário só acessa os próprios dados). Pronto para hospedar no
**Vercel** com **domínio próprio**.

## O que esta versão entrega

### Custo e resultado
- **Custo por arroba (@) produzida** por lote e geral.
- Custo da ração **por kg** e por cabeça/dia, calculado dos ingredientes.
- Resultado (lucro) por **animal**, por **lote** e por **dieta**; rankings.

### Lotes / Semiconfinamento
- **Data de entrada**, **GMD médio**, **objetivo de GMD**.
- **Data prevista de saída** (a partir da duração prevista) e **peso alvo**.
- **Cronômetro regressivo** (dias para a saída) + **dias que o animal já está
  na dieta**.
- **Sugestão automática de modificação da dieta** conforme o GMD x meta.
- Dieta vinculada com **custo R$/kg** visível.

### Rebanho
- Cadastro de **todo o rebanho** com origem, fornecedor, valor de compra.
- **Raça**: Angus / Nelore / Mestiço (lista).
- **Categoria**: Bezerro / Garrote / Animal adulto (lista).
- **Sexo**: Macho / Fêmea / Castrado (lista).
- **Separação à pasto x semiconfinamento** (filtro e KPIs dedicados).
- **Dias na Fazenda Macarujá** para cada animal.
- Tela de **Alocação**: pinçar animais e montar lotes de semiconfinamento
  (ou devolver ao pasto).

### Pesagens
- Histórico por brinco/EID.
- **Intervalo em dias** entre pesagens **+ GMD por período** (P1→P2, P2→P3…).

### Vendidos & Baixas (novo na v2.1)
- Botão **Vendido** abre um formulário com **comprador, CPF/CNPJ, data, peso,
  preço da @, lote de origem** e observação (GTA/nota). O animal sai do rebanho
  ativo e vai para a aba **Vendidos & Baixas** com receita e lucro calculados.
- Botão **Morreu** registra **causa** e **cercado/pasto**; entra na seção
  **Mortes/Baixas** com o prejuízo estimado (compra + alimentação).
- Removido o carimbo "VENDIDO" do brinco; vendidos/baixas saem do rebanho ativo.
- Botão **Reativar** para desfazer uma venda/baixa.

### Design / experiência de app iOS (novo na v2.1)
- Tipografia San Francisco (`-apple-system`) com números **tabulares** em KPIs,
  tabelas e métricas; títulos e espaçamentos refinados.
- **Dock inferior estilo iOS**: 4 abas (Início, Rebanho, Lotes, Saúde) + **Mais**.
- **Bottom sheets** nativos para venda/baixa (em vez de pop-ups).
- Campos com fonte 16px (sem zoom automático no iPhone), alvos de toque ≥44px,
  respeito às **safe areas** (notch/home indicator), feedback de toque.
- Metatags de **PWA** (Adicionar à Tela de Início abre em tela cheia).

### Saúde (novo módulo)
- **Vacina** (Clostridiose, Raiva, Aftosa, Brucelose… + Outra).
- **Vermífugo** (Ivermectina 3,5%, Doramectina, Longamectina, Ripercol,
  Albendazole, Levamisol… + Outro).
- **Vitamina** (ADE, B12, E+Selênio… + Outra).
- **Modificador orgânico** (Monensina, Virginiamicina, Probiótico, Tanino,
  Óleo essencial… + Outro).
- Campo "Outro (especificar)" em todos. Histórico sanitário do rebanho.

### Segurança da informação
- **Login obrigatório (Supabase Auth)** para qualquer sincronização.
- **RLS por dono**: políticas amarradas a `auth.uid()` — sem login, nenhum
  acesso (substitui as políticas abertas `anon using(true)` da v1).
- **Escape de HTML (anti-XSS)** em todos os campos livres exibidos.
- **Cabeçalhos de segurança** no Vercel (`vercel.json`): CSP, HSTS,
  X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy.
- Só a **anon/publishable key** vai ao navegador — **nunca** a `service_role`.
- Import/export de **backup JSON**.

## Deploy

### 1. Banco (Supabase)
1. Crie um projeto em https://supabase.com.
2. **SQL Editor** → cole o conteúdo de [`supabase.sql`](./supabase.sql) → **Run**.
3. **Authentication → Providers**: ative **Email** (senha forte; confirmação de
   e-mail recomendada).
4. **Authentication → URL Configuration**: em *Site URL* e *Redirect URLs*,
   coloque **apenas o seu domínio** (ex.: `https://macaruja.suafazenda.com`).
5. Copie em **Project Settings → API**: a **Project URL** e a **anon/publishable
   key** (a `service_role` fica em segredo, fora do front).

### 2. Hospedagem (Vercel) + domínio próprio
1. Importe este repositório/pasta no Vercel (projeto **estático**; sem build).
2. O `vercel.json` já aplica os cabeçalhos de segurança e serve o `index.html`.
3. Em **Settings → Domains**, adicione seu domínio e aponte o DNS conforme o
   Vercel indicar. O HTTPS é automático.

### 3. Primeiro uso
1. Abra o app no domínio → menu **Configuração**.
2. Cole **Project URL** e **anon key** → *Salvar configuração*.
3. **Criar conta** → **Entrar**.
4. *Enviar local → Supabase* para subir os dados (ou *Carregar* para baixar).

## App instalável (PWA) — funciona offline

O projeto é um **PWA** completo: dá para instalar como app, com ícone próprio e
funcionamento **offline** (o app shell fica em cache pelo service worker).

- **iPhone/iPad (Safari):** abra o site → Compartilhar → **Adicionar à Tela de
  Início**. Abre em tela cheia, sem barra do Safari, usando o ícone AB.
- **Android (Chrome):** menu → **Instalar app** / “Adicionar à tela inicial”.
- **Desktop (Chrome/Edge):** ícone de instalar na barra de endereço.

Requisito: servir por **HTTPS** (o Vercel já faz). Em `file://` o service worker
fica desativado (o app continua funcionando, só sem cache offline).

> **Lembrete de backup:** como o iOS pode apagar o `localStorage` de sites pouco
> usados após ~7 dias, o app guarda a data do último backup/sincronização e
> exibe um **aviso no topo** quando passam 7 dias (ou nunca houve backup), com
> atalhos para **Baixar JSON** e **Sincronizar** com o Supabase. A data zera ao
> baixar o backup ou sincronizar.
>
> Em Configuração há ainda: **Compartilhar backup** (Web Share — salva o JSON
> direto no app **Arquivos/iCloud** no iPhone), **prazo do lembrete**
> configurável (3/7/15/30 dias) e **auto-sincronizar quando logado** (envia
> para o Supabase, em segundo plano, alguns segundos após cada alteração).

No iPhone, ao abrir a partir da Tela de Início, aparece uma **splash screen
nativa** (boi com a marca AB + “Projeto Macarujá”), gerada para as resoluções
de iPhone mais comuns em `splash/`.

Arquivos do PWA: `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`,
`icon-512-maskable.png`, `apple-touch-icon-180.png` e `splash/*.png`. O ícone é
uma **silhueta de boi (zebu) com o “AB” gravado na testa**, como marca a ferro.

## Telas (capturas)

Em `screenshots/` há capturas reais do app (Chromium): desktop e iPhone, claro
e escuro, incluindo a aba **Vendidos & Baixas**, o módulo **Saúde**, o **dock
inferior** e o **bottom sheet** de venda.

## Arquivos
| Arquivo | Função |
|---|---|
| `index.html` | O app completo (UI + lógica). |
| `supabase.sql` | Tabelas + RLS por dono + Saúde + Baixas + RFID. |
| `vercel.json` | Cabeçalhos de segurança e hospedagem estática. |
| `manifest.json` · `sw.js` | PWA instalável + cache offline. |
| `icon-*.png` · `apple-touch-icon-180.png` | Ícones do app. |
| `screenshots/` | Capturas de tela (desktop/iPhone, claro/escuro). |

## Próximos passos sugeridos
- Integração **RFID** real (bastão/balança) gravando em `leituras_rfid`.
- Curva de **projeção de peso** vs. peso alvo (data de abate ótima).
- Conversão alimentar (kg MS / kg de ganho) por lote.

# Projeto Macarujá v2.0 — Gestão de Engorda de Precisão

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

## Uso local / iPhone
- Abra `index.html` direto no navegador (tudo roda offline; dados no aparelho).
- iPhone: Safari → Compartilhar → **Adicionar à Tela de Início** (vira "app").

## Arquivos
| Arquivo | Função |
|---|---|
| `index.html` | O app completo (UI + lógica). |
| `supabase.sql` | Tabelas + RLS por dono + Saúde + RFID. |
| `vercel.json` | Cabeçalhos de segurança e hospedagem estática. |

## Próximos passos sugeridos
- Integração **RFID** real (bastão/balança) gravando em `leituras_rfid`.
- Curva de **projeção de peso** vs. peso alvo (data de abate ótima).
- Conversão alimentar (kg MS / kg de ganho) por lote.

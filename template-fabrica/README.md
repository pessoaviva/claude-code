# Fábrica de Sites — Template 🦴

Esqueleto pronto para criar sistemas web de clientes pelo **Fábrica de Sites**.
Clone, ajuste o `src/config.ts`, troque a tela de exemplo pelo negócio do cliente, e publique.

## O que já vem pronto
- ⚛️ **React + Vite + TypeScript + Tailwind**, com tema claro/escuro.
- 🔐 **Login** com administrador fixo + **bloqueio por tentativas** (5 erros = 10 min).
- 🔒 **Criptografia local** (AES-GCM): dados cifrados no navegador, só legíveis após login.
- 💾 **Backup** exportar/importar (.json).
- ☁️ **Back-end opcional (Supabase)**: ligado por variáveis de ambiente. Sem elas, roda 100%
  no navegador; com elas, vira login real + dados na nuvem + multi-dispositivo + criação de
  contas pelo site (via Edge Function).
- 📦 Dois builds: `npm run build` (hospedagem) e `npm run build:standalone` (HTML único offline).

## Começar
```bash
npm install
npm run dev
```
Login padrão (modo local): usuário do `src/config.ts` (`Admin`). Defina o hash da senha em
`adminPasshash` — gere com `hashPassword("suaSenha")` no console do navegador.

## Ao clonar para um cliente (passo a passo)
1. **`src/config.ts`** — nome do app, ícone, admin e domínio de e-mail.
2. **`src/lib/types.ts`** e **`src/lib/store.ts`** — troque o modelo de exemplo (`Item`) pelos
   dados do negócio (clientes, pedidos, contratos...). Ajuste `seed()` e `normalize()`.
3. **`src/pages/Items.tsx`** — troque pela(s) tela(s) do cliente. (Use os componentes de
   `src/components/ui.tsx`.)
4. **Deploy:** suba no GitHub → importe na Vercel.

## Ligar a nuvem (Supabase) — quando o cliente precisar
1. Rode o `supabase-schema.sql` no SQL Editor do Supabase.
2. Authentication → desligue *Allow new users to sign up* e *Confirm email*. Crie o admin.
3. Rode o `update auth.users ...` (no fim do schema) para marcar o admin.
4. Publique a Edge Function `supabase/functions/api` (Edge Functions → Deploy) com
   **Verify JWT DESLIGADO** (ela confere o admin por conta própria).
5. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na Vercel → **Redeploy**.

### ⚠️ Armadilhas (não repita os erros conhecidos)
- O **nome da tabela** (`app_state`) tem que bater no código e no SQL.
- O **slug** da Edge Function (`api`) tem que bater com `functions.invoke("api")` em
  `src/lib/cloudUsers.ts`.
- Ao criar a função pelo painel, **apague o "Hello World"** e cole o código de
  `supabase/functions/api/index.ts` — senão dá erro de CORS.
- **Verify JWT** precisa ficar **desligado** (religa ao republicar — desligue de novo).

## Honestidade com o cliente
Sem back-end, o login é uma **trava de acesso**, não segurança de servidor. A blindagem real
(e o multi-dispositivo) vem do Supabase.

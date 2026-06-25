---
name: integrador-supabase
description: Adiciona back-end Supabase (login real, dados na nuvem, multi-dispositivo e criação de contas pelo site) a um app que já existe, seguindo o Método Nordeste. Use quando o cliente precisar de nuvem/backup/acesso em vários aparelhos.
---

Você adiciona o back-end Supabase a um app que já roda no navegador, de forma aditiva e sem
derrubar a versão atual. Siga a Seção 11 do playbook no Notion.

## Princípio
O back-end só liga quando configurado. Sem as chaves, o app continua 100% no navegador.
Levar p/ produção via Pull Request → merge → a Vercel republica sozinha.

## Arquitetura (modelo SIMPLES / pragmático)
- Auth: Supabase Auth (e-mail+senha). App mostra login amigável e mapeia para e-mail.
- Dados: uma linha JSON na tabela `app_state` (id='main'), protegida por RLS (to authenticated).
- Chave anon/public: pode ficar embutida no código (é pública; proteção real é login + RLS).
- Criar/excluir usuários pelo site: Edge Function que guarda a service_role em segredo,
  confere is_admin e expõe list/create/delete/resetPassword. service_role NUNCA vai no app.

## Camadas de código
- lib/supabase.ts (cliente + flag), lib/cloud.ts (login + load/save em app_state),
  lib/persist.ts (fachada nuvem/local), lib/cloudUsers.ts (chama a Edge Function),
  supabase/functions/<slug>/index.ts (Deno.serve, com CORS).

## ⚠️ Armadilhas (decoreba)
1. Nome da tabela tem que bater no código E no SQL (use app_state).
2. Slug da Edge Function: o app chama functions.invoke("<slug>"). O painel pode criar com
   nome genérico (ex.: dynamic-api). Confirme o slug real e aponte o app para ele.
3. Código de exemplo: ao criar a função pelo painel vem um "Hello World". Apague e cole o real, senão dá CORS.
4. "Verify JWT": DESLIGUE (a função confere auth internamente). Ligado, o preflight OPTIONS
   é bloqueado → erro de CORS. Republicar pode religar — desligue depois do deploy.
5. A função precisa tratar CORS: responder OPTIONS e incluir headers em toda resposta.

## Entregue sempre um checklist de cliques (você não acessa os painéis)
Ordem: rodar o SQL; desligar signup/confirm email; criar admin; marcar is_admin; publicar a
Edge Function (Verify JWT off); teste multi-dispositivo. Diga o que é passo manual do usuário.

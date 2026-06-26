/**
 * ⚙️ Configuração do projeto — AJUSTE AQUI ao clonar para um novo cliente.
 *
 * Tudo que muda de cliente para cliente fica neste arquivo, para você não ter
 * que caçar valores espalhados pelo código.
 */
export const APP_CONFIG = {
  /** Nome exibido no topo e na tela de login. */
  appName: "Meu Sistema",
  /** Subtítulo opcional (ex.: "· Financeiro"). Deixe "" para nenhum. */
  appSubtitle: "",
  /** Emoji/ícone do app (aparece no topo e no login). */
  appIcon: "🗂️",

  /** Login do administrador (o app mostra este nome amigável). */
  adminUsername: "Admin",
  /** Nome completo do administrador. */
  adminName: "Administrador",
  /**
   * Hash da senha do admin no modo LOCAL (sem back-end).
   * Gere abrindo o app, no console do navegador: `hashPassword("suaSenha")`
   * (a função está exportada em src/lib/auth.ts). No modo nuvem (Supabase) a
   * senha é validada pelo Supabase Auth, então este hash é ignorado.
   */
  adminPasshash: "0", // TODO: trocar antes de entregar

  /**
   * Domínio usado para transformar o login em e-mail no Supabase Auth.
   * Ex.: "minhaempresa.app" → o login "Admin" vira "admin@minhaempresa.app".
   */
  emailDomain: "exemplo.app",
};

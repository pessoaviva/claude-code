/** Tema claro/escuro persistido no navegador. Padrão: escuro. */
export type Theme = "light" | "dark";

const KEY = "app_theme:v1";

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Aplica o tema no <html> (classe `dark`) e persiste a escolha. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}

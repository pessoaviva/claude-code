import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Dois alvos de build:
//  - padrão (Vercel/Netlify): assets separados e hasheados, base "/" (CDN).
//  - "standalone" (--mode standalone): um único index.html autossuficiente
//    (CSS e JS embutidos) que abre por duplo-clique (file://). base "./".
export default defineConfig(({ mode }) => {
  const standalone = mode === "standalone";
  return {
    base: standalone ? "./" : "/",
    plugins: [react(), ...(standalone ? [viteSingleFile()] : [])],
    server: { port: 5173 },
  };
});

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { applyTheme, getTheme } from "./lib/theme";
import "./index.css";

// Aplica o tema antes de renderizar para evitar "flash" de tema errado.
applyTheme(getTheme());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

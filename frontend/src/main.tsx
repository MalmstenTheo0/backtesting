import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { applyThemeToDocument, readStoredTheme } from "./lib/themeStorage";
import "./index.css";

applyThemeToDocument(readStoredTheme());

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

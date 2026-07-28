import { defineConfig } from "vitest/config";

/**
 * Config propia de vitest, separada de vite.config.ts a propósito.
 *
 * vitest trae su propia versión de Vite, distinta de la que usan `dev` y `build`.
 * Cargar `@vitejs/plugin-react` acá mezcla las dos y emite warnings de opciones
 * deprecadas. El plugin sirve para Fast Refresh, que en tests no hace falta: el JSX
 * lo transforma vitest respetando `"jsx": "react-jsx"` del tsconfig.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/hooks/**", "src/services/**"],
      reporter: ["text", "text-summary"],
    },
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Configuración de Vitest (doc 06 §3, doc 12 §testing).
 * Entorno `node` para Fase 0–7 (lógica/API). El entorno `jsdom` y los tests de UI
 * se añaden en la Fase 8 junto con la biblioteca de componentes.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "dist/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});

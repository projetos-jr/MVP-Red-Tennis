import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Testes com o Supabase de verdade: `npm run test:integracao`.
    exclude: ["src/**/*.integracao.test.ts", "node_modules/**"],
  },
});

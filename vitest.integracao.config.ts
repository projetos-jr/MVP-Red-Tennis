import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Testes de integracao: as operacoes das telas gravando num Supabase de
 * verdade (local ou do CI). Como rodar: `src/lib/supabase/integracao/ambiente.ts`.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.integracao.test.ts"],
    // Um arquivo de cada vez: todos gravam no mesmo banco.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

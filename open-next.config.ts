import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Configuracao padrao: sem cache incremental. O MVP renderiza as telas
// internas sob demanda (ver src/app/(app)/layout.tsx), entao nao ha o que
// guardar entre requisicoes.
export default defineCloudflareConfig();

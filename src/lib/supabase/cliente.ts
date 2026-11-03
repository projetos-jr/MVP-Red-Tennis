/**
 * Ligacao com o Supabase.
 *
 * O site so usa o Supabase quando as duas variaveis de ambiente estao
 * preenchidas (modelo em `.env.example`). Sem elas, abre em MODO
 * DEMONSTRACAO: dados de exemplo em memoria, como antes.
 *
 * So a chave PUBLICAVEL vai para o site. Quem a tem so ve o que a RLS deixa
 * (e, sem login, nada).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_DO_PROJETO = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_PUBLICAVEL = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** true = o site usa o Supabase; false = modo demonstracao. */
export const USA_SUPABASE = URL_DO_PROJETO !== "" && CHAVE_PUBLICAVEL !== "";

let cliente: SupabaseClient | null = null;

/** Cliente unico do navegador (guarda a sessao de login no proprio navegador). */
export function clienteSupabase(): SupabaseClient {
  if (!USA_SUPABASE) {
    throw new Error("Supabase nao configurado: preencha as variaveis de .env.example.");
  }
  cliente ??= createClient(URL_DO_PROJETO, CHAVE_PUBLICAVEL, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return cliente;
}

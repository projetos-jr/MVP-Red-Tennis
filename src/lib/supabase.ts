import { createClient } from "@supabase/supabase-js";

/**
 * Cliente do Supabase usado no navegador.
 *
 * A URL e a chave publicavel podem ficar no codigo: a chave so permite o que
 * as politicas de RLS do banco liberam, e todas exigem um colaborador logado.
 * As variaveis de ambiente permitem apontar para outro projeto (ex.: testes).
 */
const URL_SUPABASE =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://xfludepkrcnwovnckpfc.supabase.co";

const CHAVE_PUBLICAVEL =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_YqpAjBoA8e6_ZGNT-9V5fQ_cSFcwikS";

export const supabase = createClient(URL_SUPABASE, CHAVE_PUBLICAVEL);

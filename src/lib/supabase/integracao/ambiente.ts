/**
 * Apoio dos testes de integracao (`*.integracao.test.ts`): as telas gravando
 * num Supabase de verdade (o local, `npx supabase start`, ou o do CI).
 *
 * Como rodar (veja tambem `docs/ARQUITETURA.md`):
 *
 *   npx supabase start
 *   npm run banco:seed && npx supabase db reset      # banco limpo com os dados de exemplo
 *   SUPABASE_TESTE_URL=http://127.0.0.1:54321 SUPABASE_TESTE_CHAVE_SECRETA=... node scripts/integracao/preparar.mjs
 *   SUPABASE_TESTE_URL=http://127.0.0.1:54321 SUPABASE_TESTE_CHAVE=<PUBLISHABLE_KEY> npm run test:integracao
 *
 * Os testes criam os proprios registros (nomes e datas unicos por execucao),
 * entao podem rodar varias vezes no mesmo banco.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Operacao } from "@/lib/banco/executar";
import type { Banco, Colaborador, Perfil } from "@/lib/banco/tipos";
import { carregarTabelas } from "../carregar";
import { bancoVazio } from "../conversao";
import { executarNoSupabase, type ResultadoNoBanco } from "../executar";
import "../operacoes";
import { CONFIGURACOES_INICIAIS } from "@/lib/banco/semente/cadastros";

export const URL_DE_TESTE = process.env.SUPABASE_TESTE_URL ?? "";
const CHAVE = process.env.SUPABASE_TESTE_CHAVE ?? "";
const SENHA = process.env.SUPABASE_TESTE_SENHA ?? "senha-local-123";

/** Sem Supabase de teste configurado, os testes de integracao sao pulados. */
export const SEM_BANCO_DE_TESTE = URL_DE_TESTE === "" || CHAVE === "";

export interface Sessao {
  cliente: SupabaseClient;
  colaborador: Colaborador;
  banco: Banco;
}

/** Entra como o usuario de teste do perfil e le o banco. */
export async function entrar(perfil: Perfil): Promise<Sessao> {
  const cliente = createClient(URL_DE_TESTE, CHAVE, { auth: { persistSession: false } });
  const { data, error } = await cliente.auth.signInWithPassword({
    email: `${perfil}@teste.local`,
    password: SENHA,
  });
  if (error) throw new Error(`Login de ${perfil}: ${error.message} (rodou scripts/integracao/preparar.mjs?)`);
  const banco = { ...bancoVazio(CONFIGURACOES_INICIAIS), ...(await carregarTabelas(cliente)) };
  const colaborador = banco.colaboradores.find((c) => c.id === data.user.id);
  if (!colaborador) throw new Error(`${perfil}@teste.local nao esta em colaboradores.`);
  return { cliente, colaborador, banco };
}

/** Executa como a tela faria; com sucesso, a sessao passa a ver o banco relido. */
export async function executar<Dados>(
  sessao: Sessao,
  operacao: Operacao<Dados>,
  dados: Dados,
): Promise<ResultadoNoBanco> {
  const resultado = await executarNoSupabase({
    cliente: sessao.cliente,
    banco: sessao.banco,
    colaborador: sessao.colaborador,
    operacao,
    dados,
  });
  if (resultado.ok) sessao.banco = resultado.banco;
  return resultado;
}

/** Le tudo de novo (para conferir o que ficou gravado). */
export async function reler(sessao: Sessao): Promise<Banco> {
  sessao.banco = { ...sessao.banco, ...(await carregarTabelas(sessao.cliente)) };
  return sessao.banco;
}

/** Sufixo unico desta execucao, para nomes que nao podem repetir. */
export const EXECUCAO = Date.now().toString(36);

/**
 * Uma data futura livre para os testes de agenda: muda a cada execucao (para
 * nao esbarrar nos registros de execucoes anteriores) e fica alem dos dados
 * de exemplo. `deslocamento` separa os testes entre si.
 */
export function dataDeTeste(deslocamento = 0): string {
  const base = new Date(Date.UTC(2027, 6, 1));
  const dias = (Number.parseInt(EXECUCAO, 36) % 700) + deslocamento;
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

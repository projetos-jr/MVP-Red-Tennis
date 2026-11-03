/**
 * Executa uma operacao da tela no banco real (modo Supabase):
 *
 *  1. roda a operacao no banco da tela, com as mesmas regras e mensagens
 *     (o que ela recusar nem e enviado);
 *  2. grava no Supabase pela ligacao da operacao (`./operacoes/`);
 *  3. le de novo as tabelas que mudaram (e o historico).
 *
 * Usado pelo `AppStore` e pelos testes de integracao.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { HOJE } from "@/lib/banco/constantes";
import { executarOperacao, type Operacao } from "@/lib/banco/executar";
import type { Banco, Colaborador } from "@/lib/banco/tipos";
import { agoraArena } from "@/lib/date";
import { carregarTabelas } from "./carregar";
import { ErroDoBanco, mensagemDoErro } from "./erros";
import { gravacaoDe } from "./gravar";

export type ResultadoNoBanco =
  | {
      ok: true;
      /** Banco da tela com as tabelas relidas do Supabase. */
      banco: Banco;
      /** Id do registro principal criado, quando houver. */
      id?: string;
      /** A releitura falhou: `banco` e o resultado calculado na tela. */
      releituraFalhou?: boolean;
    }
  | {
      ok: false;
      erro: string;
      /** O banco recusou: tabelas que vale ler de novo. */
      recarregar?: Parameters<typeof carregarTabelas>[1];
    };

export async function executarNoSupabase<Dados>(args: {
  cliente: SupabaseClient;
  banco: Banco;
  colaborador: Colaborador;
  operacao: Operacao<Dados>;
  dados: Dados;
}): Promise<ResultadoNoBanco> {
  const { cliente, banco, colaborador, operacao, dados } = args;

  const local = executarOperacao(banco, operacao, dados, {
    usuario: colaborador,
    agora: agoraArena(),
    hoje: HOJE,
  });
  if (!local.ok) return local;

  const gravacao = gravacaoDe(operacao);
  if (!gravacao) {
    return { ok: false, erro: `A operação "${operacao.nome}" ainda não foi ligada ao banco.` };
  }

  let retorno;
  try {
    retorno = await gravacao.gravar(dados, {
      cliente,
      antes: banco,
      depois: local.banco,
      operacao: operacao.nome,
    });
  } catch (erro) {
    return {
      ok: false,
      erro: erro instanceof ErroDoBanco ? erro.message : mensagemDoErro(erro),
      recarregar: gravacao.recarregar,
    };
  }

  try {
    const lidas = await carregarTabelas(cliente, [...gravacao.recarregar, "auditoria"]);
    return { ok: true, banco: { ...banco, ...lidas }, id: retorno?.id };
  } catch {
    return { ok: true, banco: local.banco, id: retorno?.id, releituraFalhou: true };
  }
}

/**
 * Gravacao no banco real.
 *
 * Cada operacao das telas (`src/lib/banco/operacoes/`) e "ligada" a uma forma
 * de gravar no Supabase (`src/lib/supabase/operacoes/`):
 *
 *  - `porFuncao(...)`: chama uma funcao do Postgres (`supabase.rpc`). E o caso
 *    das operacoes que gravam em varias tabelas ou tem regra critica; o banco
 *    confere tudo de novo e grava tudo ou nada.
 *  - `espelhar([...])`: grava direto nas tabelas o que a operacao mudou no
 *    banco da tela (cadastros simples de uma linha). As constraints e a RLS
 *    do banco continuam valendo.
 *
 * Antes de ir ao banco, a operacao roda no banco da tela, com as mesmas regras
 * e mensagens: o que ela recusar nem chega a ser enviado. Depois de gravar, as
 * tabelas afetadas sao lidas de novo: a tela sempre mostra o que esta no banco.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Operacao } from "@/lib/banco/executar";
import type { Banco, TabelaDeRegistros, TabelaDoBanco } from "@/lib/banco/tipos";
import { paraBanco, paraSnake } from "./conversao";
import { ErroDoBanco, mensagemDoErro } from "./erros";

export interface ContextoGravacao {
  cliente: SupabaseClient;
  /** Banco da tela antes da operacao. */
  antes: Banco;
  /** Banco da tela depois da operacao (mesmas regras do banco real). */
  depois: Banco;
  /** Nome da operacao ("Cancelar aula"), gravado no historico. */
  operacao: string;
}

/** O que uma gravacao devolve: o id do registro principal criado, se houver. */
export interface RetornoGravacao {
  id?: string;
}

export interface Gravacao<Dados> {
  /** Tabelas lidas de novo depois de gravar (o historico sempre e). */
  recarregar: TabelaDoBanco[];
  gravar: (dados: Dados, ctx: ContextoGravacao) => Promise<RetornoGravacao | void>;
}

const LIGACOES = new Map<Operacao<any>, Gravacao<any>>();

/** Liga uma operacao da tela a uma forma de gravar no banco real. */
export function ligar<Dados>(operacao: Operacao<Dados>, gravacao: Gravacao<Dados>): void {
  if (LIGACOES.has(operacao)) {
    throw new Error(`A operação "${operacao.nome}" foi ligada ao banco duas vezes.`);
  }
  LIGACOES.set(operacao, gravacao);
}

export function gravacaoDe<Dados>(operacao: Operacao<Dados>): Gravacao<Dados> | undefined {
  return LIGACOES.get(operacao);
}

/** Todas as operacoes ligadas (usado no teste que confere se nenhuma ficou de fora). */
export function operacoesLigadas(): Operacao<unknown>[] {
  return [...LIGACOES.keys()];
}

/**
 * Nome da operacao no historico, para as gravacoes diretas nas tabelas (as
 * funcoes do banco gravam o nome sozinhas). Vai num cabecalho da requisicao,
 * em JSON (so letras ASCII), e o gatilho de auditoria le de la.
 */
function cabecalhoDaOperacao(operacao: string): string {
  return JSON.stringify(operacao).replace(/[\u007f-￿]/g, (c) =>
    `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

// ---------------------------------------------------------------------------
// Funcoes do banco
// ---------------------------------------------------------------------------

/** Chama uma funcao do banco. Recusa vira `ErroDoBanco` com a mensagem da tela. */
export async function chamarFuncao(
  ctx: ContextoGravacao,
  nome: string,
  argumentos: Record<string, unknown>,
): Promise<unknown> {
  // Campos vazios vao como "nao informado" (usa o padrao do parametro).
  const limpos = Object.fromEntries(
    Object.entries(argumentos).filter(([, valor]) => valor !== undefined),
  );
  const { data, error } = await ctx.cliente.rpc(nome, limpos);
  if (error) throw new ErroDoBanco(mensagemDoErro(error));
  return data;
}

/**
 * Gravacao por funcao do banco.
 *
 *   ligar(cancelarOcupacao, porFuncao("cancelar_ocupacao",
 *     (d) => ({ p_id: d.id, p_motivo: d.motivo }),
 *     ["ocupacoes", "ocupacaoAlunos", "reposicoes", "lancamentos"]));
 */
export function porFuncao<Dados>(
  nome: string,
  argumentos: (dados: Dados, ctx: ContextoGravacao) => Record<string, unknown>,
  recarregar: TabelaDoBanco[],
  idDoRetorno?: (retorno: unknown) => string | undefined,
): Gravacao<Dados> {
  return {
    recarregar,
    async gravar(dados, ctx) {
      const retorno = await chamarFuncao(ctx, nome, argumentos(dados, ctx));
      const id = idDoRetorno
        ? idDoRetorno(retorno)
        : typeof retorno === "string"
          ? retorno
          : undefined;
      return { id };
    },
  };
}

// ---------------------------------------------------------------------------
// Gravacao direta nas tabelas
// ---------------------------------------------------------------------------

type ComId = { id: string };

/** O que a operacao mudou numa tabela da tela (comparando antes e depois). */
export function diferencas<T extends ComId>(antes: T[], depois: T[]) {
  const anteriores = new Map(antes.map((r) => [r.id, r]));
  const atuais = new Set(depois.map((r) => r.id));
  return {
    criados: depois.filter((r) => !anteriores.has(r.id)),
    alterados: depois.flatMap((r) => {
      const anterior = anteriores.get(r.id);
      return anterior && anterior !== r ? [{ antes: anterior, depois: r }] : [];
    }),
    apagados: antes.filter((r) => !atuais.has(r.id)),
  };
}

/**
 * So as colunas que mudaram (para nao regravar valores iguais: o historico
 * registraria uma mudanca que nao houve, e datas lidas do banco perdem as
 * fracoes de segundo na conversao).
 */
export function colunasAlteradas(
  tabela: TabelaDeRegistros,
  antes: object,
  depois: object,
): Record<string, unknown> {
  const linhaAntes = paraBanco(tabela, antes, "atualizar");
  const linhaDepois = paraBanco(tabela, depois, "atualizar");
  return Object.fromEntries(
    Object.entries(linhaDepois).filter(
      ([coluna, valor]) => coluna !== "id" && JSON.stringify(valor) !== JSON.stringify(linhaAntes[coluna]),
    ),
  );
}

/**
 * Grava direto nas tabelas, na ordem dada, o que a operacao mudou no banco da
 * tela. Use so para cadastros simples: cada linha e uma requisicao.
 */
export function espelhar<Dados>(tabelas: TabelaDeRegistros[]): Gravacao<Dados> {
  return {
    recarregar: tabelas,
    async gravar(_dados, ctx) {
      const cabecalho = cabecalhoDaOperacao(ctx.operacao);
      let primeiroCriado: string | undefined;

      for (const tabela of tabelas) {
        const nome = paraSnake(tabela);
        const { criados, alterados, apagados } = diferencas(
          ctx.antes[tabela] as unknown as ComId[],
          ctx.depois[tabela] as unknown as ComId[],
        );

        for (const registro of criados) {
          const { error } = await ctx.cliente
            .from(nome)
            .insert(paraBanco(tabela, registro, "inserir"))
            .setHeader("x-operacao", cabecalho);
          if (error) throw new ErroDoBanco(mensagemDoErro(error));
          primeiroCriado ??= registro.id;
        }

        for (const { antes, depois } of alterados) {
          const campos = colunasAlteradas(tabela, antes, depois);
          if (Object.keys(campos).length === 0) continue;
          const { data, error } = await ctx.cliente
            .from(nome)
            .update(campos)
            .eq("id", depois.id)
            .select("id")
            .setHeader("x-operacao", cabecalho);
          if (error) throw new ErroDoBanco(mensagemDoErro(error));
          // A RLS nao da erro ao barrar uma alteracao: so nao muda nada.
          if (!data?.length) throw new ErroDoBanco(mensagemDoErro({ code: "42501" }));
        }

        for (const registro of apagados) {
          const { data, error } = await ctx.cliente
            .from(nome)
            .delete()
            .eq("id", registro.id)
            .select("id")
            .setHeader("x-operacao", cabecalho);
          if (error) throw new ErroDoBanco(mensagemDoErro(error));
          if (!data?.length) throw new ErroDoBanco(mensagemDoErro({ code: "42501" }));
        }
      }
      return { id: primeiroCriado };
    },
  };
}

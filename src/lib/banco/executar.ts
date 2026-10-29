/**
 * Como as gravacoes funcionam.
 *
 * Toda gravacao e uma OPERACAO: uma funcao pura que recebe o banco atual e
 * devolve o banco novo, sem alterar nada no lugar. Se uma regra for violada,
 * ela lanca `ErroDeRegra` e nada e gravado — tudo ou nada, como uma transacao
 * do banco real. Depois de cada operacao bem-sucedida, a auditoria e gravada
 * automaticamente.
 *
 * Exemplo de operacao (veja `operacoes/base.ts`):
 *
 *   export const adicionarComentario = definirOperacao(
 *     "Adicionar comentário",
 *     (banco, dados: { entidade; entidadeId; texto }, ctx) => ({
 *       ...banco,
 *       comentarios: [...banco.comentarios, { ... }],
 *     }),
 *   );
 *
 * Na tela:
 *
 *   const { executar } = useApp();
 *   const resultado = executar(adicionarComentario, { entidade: "aluno", ... });
 *   if (!resultado.ok) mostrarErro(resultado.erro);
 */

import { registrosDeAuditoria } from "./auditoria";
import { ErroDeRegra } from "./regras/comum";
import type { Banco, Colaborador } from "./tipos";

/** O que toda operacao recebe alem dos dados: quem esta fazendo e quando. */
export interface ContextoOperacao {
  usuario: Colaborador;
  /** "YYYY-MM-DDTHH:mm:ss" no fuso da arena. */
  agora: string;
  /** "YYYY-MM-DD" no fuso da arena. */
  hoje: string;
}

export interface Operacao<Dados> {
  /** Nome legivel, gravado na auditoria ("Cancelar aula"). */
  nome: string;
  aplicar: (banco: Banco, dados: Dados, ctx: ContextoOperacao) => Banco;
}

export function definirOperacao<Dados>(
  nome: string,
  aplicar: (banco: Banco, dados: Dados, ctx: ContextoOperacao) => Banco,
): Operacao<Dados> {
  return { nome, aplicar };
}

export type ResultadoOperacao =
  | { ok: true; banco: Banco }
  | { ok: false; erro: string };

/**
 * Executa a operacao e grava a auditoria. Erros de regra viram
 * `{ ok: false, erro }` com a mensagem pronta para a tela; qualquer outro
 * erro e um defeito de programacao e e relancado.
 */
export function executarOperacao<Dados>(
  banco: Banco,
  operacao: Operacao<Dados>,
  dados: Dados,
  ctx: ContextoOperacao,
): ResultadoOperacao {
  let novo: Banco;
  try {
    novo = operacao.aplicar(banco, dados, ctx);
  } catch (erro) {
    if (erro instanceof ErroDeRegra) return { ok: false, erro: erro.message };
    throw erro;
  }

  const auditoria = registrosDeAuditoria(banco, novo, ctx.usuario, operacao.nome, ctx.agora);
  if (auditoria.length === 0) return { ok: true, banco: novo };
  return { ok: true, banco: { ...novo, auditoria: [...novo.auditoria, ...auditoria] } };
}

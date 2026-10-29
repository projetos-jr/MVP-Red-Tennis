/**
 * Regras do financeiro.
 *
 * A situacao de um lancamento nunca e digitada: sai das datas.
 *  - pago: tem data de pagamento;
 *  - em atraso: passou do vencimento sem pagamento;
 *  - pendente: ainda dentro do prazo;
 *  - cancelado: anulado (lancamentos nunca se apagam).
 */

import { diferencaEmDias } from "../../date";
import type { Banco, Configuracoes, Lancamento, Ocupacao } from "../tipos";
import { duracaoEmMinutos } from "./agenda";

export type SituacaoLancamento = "pago" | "pendente" | "em_atraso" | "cancelado";

export function situacaoLancamento(
  lancamento: Lancamento,
  hoje: string,
): SituacaoLancamento {
  if (lancamento.canceladoEm) return "cancelado";
  if (lancamento.pagoEm) return "pago";
  return lancamento.vencimento < hoje ? "em_atraso" : "pendente";
}

/** Dias desde o vencimento, para lancamentos em aberto (0 se em dia ou pago). */
export function diasEmAtraso(lancamento: Lancamento, hoje: string): number {
  if (situacaoLancamento(lancamento, hoje) !== "em_atraso") return 0;
  return diferencaEmDias(lancamento.vencimento, hoje);
}

/** Lancamento valido (nao cancelado). */
export function lancamentoValido(lancamento: Lancamento): boolean {
  return !lancamento.canceladoEm;
}

/** Preco de uma locacao avulsa pela duracao e pela quadra (valores das Configuracoes). */
export function precoDaLocacao(
  configuracoes: Configuracoes,
  ocupacao: Pick<Ocupacao, "quadraId" | "horaInicio" | "horaFim">,
): number {
  const porHora =
    ocupacao.quadraId === "paredao" ? configuracoes.precoParedaoHora : configuracoes.precoLocacaoHora;
  return Math.round(porHora * (duracaoEmMinutos(ocupacao) / 60) * 100) / 100;
}

export interface RepassePrevisto {
  aulasDadas: number;
  minutosDados: number;
  valorPrevisto: number;
}

/**
 * Repasse previsto de um professor num mes ("YYYY-MM"), pela regra dele
 * (Hipotese H6). Conta as aulas realizadas com o professor; no modo
 * "percentual", aplica o percentual sobre as mensalidades pagas dos alunos
 * dessas aulas no mes (a confirmar com a arena).
 */
export function repassePrevisto(
  banco: Banco,
  professorId: string,
  competencia: string,
): RepassePrevisto {
  const professor = banco.professores.find((p) => p.id === professorId);
  const aulas = banco.ocupacoes.filter(
    (o) =>
      o.professorId === professorId &&
      o.situacao === "realizada" &&
      o.data.startsWith(competencia),
  );
  const minutosDados = aulas.reduce((soma, o) => soma + duracaoEmMinutos(o), 0);
  if (!professor) return { aulasDadas: aulas.length, minutosDados, valorPrevisto: 0 };

  if (professor.repasse.modo === "por_hora") {
    return {
      aulasDadas: aulas.length,
      minutosDados,
      valorPrevisto: Math.round((minutosDados / 60) * professor.repasse.valor * 100) / 100,
    };
  }

  const idsDasAulas = new Set(aulas.map((o) => o.id));
  const alunos = new Set(
    banco.ocupacaoAlunos.filter((p) => idsDasAulas.has(p.ocupacaoId)).map((p) => p.alunoId),
  );
  const receita = banco.lancamentos
    .filter(
      (l) =>
        l.categoria === "Mensalidade" &&
        l.competencia === competencia &&
        l.pagoEm &&
        l.pessoaId &&
        alunos.has(l.pessoaId),
    )
    .reduce((soma, l) => soma + l.valor, 0);
  return {
    aulasDadas: aulas.length,
    minutosDados,
    valorPrevisto: Math.round(receita * professor.repasse.valor) / 100,
  };
}

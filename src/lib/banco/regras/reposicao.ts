/**
 * Regras do extrato de minutos de reposicao.
 *
 * - Credito: nasce de uma aula cancelada (ou de uma falta avisada) com sigla
 *   que da direito. Vale `validadeReposicaoMeses` meses a partir da data da aula.
 * - Uso: debito de minutos ao marcar a reposicao.
 * - Saldo: soma do que resta dos creditos ainda validos. Nunca negativo.
 * - Cada uso consome primeiro o credito que vence antes.
 *
 * No banco real: tabela `reposicoes`, view `saldo_reposicao` e funcao
 * `usar_reposicao`.
 */

import { somarMeses } from "../../date";
import type {
  Banco,
  Configuracoes,
  LancamentoReposicao,
  Ocupacao,
  SiglaReposicao,
  TipoOcupacao,
} from "../tipos";
import { duracaoEmMinutos } from "./agenda";
import { ErroDeRegra, novoId } from "./comum";

/**
 * Tipos de ocupacao cujos participantes ganham credito ao perder a aula:
 * os planos mensais. Locacao avulsa e ranking sao pagos por uso.
 */
export const TIPOS_COM_DIREITO_A_REPOSICAO: TipoOcupacao[] = [
  "Individual",
  "Dupla",
  "LAP",
  "Locação Mensal",
  "Plano de locação",
];

export interface CreditoNoExtrato {
  credito: LancamentoReposicao;
  /** Minutos que ainda nao foram usados. */
  restante: number;
  vencido: boolean;
}

export interface ExtratoReposicao {
  /** Todos os lancamentos do aluno, do mais recente para o mais antigo. */
  lancamentos: LancamentoReposicao[];
  creditos: CreditoNoExtrato[];
  /** Minutos disponiveis hoje. */
  saldo: number;
  /** Credito valido que vence primeiro. */
  proximoVencimento?: { data: string; minutos: number };
}

function ordenarCreditos(a: LancamentoReposicao, b: LancamentoReposicao): number {
  return (a.validade ?? "").localeCompare(b.validade ?? "") || a.criadoEm.localeCompare(b.criadoEm);
}

/** Extrato completo de um aluno na data `hoje`. */
export function extratoReposicao(
  reposicoes: LancamentoReposicao[],
  alunoId: string,
  hoje: string,
): ExtratoReposicao {
  const doAluno = reposicoes.filter((r) => r.alunoId === alunoId);
  const creditos = doAluno.filter((r) => r.minutos > 0).sort(ordenarCreditos);
  const usos = doAluno
    .filter((r) => r.minutos < 0)
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));

  const restante = new Map(creditos.map((c) => [c.id, c.minutos]));

  // Cada uso consome os creditos que existiam e valiam naquele dia,
  // comecando pelo que vence antes.
  usos.forEach((uso) => {
    const dia = uso.criadoEm.slice(0, 10);
    let falta = -uso.minutos;
    for (const credito of creditos) {
      if (falta <= 0) break;
      if (credito.criadoEm > uso.criadoEm) continue;
      if ((credito.validade ?? "") < dia) continue;
      const disponivel = restante.get(credito.id) ?? 0;
      if (disponivel <= 0) continue;
      const usado = Math.min(disponivel, falta);
      restante.set(credito.id, disponivel - usado);
      falta -= usado;
    }
  });

  const noExtrato: CreditoNoExtrato[] = creditos.map((credito) => ({
    credito,
    restante: restante.get(credito.id) ?? 0,
    vencido: (credito.validade ?? "") < hoje,
  }));

  const validos = noExtrato.filter((c) => !c.vencido && c.restante > 0);
  const primeiro = validos[0];

  return {
    lancamentos: [...doAluno].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
    creditos: noExtrato,
    saldo: validos.reduce((soma, c) => soma + c.restante, 0),
    proximoVencimento: primeiro
      ? { data: primeiro.credito.validade ?? hoje, minutos: primeiro.restante }
      : undefined,
  };
}

export function saldoDeReposicao(
  reposicoes: LancamentoReposicao[],
  alunoId: string,
  hoje: string,
): number {
  return extratoReposicao(reposicoes, alunoId, hoje).saldo;
}

export function buscarSigla(
  configuracoes: Configuracoes,
  codigo: string,
): SiglaReposicao | undefined {
  return configuracoes.siglas.find((s) => s.codigo === codigo);
}

/**
 * Creditos que uma aula perdida gera para os alunos informados.
 * Devolve lista vazia quando a sigla nao da direito ou o tipo de aula nao
 * entra na reposicao.
 */
export function creditosPorAulaPerdida(
  configuracoes: Configuracoes,
  ocupacao: Ocupacao,
  sigla: string,
  alunosIds: string[],
  criadoEm: string,
): LancamentoReposicao[] {
  const regra = buscarSigla(configuracoes, sigla);
  if (!regra?.geraCredito) return [];
  if (!TIPOS_COM_DIREITO_A_REPOSICAO.includes(ocupacao.tipo)) return [];

  const minutos = duracaoEmMinutos(ocupacao);
  const validade = somarMeses(ocupacao.data, configuracoes.validadeReposicaoMeses);

  return alunosIds.map((alunoId) => ({
    id: novoId("rp"),
    alunoId,
    minutos,
    sigla,
    ocupacaoOrigemId: ocupacao.id,
    validade,
    criadoEm,
  }));
}

/** Recusa o uso de minutos acima do saldo disponivel. */
export function garantirSaldoSuficiente(
  banco: Banco,
  alunoId: string,
  minutos: number,
  hoje: string,
): void {
  const saldo = saldoDeReposicao(banco.reposicoes, alunoId, hoje);
  if (minutos > saldo) {
    throw new ErroDeRegra(
      `Saldo de reposição insuficiente: o aluno tem ${saldo} minutos e a aula precisa de ${minutos}.`,
    );
  }
}

/**
 * Minutos ja usados que nenhum credito cobre. Deve ser sempre 0: e o que
 * garante que o saldo nunca fica negativo quando um credito e retirado
 * (ex.: falta avisada desfeita depois de o credito ter sido usado).
 */
export function minutosSemCobertura(reposicoes: LancamentoReposicao[], alunoId: string): number {
  // A data de "hoje" so marca vencidos; o consumo dos creditos nao depende dela.
  const extrato = extratoReposicao(reposicoes, alunoId, "0000-01-01");
  const usado = extrato.lancamentos
    .filter((r) => r.minutos < 0)
    .reduce((soma, r) => soma - r.minutos, 0);
  const consumido = extrato.creditos.reduce(
    (soma, c) => soma + (c.credito.minutos - c.restante),
    0,
  );
  return usado - consumido;
}

/** Recusa a operacao se algum uso dos alunos ficar sem credito que o cubra. */
export function garantirExtratoCoerente(
  reposicoes: LancamentoReposicao[],
  alunosIds: string[],
  mensagem: string,
): void {
  if (alunosIds.some((alunoId) => minutosSemCobertura(reposicoes, alunoId) > 0)) {
    throw new ErroDeRegra(mensagem);
  }
}

export interface EfeitoNoAluno {
  alunoId: string;
  /** Minutos de credito que o aluno ganha com o cancelamento (0 = nenhum). */
  minutos: number;
  /** O aluno ja tinha recebido credito desta aula (falta avisada) e nao ganha de novo. */
  jaTinhaCredito: boolean;
}

export interface EfeitoDoCancelamento {
  creditos: LancamentoReposicao[];
  porAluno: EfeitoNoAluno[];
  minutosTotais: number;
}

/**
 * O que cancelar uma aula com `motivo` gera para cada aluno: credito igual a
 * duracao da aula quando a sigla e o tipo de aula dao direito (Hipotese H1).
 * Quem ja recebeu credito desta mesma aula (falta avisada) nao ganha de novo.
 *
 * A tela usa esta funcao para mostrar os minutos ANTES de confirmar, e a
 * operacao usa a mesma funcao para gravar: o que se ve e o que se grava.
 */
export function efeitoDoCancelamento(
  banco: Banco,
  ocupacao: Ocupacao,
  motivo: string,
  criadoEm: string,
): EfeitoDoCancelamento {
  const participantes = banco.ocupacaoAlunos.filter((p) => p.ocupacaoId === ocupacao.id);
  const jaCreditados = new Set(
    banco.reposicoes
      .filter((r) => r.minutos > 0 && r.ocupacaoOrigemId === ocupacao.id)
      .map((r) => r.alunoId),
  );
  const creditos = creditosPorAulaPerdida(
    banco.configuracoes,
    ocupacao,
    motivo,
    participantes.map((p) => p.alunoId).filter((id) => !jaCreditados.has(id)),
    criadoEm,
  );
  const creditoDoAluno = new Map(creditos.map((c) => [c.alunoId, c.minutos]));
  return {
    creditos,
    porAluno: participantes.map((p) => ({
      alunoId: p.alunoId,
      minutos: creditoDoAluno.get(p.alunoId) ?? 0,
      jaTinhaCredito: jaCreditados.has(p.alunoId),
    })),
    minutosTotais: creditos.reduce((soma, c) => soma + c.minutos, 0),
  };
}

/**
 * Regras de matricula e congelamento.
 */

import type { Aluno, Banco, Congelamento, Matricula, Plano } from "../tipos";

/** Matricula valida na data (inicio <= data e sem fim, ou fim >= data). */
export function matriculaVigente(
  matriculas: Matricula[],
  alunoId: string,
  data: string,
): Matricula | undefined {
  return matriculas.find(
    (m) => m.alunoId === alunoId && m.inicio <= data && (!m.fim || m.fim >= data),
  );
}

/** Congelamento em curso na data (comecou e ainda nao terminou). */
export function congelamentoVigente(
  congelamentos: Congelamento[],
  matriculaId: string,
  data: string,
): Congelamento | undefined {
  return congelamentos.find(
    (c) =>
      c.matriculaId === matriculaId &&
      c.inicio <= data &&
      (!c.fimReal || c.fimReal >= data),
  );
}

/**
 * Situacao do aluno:
 *  - ativo: tem matricula vigente;
 *  - congelado: tem matricula vigente com congelamento em curso;
 *  - avulso: frequenta sem plano mensal (locacoes avulsas, ranking);
 *  - inativo: saiu da arena.
 */
export type SituacaoAluno = "ativo" | "congelado" | "avulso" | "inativo";

export function situacaoDoAluno(banco: Banco, aluno: Aluno, hoje: string): SituacaoAluno {
  if (!aluno.ativo) return "inativo";
  const matricula = matriculaVigente(banco.matriculas, aluno.id, hoje);
  if (!matricula) return "avulso";
  return congelamentoVigente(banco.congelamentos, matricula.id, hoje) ? "congelado" : "ativo";
}

/** Plano da matricula vigente, se houver. */
export function planoVigente(banco: Banco, alunoId: string, hoje: string): Plano | undefined {
  const matricula = matriculaVigente(banco.matriculas, alunoId, hoje);
  return matricula ? banco.planos.find((p) => p.id === matricula.planoId) : undefined;
}

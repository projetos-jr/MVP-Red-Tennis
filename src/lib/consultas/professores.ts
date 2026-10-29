/**
 * Consultas do modulo de professores: lista, agenda da semana (a partir das
 * ocupacoes de verdade, nao do molde), alunos e repasse do mes — previsto
 * pela regra do professor (Hipotese H6) x pago.
 */

import { datasDaSemana, somarMeses } from "../date";
import { duracaoEmMinutos } from "../banco/regras/agenda";
import { situacaoDoAluno, type SituacaoAluno } from "../banco/regras/alunos";
import { repassePrevisto, type RepassePrevisto } from "../banco/regras/financeiro";
import type { Aluno, Banco, Ocupacao, Plano, Presenca, Professor } from "../banco/tipos";
import { idsDosAlunosDoProfessor } from "./alunos";

export interface LinhaDaListaDeProfessores {
  professor: Professor;
  /** Alunos ativos que tem este professor como principal. */
  alunosPrincipais: number;
  /** Aulas da semana de hoje que nao foram canceladas. */
  aulasNaSemana: number;
  minutosNaSemana: number;
  /** Repasse previsto do mes corrente, pelas aulas ja dadas. */
  repasseDoMes: RepassePrevisto;
}

function aulasValidas(banco: Banco, professorId: string, datas: Set<string>): Ocupacao[] {
  return banco.ocupacoes.filter(
    (o) => o.professorId === professorId && datas.has(o.data) && o.situacao !== "cancelada",
  );
}

export function listarProfessores(banco: Banco, hoje: string): LinhaDaListaDeProfessores[] {
  const semana = new Set(datasDaSemana(hoje));
  return [...banco.professores]
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"))
    .map((professor) => {
      const aulas = aulasValidas(banco, professor.id, semana);
      return {
        professor,
        alunosPrincipais: banco.alunos.filter(
          (a) => a.ativo && a.professorPrincipalId === professor.id,
        ).length,
        aulasNaSemana: aulas.length,
        minutosNaSemana: aulas.reduce((soma, o) => soma + duracaoEmMinutos(o), 0),
        repasseDoMes: repassePrevisto(banco, professor.id, hoje.slice(0, 7)),
      };
    });
}

// ---------------------------------------------------------------------------
// Agenda da semana
// ---------------------------------------------------------------------------

export interface AulaDoProfessor {
  ocupacao: Ocupacao;
  alunos: Array<{ id: string; nome: string; presenca: Presenca }>;
}

export interface SemanaDoProfessor {
  /** Segunda a domingo da semana da data de referencia. */
  dias: Array<{ data: string; aulas: AulaDoProfessor[] }>;
  /** Aulas que nao foram canceladas. */
  aulas: number;
  canceladas: number;
  minutos: number;
  /** Alunos diferentes nas aulas que nao foram canceladas. */
  alunosAtendidos: number;
}

export function agendaDaSemana(banco: Banco, professorId: string, referencia: string): SemanaDoProfessor {
  const datas = datasDaSemana(referencia);
  const naSemana = new Set(datas);
  const doProfessor = banco.ocupacoes
    .filter((o) => o.professorId === professorId && naSemana.has(o.data))
    .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio));
  const ids = new Set(doProfessor.map((o) => o.id));
  const nomeDoAluno = new Map(banco.alunos.map((a) => [a.id, a.nome]));
  const participantes = new Map<string, AulaDoProfessor["alunos"]>();
  banco.ocupacaoAlunos.forEach((p) => {
    if (!ids.has(p.ocupacaoId)) return;
    const lista = participantes.get(p.ocupacaoId) ?? [];
    lista.push({ id: p.alunoId, nome: nomeDoAluno.get(p.alunoId) ?? "Aluno removido", presenca: p.presenca });
    participantes.set(p.ocupacaoId, lista);
  });

  const aulas = doProfessor.map((ocupacao) => ({
    ocupacao,
    alunos: participantes.get(ocupacao.id) ?? [],
  }));
  const validas = aulas.filter((a) => a.ocupacao.situacao !== "cancelada");

  return {
    dias: datas.map((data) => ({ data, aulas: aulas.filter((a) => a.ocupacao.data === data) })),
    aulas: validas.length,
    canceladas: aulas.length - validas.length,
    minutos: validas.reduce((soma, a) => soma + duracaoEmMinutos(a.ocupacao), 0),
    alunosAtendidos: new Set(validas.flatMap((a) => a.alunos.map((aluno) => aluno.id))).size,
  };
}

// ---------------------------------------------------------------------------
// Alunos do professor
// ---------------------------------------------------------------------------

export interface AlunoDoProfessor {
  aluno: Aluno;
  plano?: Plano;
  situacao: SituacaoAluno;
  /** true = tem o professor como principal; false = so esta numa turma fixa dele. */
  principal: boolean;
}

/** Alunos ativos: os que tem o professor como principal e os das turmas fixas dele. */
export function alunosDoProfessor(banco: Banco, professorId: string, hoje: string): AlunoDoProfessor[] {
  const ids = idsDosAlunosDoProfessor(banco, professorId, hoje);
  return banco.alunos
    .filter((a) => ids.has(a.id) && a.ativo)
    .map((aluno) => {
      const matricula = banco.matriculas.find(
        (m) => m.alunoId === aluno.id && m.inicio <= hoje && (!m.fim || m.fim >= hoje),
      );
      return {
        aluno,
        plano: banco.planos.find((p) => p.id === matricula?.planoId),
        situacao: situacaoDoAluno(banco, aluno, hoje),
        principal: aluno.professorPrincipalId === professorId,
      };
    })
    .sort(
      (a, b) =>
        Number(b.principal) - Number(a.principal) ||
        a.aluno.nome.localeCompare(b.aluno.nome, "pt-BR"),
    );
}

// ---------------------------------------------------------------------------
// Repasse: previsto pela regra x pago
// ---------------------------------------------------------------------------

export interface RepasseDoMes {
  /** Mes "YYYY-MM". */
  competencia: string;
  aulasDadas: number;
  minutosDados: number;
  /** Do fechamento (tabela `repasses`), ou calculado pela regra se o mes nao foi fechado. */
  previsto: number;
  /** Lancamentos de repasse do mes ja pagos. */
  pago: number;
  /** Lancamentos de repasse do mes ainda nao pagos. */
  aPagar: number;
  /** Pago - previsto (negativo = falta pagar). */
  diferenca: number;
  /** "em_andamento" = mes corrente; "fechado" = tem fechamento; "aberto" = passou sem fechamento. */
  situacao: "em_andamento" | "fechado" | "aberto";
}

/** Repasse dos ultimos `meses` meses (o corrente primeiro). */
export function repassesDoProfessor(
  banco: Banco,
  professorId: string,
  hoje: string,
  meses = 6,
): RepasseDoMes[] {
  const mesAtual = hoje.slice(0, 7);
  const lancamentos = banco.lancamentos.filter(
    (l) =>
      l.categoria === "Repasse" &&
      l.pessoaId === professorId &&
      !l.canceladoEm &&
      l.competencia,
  );

  return Array.from({ length: meses }, (_, k) => somarMeses(`${mesAtual}-01`, -k).slice(0, 7)).map(
    (competencia) => {
      const fechamento = banco.repasses.find(
        (r) => r.professorId === professorId && r.competencia === competencia,
      );
      const calculado = fechamento
        ? {
            aulasDadas: fechamento.aulasDadas,
            minutosDados: fechamento.minutosDados,
            valorPrevisto: fechamento.valorPrevisto,
          }
        : repassePrevisto(banco, professorId, competencia);
      const doMes = lancamentos.filter((l) => l.competencia === competencia);
      const pago = doMes.filter((l) => l.pagoEm).reduce((soma, l) => soma + l.valor, 0);
      const aPagar = doMes.filter((l) => !l.pagoEm).reduce((soma, l) => soma + l.valor, 0);
      return {
        competencia,
        aulasDadas: calculado.aulasDadas,
        minutosDados: calculado.minutosDados,
        previsto: calculado.valorPrevisto,
        pago,
        aPagar,
        diferenca: Math.round((pago - calculado.valorPrevisto) * 100) / 100,
        situacao:
          competencia === mesAtual ? "em_andamento" : fechamento ? "fechado" : "aberto",
      };
    },
  );
}

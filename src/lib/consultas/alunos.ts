/**
 * Consultas do modulo de alunos: lista com filtros, ficha (cabecalho,
 * indicadores, matricula, extrato de reposicao, congelamentos, historico de
 * aulas, pagamentos e horarios fixos) e as previas que a tela mostra antes de
 * gravar (congelar, reativar, inativar).
 *
 * Todas recebem `hoje` (HOJE de `banco/constantes`) para nao depender do
 * relogio na hora de desenhar a tela.
 */

import { ORDEM_SEMANA, formatarData, somarDias } from "../date";
import {
  MOTIVO_CONGELAMENTO,
  aulasAindaSuspensas,
  aulasDepoisDaSaida,
  aulasParaSuspender,
  chaveDeNome,
  congelamentoAnulado,
  dataValida,
  fimRealParaVolta,
  matriculaQueVoltaAValer,
  matriculaVigente,
  normalizarEmail,
  previaDaVolta,
  reservasAvulsasDoAluno,
  situacaoDoAluno,
  type AulaASuspender,
  type PreviaDaVolta,
  type SituacaoAluno,
} from "../banco/regras/alunos";
import { diasEmAtraso, situacaoLancamento, type SituacaoLancamento } from "../banco/regras/financeiro";
import { calcularRanking, type LinhaRanking } from "../banco/regras/ranking";
import { extratoReposicao } from "../banco/regras/reposicao";
import type {
  Aluno,
  Banco,
  Congelamento,
  HorarioFixo,
  Lancamento,
  LancamentoReposicao,
  Matricula,
  Ocupacao,
  Plano,
  Presenca,
  Professor,
  TipoPlano,
} from "../banco/tipos";

export {
  CATEGORIAS_RANKING,
  MOTIVO_CONGELAMENTO,
  MOTIVO_INATIVACAO,
  normalizarEmail,
  normalizarTelefone,
  podeAlterarCadastros,
  podeAlterarRepasse,
  type SituacaoAluno,
} from "../banco/regras/alunos";
export type { SituacaoLancamento } from "../banco/regras/financeiro";

function agrupar<T>(lista: T[], chave: (item: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  lista.forEach((item) => {
    const k = chave(item);
    const grupo = grupos.get(k);
    if (grupo) grupo.push(item);
    else grupos.set(k, [item]);
  });
  return grupos;
}

function porDataEHora(a: Ocupacao, b: Ocupacao): number {
  return a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio);
}

// ---------------------------------------------------------------------------
// Lista de alunos
// ---------------------------------------------------------------------------

export interface LinhaDaListaDeAlunos {
  aluno: Aluno;
  situacao: SituacaoAluno;
  matricula?: Matricula;
  plano?: Plano;
  professor?: Professor;
  /** Minutos de reposicao disponiveis hoje. */
  saldoReposicao: number;
  /** Soma das cobrancas do aluno que passaram do vencimento sem pagamento. */
  valorEmAtraso: number;
  /** Nome sem acento, digitos do telefone e e-mail: o que a busca compara. */
  chaveDeBusca: string;
}

/** Todas as linhas da lista (calcula uma vez; os filtros rodam por cima). */
export function linhasDaListaDeAlunos(banco: Banco, hoje: string): LinhaDaListaDeAlunos[] {
  const planoPorId = new Map(banco.planos.map((p) => [p.id, p]));
  const professorPorId = new Map(banco.professores.map((p) => [p.id, p]));
  const reposicoesPorAluno = agrupar(banco.reposicoes, (r) => r.alunoId);
  const atrasoPorAluno = new Map<string, number>();
  banco.lancamentos.forEach((l) => {
    if (l.tipo !== "receber" || l.pessoaTipo !== "aluno" || !l.pessoaId) return;
    if (situacaoLancamento(l, hoje) !== "em_atraso") return;
    atrasoPorAluno.set(l.pessoaId, (atrasoPorAluno.get(l.pessoaId) ?? 0) + l.valor);
  });

  return banco.alunos
    .map((aluno) => {
      const matricula = matriculaVigente(banco.matriculas, aluno.id, hoje);
      return {
        aluno,
        situacao: situacaoDoAluno(banco, aluno, hoje),
        matricula,
        plano: matricula ? planoPorId.get(matricula.planoId) : undefined,
        professor: aluno.professorPrincipalId
          ? professorPorId.get(aluno.professorPrincipalId)
          : undefined,
        saldoReposicao: extratoReposicao(reposicoesPorAluno.get(aluno.id) ?? [], aluno.id, hoje)
          .saldo,
        valorEmAtraso: atrasoPorAluno.get(aluno.id) ?? 0,
        chaveDeBusca: `${chaveDeNome(aluno.nome)} ${aluno.telefone.replace(/\D/g, "")} ${aluno.email.toLowerCase()}`,
      };
    })
    .sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome, "pt-BR"));
}

export type FiltroDeSituacao = SituacaoAluno | "todas";

export interface FiltroDeAlunos {
  busca: string;
  /** "todos", "sem" (sem plano mensal), "tipo:Individual" ou "plano:<id>". */
  plano: string;
  /** "todos", "sem" (sem professor principal) ou o id do professor. */
  professor: string;
  situacao: FiltroDeSituacao;
  /** Perfil de professor (Hipotese H9): so os alunos dele. */
  soDoProfessorId?: string;
}

export interface ResultadoDaListaDeAlunos {
  linhas: LinhaDaListaDeAlunos[];
  /** Alunos em cada situacao, com a busca e os demais filtros aplicados. */
  contagem: Record<SituacaoAluno, number>;
  /** Total com a busca e os demais filtros (sem o filtro de situacao). */
  total: number;
}

/**
 * Alunos de um professor: os que o tem como principal e os que estao nos
 * horarios fixos dele que ainda valem.
 */
export function idsDosAlunosDoProfessor(banco: Banco, professorId: string, hoje: string): Set<string> {
  const ids = new Set(
    banco.alunos.filter((a) => a.professorPrincipalId === professorId).map((a) => a.id),
  );
  const fixos = new Set(
    banco.horariosFixos
      .filter((h) => h.professorId === professorId && (!h.fim || h.fim >= hoje))
      .map((h) => h.id),
  );
  banco.horarioAlunos.forEach((ha) => {
    if (fixos.has(ha.horarioFixoId)) ids.add(ha.alunoId);
  });
  return ids;
}

export function filtrarAlunos(
  banco: Banco,
  linhas: LinhaDaListaDeAlunos[],
  filtro: FiltroDeAlunos,
  hoje: string,
): ResultadoDaListaDeAlunos {
  const termo = chaveDeNome(filtro.busca);
  const digitos = filtro.busca.replace(/\D/g, "");
  const doProfessor = filtro.soDoProfessorId
    ? idsDosAlunosDoProfessor(banco, filtro.soDoProfessorId, hoje)
    : undefined;

  const passam = linhas.filter((linha) => {
    if (doProfessor && !doProfessor.has(linha.aluno.id)) return false;
    if (
      termo &&
      !linha.chaveDeBusca.includes(termo) &&
      !(digitos.length >= 4 && linha.chaveDeBusca.includes(digitos))
    ) {
      return false;
    }

    if (filtro.plano === "sem" && linha.plano) return false;
    if (filtro.plano.startsWith("tipo:") && linha.plano?.tipo !== filtro.plano.slice(5)) return false;
    if (filtro.plano.startsWith("plano:") && linha.plano?.id !== filtro.plano.slice(6)) return false;

    if (filtro.professor === "sem" && linha.aluno.professorPrincipalId) return false;
    if (
      filtro.professor !== "todos" &&
      filtro.professor !== "sem" &&
      linha.aluno.professorPrincipalId !== filtro.professor
    ) {
      return false;
    }
    return true;
  });

  const contagem: Record<SituacaoAluno, number> = { ativo: 0, congelado: 0, avulso: 0, inativo: 0 };
  passam.forEach((linha) => {
    contagem[linha.situacao] += 1;
  });

  return {
    linhas:
      filtro.situacao === "todas" ? passam : passam.filter((l) => l.situacao === filtro.situacao),
    contagem,
    total: passam.length,
  };
}

/** Opcoes do filtro de plano: os tipos e cada plano do catalogo. */
export function opcoesDePlano(banco: Banco): { tipos: TipoPlano[]; planos: Plano[] } {
  const tipos: TipoPlano[] = [];
  banco.planos.forEach((p) => {
    if (!tipos.includes(p.tipo)) tipos.push(p.tipo);
  });
  return { tipos, planos: banco.planos };
}

/** Planos que podem ser escolhidos numa matricula, separados pela tabela (Hipotese H3). */
export function planosParaMatricula(banco: Banco): { nova: Plano[]; antiga: Plano[] } {
  const ativos = banco.planos.filter((p) => p.ativo);
  return {
    nova: ativos.filter((p) => p.tabela === "nova"),
    antiga: ativos.filter((p) => p.tabela === "antiga"),
  };
}

export function professoresAtivos(banco: Banco): Professor[] {
  return banco.professores
    .filter((p) => p.ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface PossivelDuplicado {
  aluno: Aluno;
  mesmoNome: boolean;
  mesmoEmail: boolean;
}

/** Alunos com o mesmo nome (sem contar acentos) ou o mesmo e-mail: so um aviso. */
export function possiveisDuplicados(
  banco: Banco,
  dados: { nome: string; email?: string },
  ignorarId?: string,
): PossivelDuplicado[] {
  const nome = chaveDeNome(dados.nome ?? "");
  const email = normalizarEmail(dados.email ?? "") ?? "";
  if (nome.length < 3 && !email) return [];
  return banco.alunos
    .filter((a) => a.id !== ignorarId)
    .map((aluno) => ({
      aluno,
      mesmoNome: nome.length >= 3 && chaveDeNome(aluno.nome) === nome,
      mesmoEmail: Boolean(email) && aluno.email.toLowerCase() === email,
    }))
    .filter((d) => d.mesmoNome || d.mesmoEmail);
}

// ---------------------------------------------------------------------------
// Ficha: cabecalho e indicadores
// ---------------------------------------------------------------------------

export interface ResumoDoAluno {
  aluno: Aluno;
  situacao: SituacaoAluno;
  /** Matricula que vale hoje. */
  matricula?: Matricula;
  plano?: Plano;
  professor?: Professor;
  /** Congelamento em curso hoje. */
  congelamento?: Congelamento;
  /** Congelamento marcado para comecar depois de hoje. */
  congelamentoAgendado?: Congelamento;
  /** Matricula que comeca depois de hoje (troca de plano marcada ou matricula nova). */
  matriculaAgendada?: Matricula;
  planoAgendado?: Plano;
}

export function resumoDoAluno(banco: Banco, alunoId: string, hoje: string): ResumoDoAluno | undefined {
  const aluno = banco.alunos.find((a) => a.id === alunoId);
  if (!aluno) return undefined;
  const doAluno = banco.matriculas.filter((m) => m.alunoId === alunoId);
  const idsDasMatriculas = new Set(doAluno.map((m) => m.id));
  const matricula = matriculaVigente(doAluno, alunoId, hoje);
  const matriculaAgendada = doAluno
    .filter((m) => m.inicio > hoje)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
  const congelamentos = banco.congelamentos.filter(
    (c) => idsDasMatriculas.has(c.matriculaId) && !congelamentoAnulado(c),
  );
  const plano = (m?: Matricula) => (m ? banco.planos.find((p) => p.id === m.planoId) : undefined);

  return {
    aluno,
    situacao: situacaoDoAluno(banco, aluno, hoje),
    matricula,
    plano: plano(matricula),
    professor: aluno.professorPrincipalId
      ? banco.professores.find((p) => p.id === aluno.professorPrincipalId)
      : undefined,
    congelamento: congelamentos.find(
      (c) => c.matriculaId === matricula?.id && c.inicio <= hoje && (!c.fimReal || c.fimReal >= hoje),
    ),
    congelamentoAgendado: congelamentos.find((c) => c.inicio > hoje && !c.fimReal),
    matriculaAgendada,
    planoAgendado: plano(matriculaAgendada),
  };
}

export interface IndicadoresDoAluno {
  presencas: number;
  /** Faltas sem aviso. */
  faltas: number;
  faltasAvisadas: number;
  /** Aulas canceladas ou suspensas (chuva, professor, congelamento...). */
  canceladas: number;
  /** Presencas sobre as aulas com presenca marcada (vazio se nenhuma foi marcada). */
  frequencia?: number;
  totalPago: number;
  emAberto: number;
  emAtraso: number;
  ranking?: LinhaRanking;
  inscritosNoRanking: number;
}

export function indicadoresDoAluno(
  banco: Banco,
  alunoId: string,
  aulas: AulaDoAluno[],
  pagamentos: PagamentosDoAluno,
): IndicadoresDoAluno {
  const conta = (situacoes: SituacaoNaAula[]) =>
    aulas.filter((a) => situacoes.includes(a.situacao)).length;
  const presencas = conta(["presente"]);
  const faltas = conta(["falta"]);
  const faltasAvisadas = conta(["falta_avisada"]);
  const marcadas = presencas + faltas + faltasAvisadas;
  const ranking = calcularRanking(banco);

  return {
    presencas,
    faltas,
    faltasAvisadas,
    canceladas: conta(["cancelada", "suspensa"]),
    frequencia: marcadas > 0 ? presencas / marcadas : undefined,
    totalPago: pagamentos.totalPago,
    emAberto: pagamentos.emAberto,
    emAtraso: pagamentos.emAtraso,
    ranking: ranking.find((linha) => linha.alunoId === alunoId),
    inscritosNoRanking: ranking.length,
  };
}

// ---------------------------------------------------------------------------
// Historico de aulas
// ---------------------------------------------------------------------------

export type SituacaoNaAula = Presenca | "cancelada" | "suspensa";

export interface AulaDoAluno {
  ocupacao: Ocupacao;
  /** Id da participacao (vazio quando o aluno saiu da turma por congelamento). */
  participacaoId?: string;
  situacao: SituacaoNaAula;
  /** Sigla da falta ou do cancelamento (ou o motivo, quando nao e sigla). */
  motivo?: string;
  professorNome?: string;
  /** Minutos de reposicao que esta aula gerou para o aluno. */
  minutosCreditados?: number;
  /** Minutos de reposicao usados nesta aula (aula de reposicao). */
  minutosDeReposicao?: number;
  /** Quem marcou a presenca ou a falta, ou cancelou a aula (do historico de alteracoes). */
  marcadoPor?: string;
}

/** Quem fez a ultima marcacao de cada participacao e quem cancelou cada aula. */
function indiceDeQuemMarcou(banco: Banco): Map<string, string> {
  const indice = new Map<string, string>();
  banco.auditoria.forEach((registro) => {
    if (registro.acao !== "alterar") return;
    if (registro.tabela === "ocupacaoAlunos") {
      indice.set(`participacao|${registro.registroId}`, registro.usuarioNome);
    } else if (registro.tabela === "ocupacoes") {
      const antes = registro.antes as Partial<Ocupacao> | undefined;
      const depois = registro.depois as Partial<Ocupacao> | undefined;
      if (depois?.situacao === "cancelada" && antes?.situacao !== "cancelada") {
        indice.set(`ocupacao|${registro.registroId}`, registro.usuarioNome);
      }
    }
  });
  return indice;
}

/** Todas as aulas do aluno (passadas e futuras), sem ordem definida. */
export function aulasDoAluno(banco: Banco, alunoId: string): AulaDoAluno[] {
  const ocupacaoPorId = new Map(banco.ocupacoes.map((o) => [o.id, o]));
  const nomeDoProfessor = new Map(banco.professores.map((p) => [p.id, p.nome]));
  const creditos = new Map<string, number>();
  const usos = new Map<string, number>();
  banco.reposicoes.forEach((r) => {
    if (r.alunoId !== alunoId) return;
    if (r.minutos > 0 && r.ocupacaoOrigemId) {
      creditos.set(r.ocupacaoOrigemId, (creditos.get(r.ocupacaoOrigemId) ?? 0) + r.minutos);
    } else if (r.minutos < 0 && r.ocupacaoUsoId) {
      usos.set(r.ocupacaoUsoId, (usos.get(r.ocupacaoUsoId) ?? 0) - r.minutos);
    }
  });
  const quemMarcou = indiceDeQuemMarcou(banco);
  const professor = (o: Ocupacao) => (o.professorId ? nomeDoProfessor.get(o.professorId) : undefined);

  const aulas: AulaDoAluno[] = [];
  const jaListadas = new Set<string>();
  banco.ocupacaoAlunos.forEach((participacao) => {
    if (participacao.alunoId !== alunoId) return;
    const ocupacao = ocupacaoPorId.get(participacao.ocupacaoId);
    if (!ocupacao || ocupacao.tipo === "Bloqueio") return;
    jaListadas.add(ocupacao.id);
    const cancelada = ocupacao.situacao === "cancelada";
    aulas.push({
      ocupacao,
      participacaoId: participacao.id,
      situacao: cancelada
        ? ocupacao.motivoCancelamento === MOTIVO_CONGELAMENTO
          ? "suspensa"
          : "cancelada"
        : participacao.presenca,
      motivo: cancelada ? ocupacao.motivoCancelamento : participacao.sigla,
      professorNome: professor(ocupacao),
      minutosCreditados: creditos.get(ocupacao.id),
      minutosDeReposicao: usos.get(ocupacao.id),
      marcadoPor: cancelada
        ? quemMarcou.get(`ocupacao|${ocupacao.id}`)
        : participacao.presenca !== "a_marcar"
          ? quemMarcou.get(`participacao|${participacao.id}`)
          : undefined,
    });
  });

  // Turmas de onde o aluno saiu por congelamento continuam no historico, como suspensas.
  const matriculas = new Set(banco.matriculas.filter((m) => m.alunoId === alunoId).map((m) => m.id));
  banco.congelamentos.forEach((congelamento) => {
    if (!matriculas.has(congelamento.matriculaId)) return;
    (congelamento.aulasSuspensas ?? []).forEach((suspensa) => {
      const ocupacao = ocupacaoPorId.get(suspensa.ocupacaoId);
      if (suspensa.acao !== "retirado" || !ocupacao || jaListadas.has(ocupacao.id)) return;
      jaListadas.add(ocupacao.id);
      aulas.push({
        ocupacao,
        situacao: "suspensa",
        motivo: MOTIVO_CONGELAMENTO,
        professorNome: professor(ocupacao),
      });
    });
  });

  return aulas;
}

/** Aulas ate hoje, da mais recente para a mais antiga. */
export function historicoDeAulas(aulas: AulaDoAluno[], hoje: string): AulaDoAluno[] {
  return aulas
    .filter((a) => a.ocupacao.data <= hoje)
    .sort((a, b) => porDataEHora(b.ocupacao, a.ocupacao));
}

/** Proximas aulas (depois de hoje), da mais proxima para a mais distante. */
export function proximasAulas(aulas: AulaDoAluno[], hoje: string, limite = 6): AulaDoAluno[] {
  return aulas
    .filter((a) => a.ocupacao.data > hoje)
    .sort((a, b) => porDataEHora(a.ocupacao, b.ocupacao))
    .slice(0, limite);
}

// ---------------------------------------------------------------------------
// Pagamentos
// ---------------------------------------------------------------------------

export interface PagamentoDoAluno {
  lancamento: Lancamento;
  situacao: SituacaoLancamento;
  diasEmAtraso: number;
}

export interface PagamentosDoAluno {
  lista: PagamentoDoAluno[];
  totalPago: number;
  emAberto: number;
  emAtraso: number;
}

/**
 * Lancamentos a receber do aluno (menos o consumo do balcao, que tem bloco
 * proprio), do vencimento mais recente para o mais antigo. Sempre pela pessoa
 * do lancamento, nunca pelo nome de quem pagou.
 */
export function pagamentosDoAluno(banco: Banco, alunoId: string, hoje: string): PagamentosDoAluno {
  const lista = banco.lancamentos
    .filter(
      (l) =>
        l.tipo === "receber" &&
        l.pessoaTipo === "aluno" &&
        l.pessoaId === alunoId &&
        l.categoria !== "Consumo",
    )
    .map((lancamento) => ({
      lancamento,
      situacao: situacaoLancamento(lancamento, hoje),
      diasEmAtraso: diasEmAtraso(lancamento, hoje),
    }))
    .sort(
      (a, b) =>
        b.lancamento.vencimento.localeCompare(a.lancamento.vencimento) ||
        b.lancamento.criadoEm.localeCompare(a.lancamento.criadoEm),
    );

  const soma = (situacoes: SituacaoLancamento[]) =>
    lista
      .filter((p) => situacoes.includes(p.situacao))
      .reduce((total, p) => total + p.lancamento.valor, 0);

  return {
    lista,
    totalPago: soma(["pago"]),
    emAberto: soma(["pendente", "em_atraso"]),
    emAtraso: soma(["em_atraso"]),
  };
}

// ---------------------------------------------------------------------------
// Extrato de reposicao (so leitura: quem grava e a agenda)
// ---------------------------------------------------------------------------

export interface MovimentoDeReposicao {
  lancamento: LancamentoReposicao;
  tipo: "credito" | "uso";
  /** Aula que gerou o credito. */
  origem?: Ocupacao;
  /** Aula onde os minutos foram usados. */
  uso?: Ocupacao;
  /** So creditos: minutos que ainda restam. */
  restante?: number;
  vencido?: boolean;
}

export interface ExtratoDoAluno {
  saldo: number;
  proximoVencimento?: { data: string; minutos: number };
  /** Minutos validos que vencem nos proximos 30 dias. */
  venceEm30Dias: number;
  /** Minutos que venceram sem uso. */
  vencidos: number;
  movimentos: MovimentoDeReposicao[];
}

export function extratoDoAluno(banco: Banco, alunoId: string, hoje: string): ExtratoDoAluno {
  const extrato = extratoReposicao(banco.reposicoes, alunoId, hoje);
  const ocupacaoPorId = new Map(banco.ocupacoes.map((o) => [o.id, o]));
  const credito = new Map(extrato.creditos.map((c) => [c.credito.id, c]));
  const daqui30Dias = somarDias(hoje, 30);

  return {
    saldo: extrato.saldo,
    proximoVencimento: extrato.proximoVencimento,
    venceEm30Dias: extrato.creditos
      .filter((c) => !c.vencido && c.restante > 0 && (c.credito.validade ?? "") <= daqui30Dias)
      .reduce((soma, c) => soma + c.restante, 0),
    vencidos: extrato.creditos
      .filter((c) => c.vencido)
      .reduce((soma, c) => soma + c.restante, 0),
    movimentos: extrato.lancamentos.map((lancamento) => {
      const noExtrato = credito.get(lancamento.id);
      return {
        lancamento,
        tipo: lancamento.minutos > 0 ? "credito" : "uso",
        origem: lancamento.ocupacaoOrigemId
          ? ocupacaoPorId.get(lancamento.ocupacaoOrigemId)
          : undefined,
        uso: lancamento.ocupacaoUsoId ? ocupacaoPorId.get(lancamento.ocupacaoUsoId) : undefined,
        restante: noExtrato?.restante,
        vencido: noExtrato?.vencido,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Matriculas, congelamentos e horarios fixos
// ---------------------------------------------------------------------------

export type SituacaoMatricula = "vigente" | "encerrada" | "agendada";

export interface MatriculaDoAluno {
  matricula: Matricula;
  plano?: Plano;
  situacao: SituacaoMatricula;
}

/** Historico de planos: todas as matriculas, da mais recente para a mais antiga. */
export function matriculasDoAluno(banco: Banco, alunoId: string, hoje: string): MatriculaDoAluno[] {
  return banco.matriculas
    .filter((m) => m.alunoId === alunoId)
    .sort((a, b) => b.inicio.localeCompare(a.inicio))
    .map((matricula) => ({
      matricula,
      plano: banco.planos.find((p) => p.id === matricula.planoId),
      situacao:
        matricula.inicio > hoje
          ? "agendada"
          : matricula.fim && matricula.fim < hoje
            ? "encerrada"
            : "vigente",
    }));
}

/** Matricula anterior que volta a valer se a matricula agendada for cancelada. */
export function matriculaQueVoltaAoCancelar(
  banco: Banco,
  matriculaId: string,
): MatriculaDoAluno | undefined {
  const agendada = banco.matriculas.find((m) => m.id === matriculaId);
  const anterior = agendada ? matriculaQueVoltaAValer(banco.matriculas, agendada) : undefined;
  if (!anterior) return undefined;
  return {
    matricula: anterior,
    plano: banco.planos.find((p) => p.id === anterior.planoId),
    situacao: "vigente",
  };
}

export type SituacaoCongelamento = "em_curso" | "agendado" | "encerrado" | "cancelado";

export interface CongelamentoDoAluno {
  congelamento: Congelamento;
  plano?: Plano;
  situacao: SituacaoCongelamento;
  /** Aulas que continuam suspensas (as que voltaram na reativacao saem da conta). */
  aulasSuspensas: number;
}

export function congelamentosDoAluno(
  banco: Banco,
  alunoId: string,
  hoje: string,
): CongelamentoDoAluno[] {
  const matriculas = new Map(
    banco.matriculas.filter((m) => m.alunoId === alunoId).map((m) => [m.id, m]),
  );
  return banco.congelamentos
    .filter((c) => matriculas.has(c.matriculaId))
    .sort((a, b) => b.inicio.localeCompare(a.inicio))
    .map((congelamento) => {
      const matricula = matriculas.get(congelamento.matriculaId);
      return {
        congelamento,
        plano: banco.planos.find((p) => p.id === matricula?.planoId),
        situacao: congelamentoAnulado(congelamento)
          ? "cancelado"
          : congelamento.inicio > hoje
            ? "agendado"
            : congelamento.fimReal && congelamento.fimReal < hoje
              ? "encerrado"
              : "em_curso",
        aulasSuspensas: aulasAindaSuspensas(banco, congelamento, alunoId).length,
      };
    });
}

export interface HorarioFixoDoAluno {
  horario: HorarioFixo;
  professor?: Professor;
  /** Quantos alunos estao neste horario (com o proprio). */
  alunos: number;
}

/** Horarios fixos que ainda valem, de segunda a domingo. */
export function horariosFixosDoAluno(
  banco: Banco,
  alunoId: string,
  hoje: string,
): HorarioFixoDoAluno[] {
  const doAluno = new Set(
    banco.horarioAlunos.filter((ha) => ha.alunoId === alunoId).map((ha) => ha.horarioFixoId),
  );
  return banco.horariosFixos
    .filter((h) => doAluno.has(h.id) && (!h.fim || h.fim >= hoje))
    .sort(
      (a, b) =>
        ORDEM_SEMANA.indexOf(a.diaSemana) - ORDEM_SEMANA.indexOf(b.diaSemana) ||
        a.horaInicio.localeCompare(b.horaInicio),
    )
    .map((horario) => ({
      horario,
      professor: banco.professores.find((p) => p.id === horario.professorId),
      alunos: banco.horarioAlunos.filter((ha) => ha.horarioFixoId === horario.id).length,
    }));
}

// ---------------------------------------------------------------------------
// Previas: o que vai acontecer antes de gravar
// ---------------------------------------------------------------------------

export interface PreviaDoCongelamento {
  /** Matricula que vale no inicio (sem ela nao da para congelar). */
  matricula?: Matricula;
  suspensas: AulaASuspender[];
  /** Reservas avulsas e reposicoes no periodo: nao mudam. */
  avulsas: Ocupacao[];
}

export function previaDoCongelamento(
  banco: Banco,
  alunoId: string,
  inicio: string,
  fimPrevisto: string,
): PreviaDoCongelamento {
  if (!dataValida(inicio) || !dataValida(fimPrevisto) || fimPrevisto < inicio) {
    return { suspensas: [], avulsas: [] };
  }
  return {
    matricula: matriculaVigente(banco.matriculas, alunoId, inicio),
    suspensas: aulasParaSuspender(banco, alunoId, inicio, fimPrevisto),
    avulsas: reservasAvulsasDoAluno(banco, alunoId, inicio, fimPrevisto),
  };
}

export interface PreviaDaReativacao extends PreviaDaVolta {
  /** Voltar no dia do inicio, ou antes, cancela o congelamento. */
  cancela: boolean;
  /** Ultimo dia congelado. */
  fimReal: string;
  /** Aulas que continuam suspensas depois da volta. */
  continuamSuspensas: number;
}

export function previaDaReativacao(
  banco: Banco,
  congelamentoId: string,
  dataVolta: string,
  hoje: string,
): PreviaDaReativacao | undefined {
  const congelamento = banco.congelamentos.find((c) => c.id === congelamentoId);
  const matricula = banco.matriculas.find((m) => m.id === congelamento?.matriculaId);
  if (!congelamento || !matricula || !dataValida(dataVolta)) return undefined;
  const previa = previaDaVolta(
    banco,
    congelamento,
    matricula.alunoId,
    dataVolta > hoje ? dataVolta : hoje,
  );
  const fimReal = fimRealParaVolta(congelamento, dataVolta);
  return {
    ...previa,
    cancela: fimReal < congelamento.inicio,
    fimReal,
    continuamSuspensas:
      aulasAindaSuspensas(banco, congelamento, matricula.alunoId).length - previa.voltam.length,
  };
}

export interface PreviaDaInativacao {
  matricula?: Matricula;
  plano?: Plano;
  /** Matriculas que ainda nao comecaram (sao apagadas). */
  matriculasAgendadas: number;
  /** Aulas fixas depois do ultimo dia (canceladas ou o aluno sai da turma). */
  aulas: AulaASuspender[];
  horariosFixos: number;
  /** Reservas avulsas e reposicoes futuras: nao mudam. */
  avulsas: Ocupacao[];
}

export function previaDaInativacao(
  banco: Banco,
  alunoId: string,
  ultimoDia: string,
  hoje: string,
): PreviaDaInativacao {
  const dia = dataValida(ultimoDia) ? ultimoDia : hoje;
  const matricula = matriculaVigente(banco.matriculas, alunoId, dia);
  return {
    matricula,
    plano: banco.planos.find((p) => p.id === matricula?.planoId),
    matriculasAgendadas: banco.matriculas.filter((m) => m.alunoId === alunoId && m.inicio > hoje)
      .length,
    aulas: aulasDepoisDaSaida(banco, alunoId, dia),
    horariosFixos: horariosFixosDoAluno(banco, alunoId, somarDias(dia, 1)).length,
    avulsas: reservasAvulsasDoAluno(banco, alunoId, somarDias(dia, 1), "9999-12-31"),
  };
}

// ---------------------------------------------------------------------------
// Historico de alteracoes das matriculas e congelamentos do aluno
// ---------------------------------------------------------------------------

export interface RegistroDoAlunoComHistorico {
  tabela: "matriculas" | "congelamentos";
  registroId: string;
  titulo: string;
  /** Data da alteracao mais recente, para ordenar. */
  ultimaAlteracao: string;
}

/**
 * Matriculas e congelamentos do aluno que tem alteracoes registradas na
 * auditoria (inclusive os que foram apagados, como uma troca cancelada).
 */
export function registrosDoAlunoComHistorico(
  banco: Banco,
  alunoId: string,
): RegistroDoAlunoComHistorico[] {
  const nomeDoPlano = new Map(banco.planos.map((p) => [p.id, p.nome]));
  const matriculas = new Map<string, Matricula>();
  banco.matriculas.forEach((m) => {
    if (m.alunoId === alunoId) matriculas.set(m.id, m);
  });
  banco.auditoria.forEach((r) => {
    const registro = (r.depois ?? r.antes) as Matricula | undefined;
    if (r.tabela === "matriculas" && registro?.alunoId === alunoId && !matriculas.has(r.registroId)) {
      matriculas.set(r.registroId, registro);
    }
  });

  const registros = new Map<string, RegistroDoAlunoComHistorico>();
  banco.auditoria.forEach((r) => {
    if (r.tabela === "matriculas" && matriculas.has(r.registroId)) {
      const m = matriculas.get(r.registroId)!;
      registros.set(`m|${r.registroId}`, {
        tabela: "matriculas",
        registroId: r.registroId,
        titulo: `Matrícula · ${nomeDoPlano.get(m.planoId) ?? "plano removido"} (a partir de ${formatarData(m.inicio)})`,
        ultimaAlteracao: r.em,
      });
    }
    if (r.tabela === "congelamentos") {
      const c = (r.depois ?? r.antes) as Congelamento | undefined;
      if (!c || !matriculas.has(c.matriculaId)) return;
      registros.set(`c|${r.registroId}`, {
        tabela: "congelamentos",
        registroId: r.registroId,
        titulo: `Congelamento a partir de ${formatarData(c.inicio)}`,
        ultimaAlteracao: r.em,
      });
    }
  });
  return [...registros.values()].sort((a, b) => b.ultimaAlteracao.localeCompare(a.ultimaAlteracao));
}

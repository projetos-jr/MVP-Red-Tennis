/**
 * Consultas da agenda: tudo o que as telas da agenda leem do banco.
 *
 * A grade le `banco.ocupacoes` por data (nunca o molde semanal). Com ~5.000
 * ocupacoes e ~11.000 participacoes, `montarAgenda` faz uma passada so em
 * cada tabela e devolve as ocupacoes ja agrupadas por data; as telas guardam
 * o resultado com `useMemo` e so recalculam quando o banco, o periodo ou os
 * filtros mudam.
 *
 * As previas (o que um cancelamento, bloqueio ou chuva vai causar) usam as
 * mesmas funcoes das regras que as operacoes usam para gravar.
 */

import {
  SIGLA_BLOQUEIO,
  SIGLA_CHUVA,
  aulasDepoisDoFim,
  aulasNoPeriodo,
  bloqueiosNoPeriodo,
  conflitosDoProfessor,
  conflitosNaQuadra,
  datasDaRecorrencia,
  descreverOcupacao,
  duracaoEmMinutos,
  garantirProfessorLivre,
  garantirQuadraLivre,
  horizonteDaAgenda,
  periodoDaChuva,
  reservaVencida,
  rotuloDaQuadra,
  type DataDaRecorrencia,
  type IntervaloNaQuadra,
  type PeriodoNasQuadras,
} from "../banco/regras/agenda";
import { ErroDeRegra } from "../banco/regras/comum";
import {
  precoDaLocacao,
  situacaoLancamento,
  type SituacaoLancamento,
} from "../banco/regras/financeiro";
import { planoVigente } from "../banco/regras/alunos";
import {
  buscarSigla,
  efeitoDoCancelamento,
  saldoDeReposicao,
  TIPOS_COM_DIREITO_A_REPOSICAO,
} from "../banco/regras/reposicao";
import type {
  Aluno,
  Banco,
  HorarioFixo,
  Lancamento,
  LancamentoReposicao,
  Ocupacao,
  OcupacaoAluno,
  Professor,
  Quadra,
  QuadraId,
  SiglaReposicao,
  TipoOcupacao,
} from "../banco/tipos";

export {
  ABERTURA,
  FECHAMENTO,
  MOTIVO_SEM_PAGAMENTO,
  TIPOS_COM_PROFESSOR,
  TIPOS_DE_HORARIO_FIXO,
  descreverCarimbo as descreverCarimboDaAgenda,
  duracaoEmMinutos,
  horizonteDaAgenda,
  reservaVencida,
  rotuloDaQuadra,
} from "../banco/regras/agenda";
export { TIPOS_COM_DIREITO_A_REPOSICAO } from "../banco/regras/reposicao";

// ---------------------------------------------------------------------------
// Grade
// ---------------------------------------------------------------------------

export interface FiltroAgenda {
  quadraId: QuadraId | "todas";
  professorId: string | "todos";
  tipo: TipoOcupacao | "todos";
  /** false esconde as ocupacoes canceladas. */
  mostrarCanceladas: boolean;
}

export const FILTRO_INICIAL: FiltroAgenda = {
  quadraId: "todas",
  professorId: "todos",
  tipo: "todos",
  mostrarCanceladas: true,
};

export interface ParticipanteNaAgenda {
  participacao: OcupacaoAluno;
  aluno?: Aluno;
  nome: string;
  /** Esta na aula usando minutos de reposicao. */
  porReposicao: boolean;
}

/**
 * Pagamento de uma reserva avulsa:
 *  - aguardando: dentro do prazo (Hipotese H5);
 *  - vencida: passou do prazo sem pagamento (alerta; a recepcao decide);
 *  - paga: a cobranca ligada a ocupacao foi paga (reserva confirmada).
 */
export type EstadoReserva = "aguardando" | "vencida" | "paga";

export interface ItemAgenda {
  ocupacao: Ocupacao;
  participantes: ParticipanteNaAgenda[];
  professor?: Professor;
  /** Cobranca a receber ligada a ocupacao (locacao avulsa), se houver. */
  cobranca?: Lancamento;
  estadoReserva?: EstadoReserva;
  /** Aula de reposicao, ou aula em que alguem esta usando minutos de reposicao. */
  reposicao: boolean;
  cancelada: boolean;
}

const ORDEM_QUADRA: Record<QuadraId, number> = { "1": 1, "2": 2, "3": 3, "4": 4, paredao: 5 };

function agrupar<T>(lista: T[], chave: (item: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  lista.forEach((item) => {
    const k = chave(item);
    const grupo = mapa.get(k);
    if (grupo) grupo.push(item);
    else mapa.set(k, [item]);
  });
  return mapa;
}

function passaNoFiltro(o: Ocupacao, filtro: FiltroAgenda): boolean {
  if (filtro.quadraId !== "todas" && o.quadraId !== filtro.quadraId) return false;
  if (filtro.professorId !== "todos" && o.professorId !== filtro.professorId) return false;
  if (filtro.tipo !== "todos" && o.tipo !== filtro.tipo) return false;
  if (!filtro.mostrarCanceladas && o.situacao === "cancelada") return false;
  return true;
}

/** Monta os itens da agenda (com alunos, professor e pagamento) das ocupacoes informadas. */
function montarItens(banco: Banco, ocupacoes: Ocupacao[], agora: string): ItemAgenda[] {
  const ids = new Set(ocupacoes.map((o) => o.id));
  const alunoPorId = new Map(banco.alunos.map((a) => [a.id, a]));
  const professorPorId = new Map(banco.professores.map((p) => [p.id, p]));
  const participantes = agrupar(
    banco.ocupacaoAlunos.filter((p) => ids.has(p.ocupacaoId)),
    (p) => p.ocupacaoId,
  );
  const cobrancas = new Map<string, Lancamento>();
  banco.lancamentos.forEach((l) => {
    if (l.ocupacaoId && ids.has(l.ocupacaoId) && !l.canceladoEm) cobrancas.set(l.ocupacaoId, l);
  });
  const usos = new Set<string>();
  banco.reposicoes.forEach((r) => {
    if (r.minutos < 0 && r.ocupacaoUsoId && ids.has(r.ocupacaoUsoId)) {
      usos.add(`${r.ocupacaoUsoId}|${r.alunoId}`);
    }
  });

  return ocupacoes.map((ocupacao) => {
    const cobranca = cobrancas.get(ocupacao.id);
    const lista = (participantes.get(ocupacao.id) ?? []).map((participacao) => {
      const aluno = alunoPorId.get(participacao.alunoId);
      return {
        participacao,
        aluno,
        nome: aluno?.nome ?? "Aluno removido",
        porReposicao: usos.has(`${ocupacao.id}|${participacao.alunoId}`),
      };
    });
    let estadoReserva: EstadoReserva | undefined;
    if (ocupacao.situacao === "aguardando_pagamento") {
      estadoReserva = reservaVencida(ocupacao, agora) ? "vencida" : "aguardando";
    } else if (cobranca?.pagoEm && ocupacao.situacao !== "cancelada") {
      estadoReserva = "paga";
    }
    return {
      ocupacao,
      participantes: lista,
      professor: ocupacao.professorId ? professorPorId.get(ocupacao.professorId) : undefined,
      cobranca,
      estadoReserva,
      reposicao: ocupacao.descricao === "Reposição" || lista.some((p) => p.porReposicao),
      cancelada: ocupacao.situacao === "cancelada",
    };
  });
}

function ordenarItens(a: ItemAgenda, b: ItemAgenda): number {
  return (
    a.ocupacao.horaInicio.localeCompare(b.ocupacao.horaInicio) ||
    ORDEM_QUADRA[a.ocupacao.quadraId] - ORDEM_QUADRA[b.ocupacao.quadraId] ||
    Number(a.cancelada) - Number(b.cancelada)
  );
}

/**
 * Ocupacoes das datas informadas que passam no filtro, agrupadas por data e
 * ordenadas por horario e quadra. Toda data pedida aparece no mapa (vazia se
 * nao houver nada). `agora` decide se uma reserva ja passou do prazo.
 */
export function montarAgenda(
  banco: Banco,
  datas: string[],
  filtro: FiltroAgenda,
  agora: string,
): Map<string, ItemAgenda[]> {
  const conjunto = new Set(datas);
  const doPeriodo = banco.ocupacoes.filter((o) => conjunto.has(o.data) && passaNoFiltro(o, filtro));
  const porData = new Map<string, ItemAgenda[]>(datas.map((d) => [d, []]));
  montarItens(banco, doPeriodo, agora).forEach((item) =>
    porData.get(item.ocupacao.data)?.push(item),
  );
  porData.forEach((itens) => itens.sort(ordenarItens));
  return porData;
}

export interface ResumoDaAgenda {
  /** Aulas e reservas ativas (sem contar os bloqueios). */
  ativas: number;
  /** Alunos diferentes nas ocupacoes ativas. */
  alunos: number;
  canceladas: number;
  /** Bloqueios de quadra ativos. */
  bloqueios: number;
  aguardandoPagamento: number;
  vencidas: number;
  /** Minutos de quadra ocupados (ativas, inclusive bloqueios). */
  minutosOcupados: number;
  /** Minutos de quadra disponiveis no periodo (quadras x 15 h x dias). */
  minutosDisponiveis: number;
}

/** Contadores do periodo visivel (os mesmos filtros da grade). */
export function resumirAgenda(
  porData: Map<string, ItemAgenda[]>,
  datas: string[],
  quantidadeDeQuadras: number,
): ResumoDaAgenda {
  const resumo: ResumoDaAgenda = {
    ativas: 0,
    alunos: 0,
    canceladas: 0,
    bloqueios: 0,
    aguardandoPagamento: 0,
    vencidas: 0,
    minutosOcupados: 0,
    minutosDisponiveis: datas.length * quantidadeDeQuadras * 15 * 60,
  };
  const alunos = new Set<string>();
  datas.forEach((data) =>
    (porData.get(data) ?? []).forEach((item) => {
      if (item.cancelada) {
        resumo.canceladas += 1;
        return;
      }
      resumo.minutosOcupados += duracaoEmMinutos(item.ocupacao);
      if (item.ocupacao.tipo === "Bloqueio") {
        resumo.bloqueios += 1;
        return;
      }
      resumo.ativas += 1;
      item.participantes.forEach((p) => alunos.add(p.participacao.alunoId));
      if (item.estadoReserva === "aguardando") resumo.aguardandoPagamento += 1;
      if (item.estadoReserva === "vencida") {
        resumo.aguardandoPagamento += 1;
        resumo.vencidas += 1;
      }
    }),
  );
  resumo.alunos = alunos.size;
  return resumo;
}

// ---------------------------------------------------------------------------
// Painel do horario
// ---------------------------------------------------------------------------

export interface LinhaDeReposicao {
  lancamento: LancamentoReposicao;
  nome: string;
}

export interface DetalheDaOcupacao {
  item: ItemAgenda;
  quadra?: Quadra;
  horarioFixo?: HorarioFixo;
  /** Alunos do horario fixo de origem. */
  alunosDoHorarioFixo: string[];
  /** Creditos de reposicao que esta aula gerou (cancelamento ou falta avisada). */
  creditosGerados: LinhaDeReposicao[];
  /** Minutos de reposicao usados para estar nesta aula. */
  usos: LinhaDeReposicao[];
  /** Todas as cobrancas ligadas (inclusive anuladas), com a situacao calculada. */
  cobrancas: Array<{ lancamento: Lancamento; situacao: SituacaoLancamento }>;
}

export function detalheDaOcupacao(
  banco: Banco,
  id: string,
  agora: string,
  hoje: string,
): DetalheDaOcupacao | undefined {
  const ocupacao = banco.ocupacoes.find((o) => o.id === id);
  if (!ocupacao) return undefined;
  const [item] = montarItens(banco, [ocupacao], agora);
  const nome = (alunoId: string) =>
    banco.alunos.find((a) => a.id === alunoId)?.nome ?? "Aluno removido";
  const horarioFixo = ocupacao.horarioFixoId
    ? banco.horariosFixos.find((h) => h.id === ocupacao.horarioFixoId)
    : undefined;
  return {
    item,
    quadra: banco.quadras.find((q) => q.id === ocupacao.quadraId),
    horarioFixo,
    alunosDoHorarioFixo: horarioFixo
      ? banco.horarioAlunos
          .filter((h) => h.horarioFixoId === horarioFixo.id)
          .map((h) => nome(h.alunoId))
      : [],
    creditosGerados: banco.reposicoes
      .filter((r) => r.minutos > 0 && r.ocupacaoOrigemId === id)
      .map((lancamento) => ({ lancamento, nome: nome(lancamento.alunoId) })),
    usos: banco.reposicoes
      .filter((r) => r.minutos < 0 && r.ocupacaoUsoId === id)
      .map((lancamento) => ({ lancamento, nome: nome(lancamento.alunoId) })),
    cobrancas: banco.lancamentos
      .filter((l) => l.ocupacaoId === id)
      .map((lancamento) => ({ lancamento, situacao: situacaoLancamento(lancamento, hoje) })),
  };
}

/** Siglas para a falta de um aluno (aplicam a "aluno" ou "ambos"). */
export function siglasParaFaltaDeAluno(banco: Banco): SiglaReposicao[] {
  return banco.configuracoes.siglas.filter((s) => s.aplicaA !== "ocupacao");
}

/** Siglas para cancelar a aula inteira (aplicam a "ocupacao" ou "ambos"). */
export function siglasParaCancelarAula(banco: Banco): SiglaReposicao[] {
  return banco.configuracoes.siglas.filter((s) => s.aplicaA !== "aluno");
}

export function buscarSiglaDaAgenda(banco: Banco, codigo: string): SiglaReposicao | undefined {
  return buscarSigla(banco.configuracoes, codigo);
}

/** O tipo da ocupacao da direito a credito quando a aula e perdida? (planos mensais) */
export function tipoComDireitoAReposicao(tipo: TipoOcupacao): boolean {
  return TIPOS_COM_DIREITO_A_REPOSICAO.includes(tipo);
}

export interface PreviaPorAluno {
  alunoId: string;
  nome: string;
  minutos: number;
  jaTinhaCredito: boolean;
}

export interface PreviaDeCancelamento {
  porAluno: PreviaPorAluno[];
  minutosTotais: number;
  /** Cobranca ainda nao paga que sera anulada. */
  cobrancaAnulada?: Lancamento;
  /** Cobranca ja paga: a devolucao e tratada no Financeiro. */
  cobrancaPaga?: Lancamento;
}

/** O que cancelar a ocupacao com `motivo` vai causar, aluno por aluno (antes de confirmar). */
export function previaDoCancelamento(
  banco: Banco,
  ocupacao: Ocupacao,
  motivo: string,
  agora: string,
): PreviaDeCancelamento {
  const efeito = efeitoDoCancelamento(banco, ocupacao, motivo.trim(), agora);
  const cobrancas = banco.lancamentos.filter((l) => l.ocupacaoId === ocupacao.id && !l.canceladoEm);
  return {
    porAluno: efeito.porAluno.map((p) => ({
      ...p,
      nome: banco.alunos.find((a) => a.id === p.alunoId)?.nome ?? "Aluno removido",
    })),
    minutosTotais: efeito.minutosTotais,
    cobrancaAnulada: cobrancas.find((l) => !l.pagoEm),
    cobrancaPaga: cobrancas.find((l) => l.pagoEm),
  };
}

/** Aulas do horario fixo que saem da agenda se ele for encerrado em `fim`. */
export function previaDoEncerramento(
  banco: Banco,
  horarioFixoId: string,
  fim: string,
  hoje: string,
): Ocupacao[] {
  return aulasDepoisDoFim(banco, horarioFixoId, fim, hoje);
}

// ---------------------------------------------------------------------------
// Formularios: conflito, disponibilidade, recorrencia
// ---------------------------------------------------------------------------

export interface ChecagemDeHorario {
  /** Mensagem da regra de conflito de quadra (a mesma que a operacao devolve). */
  conflitoNaQuadra?: string;
  /** Aviso de professor em duas aulas ao mesmo tempo (Hipotese H10). */
  professorOcupado?: string;
  /** true quando a opcao de bloquear o professor em duas aulas esta ligada. */
  professorBloqueia: boolean;
}

function mensagemDaRegra(verificar: () => void): string | undefined {
  try {
    verificar();
    return undefined;
  } catch (erro) {
    if (erro instanceof ErroDeRegra) return erro.message;
    throw erro;
  }
}

/** Checagem ao vivo do formulario, com as mesmas regras da gravacao. */
export function checarHorario(
  banco: Banco,
  alvo: IntervaloNaQuadra & { professorId?: string },
): ChecagemDeHorario {
  const conflitoNaQuadra = mensagemDaRegra(() => garantirQuadraLivre(banco, alvo));
  const outraAula = alvo.professorId ? conflitosDoProfessor(banco.ocupacoes, alvo)[0] : undefined;
  const professor = banco.professores.find((p) => p.id === alvo.professorId);
  return {
    conflitoNaQuadra,
    professorOcupado: outraAula
      ? `${professor?.nome ?? "O professor"} já tem aula das ${outraAula.horaInicio} às ${outraAula.horaFim} ` +
        `(${rotuloDaQuadra(outraAula.quadraId)}).`
      : undefined,
    professorBloqueia: banco.configuracoes.bloquearProfessorEmDuasAulas,
  };
}

/** Para cada quadra, o que ja ocupa o intervalo (vazio = livre). */
export function disponibilidadeDasQuadras(
  banco: Banco,
  intervalo: Omit<IntervaloNaQuadra, "quadraId">,
): Map<QuadraId, Ocupacao | undefined> {
  const doDia = banco.ocupacoes.filter((o) => o.data === intervalo.data);
  return new Map(
    quadrasDaArena(banco).map((q) => [
      q.id,
      conflitosNaQuadra(doDia, { ...intervalo, quadraId: q.id })[0],
    ]),
  );
}

export interface DataDaPrevia extends DataDaRecorrencia {
  /** "Individual · Guilherme Lima" — quem ja ocupa a quadra. */
  quemOcupa?: string;
}

export interface PreviaDaRecorrencia {
  datas: DataDaPrevia[];
  /** Ultima data com aulas criadas (Hipotese H12). */
  ate: string;
}

/** Datas de um horario fixo novo, com os conflitos de cada uma (antes de salvar). */
export function previaDaRecorrencia(
  banco: Banco,
  dados: {
    quadraId: QuadraId;
    dataInicio: string;
    fim?: string;
    horaInicio: string;
    horaFim: string;
    professorId?: string;
    diaSemana: number;
  },
  hoje: string,
): PreviaDaRecorrencia {
  const ate = horizonteDaAgenda(banco.configuracoes, hoje);
  const datas = datasDaRecorrencia(
    banco,
    {
      quadraId: dados.quadraId,
      diaSemana: dados.diaSemana,
      horaInicio: dados.horaInicio,
      horaFim: dados.horaFim,
      inicio: dados.dataInicio,
      fim: dados.fim || undefined,
      professorId: dados.professorId,
    },
    ate,
  );
  return {
    ate,
    datas: datas.map((d) => ({
      ...d,
      quemOcupa: d.conflito ? descreverOcupacao(banco, d.conflito) : undefined,
    })),
  };
}

/** Valor de uma locacao avulsa pela quadra e duracao (regra do financeiro, valores das Configuracoes). */
export function valorDaLocacao(
  banco: Banco,
  alvo: Pick<Ocupacao, "quadraId" | "horaInicio" | "horaFim">,
): number {
  return precoDaLocacao(banco.configuracoes, alvo);
}

/** Mensagem da regra de professor para uma data (so com a opcao H10 ligada). */
export function bloqueioDoProfessor(
  banco: Banco,
  alvo: Omit<IntervaloNaQuadra, "quadraId"> & { professorId?: string },
): string | undefined {
  return mensagemDaRegra(() => garantirProfessorLivre(banco, alvo));
}

// ---------------------------------------------------------------------------
// Bloqueio e chuva
// ---------------------------------------------------------------------------

export interface AulaAfetada {
  item: ItemAgenda;
  porAluno: PreviaPorAluno[];
  minutos: number;
}

export interface PreviaEmLote {
  aulas: AulaAfetada[];
  alunos: number;
  minutos: number;
  /** Reservas ja pagas que serao canceladas (a devolucao e combinada no Financeiro). */
  reservasPagas: number;
  /** Bloqueios que ja existem no periodo (impedem um bloqueio novo). */
  bloqueiosExistentes: Ocupacao[];
}

function previaEmLote(
  banco: Banco,
  periodo: PeriodoNasQuadras,
  motivo: string,
  agora: string,
): PreviaEmLote {
  const afetadas = aulasNoPeriodo(banco, periodo);
  const aulas = montarItens(banco, afetadas, agora).map((item) => {
    const previa = previaDoCancelamento(banco, item.ocupacao, motivo, agora);
    return { item, porAluno: previa.porAluno, minutos: previa.minutosTotais };
  });
  return {
    aulas,
    alunos: new Set(aulas.flatMap((a) => a.porAluno.map((p) => p.alunoId))).size,
    minutos: aulas.reduce((soma, a) => soma + a.minutos, 0),
    reservasPagas: aulas.filter((a) => a.item.estadoReserva === "paga").length,
    bloqueiosExistentes: bloqueiosNoPeriodo(banco, periodo),
  };
}

/** Aulas que um bloqueio cancelaria (com IAC) e os creditos de cada aluno. */
export function previaDoBloqueio(
  banco: Banco,
  periodo: PeriodoNasQuadras,
  agora: string,
): PreviaEmLote {
  return previaEmLote(banco, periodo, SIGLA_BLOQUEIO, agora);
}

/** Aulas que a chuva cancelaria (com CH) e os creditos de cada aluno. */
export function previaDaChuva(
  banco: Banco,
  dados: { data: string; quadrasIds: QuadraId[]; horaInicio?: string; horaFim?: string },
  agora: string,
): PreviaEmLote {
  return previaEmLote(banco, periodoDaChuva(dados), SIGLA_CHUVA, agora);
}

// ---------------------------------------------------------------------------
// Reservas sem pagamento (Hipotese H5)
// ---------------------------------------------------------------------------

export interface ReservaAguardando {
  item: ItemAgenda;
  titular?: string;
  vencida: boolean;
}

/** Reservas aguardando pagamento: as vencidas primeiro, depois pelo prazo. */
export function reservasAguardandoPagamento(banco: Banco, agora: string): ReservaAguardando[] {
  const aguardando = banco.ocupacoes.filter((o) => o.situacao === "aguardando_pagamento");
  return montarItens(banco, aguardando, agora)
    .map((item) => ({
      item,
      titular: item.participantes[0]?.nome,
      vencida: item.estadoReserva === "vencida",
    }))
    .sort(
      (a, b) =>
        Number(b.vencida) - Number(a.vencida) ||
        (a.item.ocupacao.prazoPagamento ?? "").localeCompare(b.item.ocupacao.prazoPagamento ?? ""),
    );
}

export function contarReservasVencidas(banco: Banco, agora: string): number {
  return banco.ocupacoes.filter((o) => reservaVencida(o, agora)).length;
}

// ---------------------------------------------------------------------------
// Cadastros usados pela agenda
// ---------------------------------------------------------------------------

export function quadrasDaArena(banco: Banco): Quadra[] {
  return [...banco.quadras].sort((a, b) => a.ordem - b.ordem);
}

export function professoresAtivos(banco: Banco): Professor[] {
  return banco.professores.filter((p) => p.ativo);
}

/** `?quadra=` da URL: "1" a "4" ou "paredao". */
export function quadraPelaUrl(banco: Banco, valor: string | null): QuadraId | undefined {
  return banco.quadras.find((q) => q.id === valor)?.id;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** `?professor=` da URL: o id ou, por compatibilidade com o MVP, o nome. */
export function professorPelaUrl(banco: Banco, valor: string | null): string | undefined {
  if (!valor) return undefined;
  const porId = banco.professores.find((p) => p.id === valor);
  if (porId) return porId.id;
  const nome = semAcento(valor);
  return banco.professores.find((p) => semAcento(p.nome) === nome)?.id;
}

export interface OpcaoDeAluno {
  aluno: Aluno;
  /** Plano atual ou "Sem plano mensal". */
  detalhe: string;
  /** Minutos de reposicao disponiveis hoje. */
  saldo: number;
}

/** Alunos ativos para os seletores da agenda (busca por nome, sem acento). */
export function buscarAlunosParaAgenda(
  banco: Banco,
  termo: string,
  hoje: string,
  opcoes: { excluir?: string[]; limite?: number } = {},
): OpcaoDeAluno[] {
  const busca = semAcento(termo);
  const excluir = new Set(opcoes.excluir ?? []);
  return banco.alunos
    .filter((a) => a.ativo && !excluir.has(a.id) && (!busca || semAcento(a.nome).includes(busca)))
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .slice(0, opcoes.limite ?? 30)
    .map((aluno) => ({
      aluno,
      detalhe: planoVigente(banco, aluno.id, hoje)?.nome ?? "Sem plano mensal",
      saldo: saldoDeReposicao(banco.reposicoes, aluno.id, hoje),
    }));
}

export function saldoDoAluno(banco: Banco, alunoId: string, hoje: string): number {
  return saldoDeReposicao(banco.reposicoes, alunoId, hoje);
}

/** Nome de um aluno pelo id (para os chips dos formularios). */
export function nomeDoAluno(banco: Banco, alunoId: string): string {
  return banco.alunos.find((a) => a.id === alunoId)?.nome ?? "Aluno removido";
}

export function buscarAlunoDaAgenda(banco: Banco, alunoId: string): Aluno | undefined {
  return banco.alunos.find((a) => a.id === alunoId);
}

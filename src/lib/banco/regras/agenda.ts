/**
 * Regras da agenda.
 *
 * A principal: duas ocupacoes que nao estejam canceladas nao podem dividir a
 * mesma quadra no mesmo horario. Bloqueios seguem a mesma regra. No banco
 * real isso vira uma "exclusion constraint" (btree_gist) na tabela
 * `ocupacoes`; aqui, `garantirQuadraLivre` faz o mesmo papel.
 */

import {
  diaDaSemana,
  formatarData,
  formatarDiaMes,
  horaParaMinutos,
  inicioDaSemana,
  somarDias,
} from "../../date";
import type {
  Banco,
  Colaborador,
  Configuracoes,
  HorarioFixo,
  Ocupacao,
  QuadraId,
  TipoOcupacao,
} from "../tipos";
import { ErroDeRegra, sobrepoe } from "./comum";

/** O que basta saber de uma ocupacao para checar conflito. */
export interface IntervaloNaQuadra {
  /** Id da propria ocupacao, para ignora-la ao editar. */
  id?: string;
  quadraId: QuadraId;
  data: string;
  horaInicio: string;
  horaFim: string;
}

export function ocupacaoAtiva(ocupacao: Ocupacao): boolean {
  return ocupacao.situacao !== "cancelada";
}

export function rotuloDaQuadra(quadraId: QuadraId): string {
  return quadraId === "paredao" ? "Paredão" : `Quadra ${quadraId}`;
}

export function duracaoEmMinutos(
  item: Pick<Ocupacao, "horaInicio" | "horaFim">,
): number {
  return horaParaMinutos(item.horaFim) - horaParaMinutos(item.horaInicio);
}

/** Ocupacoes ativas que batem com o intervalo na mesma quadra. */
export function conflitosNaQuadra(
  ocupacoes: Ocupacao[],
  alvo: IntervaloNaQuadra,
): Ocupacao[] {
  return ocupacoes.filter(
    (o) =>
      o.id !== alvo.id &&
      ocupacaoAtiva(o) &&
      o.quadraId === alvo.quadraId &&
      o.data === alvo.data &&
      sobrepoe(o.horaInicio, o.horaFim, alvo.horaInicio, alvo.horaFim),
  );
}

/** Ocupacoes ativas do mesmo professor que batem com o intervalo (em qualquer quadra). */
export function conflitosDoProfessor(
  ocupacoes: Ocupacao[],
  alvo: Omit<IntervaloNaQuadra, "quadraId"> & { professorId?: string },
): Ocupacao[] {
  if (!alvo.professorId) return [];
  return ocupacoes.filter(
    (o) =>
      o.id !== alvo.id &&
      ocupacaoAtiva(o) &&
      o.professorId === alvo.professorId &&
      o.data === alvo.data &&
      sobrepoe(o.horaInicio, o.horaFim, alvo.horaInicio, alvo.horaFim),
  );
}

/** "Individual · Guilherme Lima", "Bloqueio · Manutenção do saibro"... */
export function descreverOcupacao(banco: Banco, ocupacao: Ocupacao): string {
  if (ocupacao.tipo === "Bloqueio") {
    return `Bloqueio${ocupacao.descricao ? ` · ${ocupacao.descricao}` : ""}`;
  }
  const nomes = banco.ocupacaoAlunos
    .filter((p) => p.ocupacaoId === ocupacao.id)
    .map((p) => banco.alunos.find((a) => a.id === p.alunoId)?.nome)
    .filter(Boolean);
  const pessoas =
    nomes.length === 0
      ? ""
      : nomes.length <= 2
        ? ` · ${nomes.join(" e ")}`
        : ` · ${nomes[0]} e mais ${nomes.length - 1}`;
  return `${ocupacao.tipo}${pessoas}`;
}

/**
 * Recusa a operacao se a quadra ja estiver ocupada no intervalo.
 * A mensagem diz quem ocupa, para a recepcao resolver na hora.
 */
export function garantirQuadraLivre(banco: Banco, alvo: IntervaloNaQuadra): void {
  const conflito = conflitosNaQuadra(banco.ocupacoes, alvo)[0];
  if (!conflito) return;
  throw new ErroDeRegra(
    `${rotuloDaQuadra(alvo.quadraId)} já está ocupada em ${formatarDiaMes(alvo.data)} ` +
      `das ${conflito.horaInicio} às ${conflito.horaFim} ` +
      `(${descreverOcupacao(banco, conflito)}).`,
  );
}

/** Horario de inicio antes do fim, dentro do funcionamento da arena. */
export function garantirHorarioValido(horaInicio: string, horaFim: string): void {
  if (!(horaInicio < horaFim)) {
    throw new ErroDeRegra("O horário de término precisa ser depois do início.");
  }
  if (horaInicio < "07:00" || horaFim > "22:00") {
    throw new ErroDeRegra("A arena funciona das 07:00 às 22:00.");
  }
}

/** Datas (entre `de` e `ate`, inclusive) em que um horario fixo acontece. */
export function datasDoHorarioFixo(
  horario: Pick<HorarioFixo, "diaSemana" | "inicio" | "fim">,
  de: string,
  ate: string,
): string[] {
  const inicio = horario.inicio > de ? horario.inicio : de;
  const fim = horario.fim && horario.fim < ate ? horario.fim : ate;
  const datas: string[] = [];
  let data = inicio;
  // Avanca ate o primeiro dia da semana certo e depois de 7 em 7 dias.
  while (data <= fim && diaDaSemana(data) !== horario.diaSemana) {
    data = somarDias(data, 1);
  }
  while (data <= fim) {
    datas.push(data);
    data = somarDias(data, 7);
  }
  return datas;
}

/**
 * Indice "quadra|data" -> ocupacoes ativas, para checar muitos conflitos de
 * uma vez sem varrer a lista inteira a cada consulta (usado na geracao de
 * dados e em operacoes em lote, como a recorrencia).
 */
export function indexarPorQuadraEData(ocupacoes: Ocupacao[]): Map<string, Ocupacao[]> {
  const indice = new Map<string, Ocupacao[]>();
  ocupacoes.forEach((o) => {
    if (!ocupacaoAtiva(o)) return;
    const chave = `${o.quadraId}|${o.data}`;
    const lista = indice.get(chave);
    if (lista) lista.push(o);
    else indice.set(chave, [o]);
  });
  return indice;
}

export function livreNoIndice(
  indice: Map<string, Ocupacao[]>,
  alvo: IntervaloNaQuadra,
): boolean {
  const lista = indice.get(`${alvo.quadraId}|${alvo.data}`) ?? [];
  return !lista.some(
    (o) =>
      o.id !== alvo.id &&
      sobrepoe(o.horaInicio, o.horaFim, alvo.horaInicio, alvo.horaFim),
  );
}

// ---------------------------------------------------------------------------
// Regras usadas pelas operacoes da agenda (modulo Agenda)
// ---------------------------------------------------------------------------

/** Tipos de aula que precisam de professor. */
export const TIPOS_COM_PROFESSOR: TipoOcupacao[] = ["Individual", "Dupla", "LAP"];

/**
 * Tipos que podem virar horario fixo (repetem toda semana): os planos
 * mensais. Locacao avulsa e ranking sao reservas de uma data so, e o
 * bloqueio tem a sua propria acao.
 */
export const TIPOS_DE_HORARIO_FIXO: TipoOcupacao[] = [
  "Individual",
  "Dupla",
  "LAP",
  "Locação Mensal",
  "Plano de locação",
];

/**
 * Motivo gravado ao liberar uma reserva que passou do prazo sem pagamento
 * (Hipotese H5). Nao e uma sigla, entao nao gera credito de reposicao.
 */
export const MOTIVO_SEM_PAGAMENTO = "Sem pagamento no prazo";

/** Siglas usadas pelas acoes em lote (codigos da lista de Configuracoes, H1). */
export const SIGLA_CHUVA = "CH";
export const SIGLA_BLOQUEIO = "IAC";

/** Funcionamento da arena: o "dia inteiro" do cancelamento por chuva. */
export const ABERTURA = "07:00";
export const FECHAMENTO = "22:00";

/** "YYYY-MM-DD" que existe no calendario (recusa "2026-02-30"). */
export function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

export function garantirDataValida(data: string): void {
  if (!dataValida(data)) throw new ErroDeRegra("Informe uma data válida.");
}

/** Agendamentos novos so a partir de hoje (o passado fica como historico). */
export function garantirDataFutura(data: string, hoje: string): void {
  garantirDataValida(data);
  if (data < hoje) throw new ErroDeRegra("Escolha uma data a partir de hoje.");
}

/** Carimbo "YYYY-MM-DDTHH:mm:ss" (fuso da arena) somado de algumas horas. */
export function somarHoras(carimbo: string, horas: number): string {
  const [data, hora = "00:00:00"] = carimbo.split("T");
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, m, s = 0] = hora.split(":").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, h, m, s) + horas * 3_600_000)
    .toISOString()
    .slice(0, 19);
}

/**
 * Prazo para pagar uma reserva avulsa (Hipotese H5): `prazoPagamentoReservaHoras`
 * depois de feita, mas nunca depois do inicio da propria reserva — depois que
 * a quadra foi usada, nao ha mais horario para ceder a outra pessoa.
 */
export function prazoDaReserva(
  configuracoes: Configuracoes,
  agora: string,
  reserva: Pick<Ocupacao, "data" | "horaInicio">,
): string {
  const pelasHoras = somarHoras(agora, configuracoes.prazoPagamentoReservaHoras);
  const inicio = `${reserva.data}T${reserva.horaInicio}:00`;
  return pelasHoras < inicio ? pelasHoras : inicio;
}

/** Reserva aguardando pagamento que ja passou do prazo (Hipotese H5: so alerta). */
export function reservaVencida(ocupacao: Ocupacao, agora: string): boolean {
  return (
    ocupacao.situacao === "aguardando_pagamento" &&
    Boolean(ocupacao.prazoPagamento) &&
    (ocupacao.prazoPagamento ?? "") < agora
  );
}

/**
 * Ultimo dia com aulas criadas para os horarios fixos (Hipotese H12): o fim
 * da semana que fica `semanasGeradasAFrente` semanas a frente. E o mesmo
 * limite usado nos dados de exemplo.
 */
export function horizonteDaAgenda(configuracoes: Configuracoes, hoje: string): string {
  return somarDias(inicioDaSemana(hoje), 7 * configuracoes.semanasGeradasAFrente - 1);
}

export interface DataDaRecorrencia {
  data: string;
  /** Ocupacao ativa que ja usa a quadra nessa data e horario. */
  conflito?: Ocupacao;
  /** Aula do mesmo professor no mesmo horario, em outra quadra (Hipotese H10). */
  professorOcupado?: Ocupacao;
}

/**
 * Cada data em que um horario fixo novo cairia (ate `ate`), com o que ja
 * ocupa a quadra ou o professor nesse dia. A tela mostra a lista antes de
 * salvar; a operacao recusa as datas em conflito que nao foram puladas.
 */
export function datasDaRecorrencia(
  banco: Banco,
  molde: Pick<
    HorarioFixo,
    "quadraId" | "diaSemana" | "horaInicio" | "horaFim" | "inicio" | "fim" | "professorId"
  >,
  ate: string,
): DataDaRecorrencia[] {
  const datas = datasDoHorarioFixo(molde, molde.inicio, ate);
  const doPeriodo = new Map<string, Ocupacao[]>(datas.map((d) => [d, []]));
  banco.ocupacoes.forEach((o) => {
    if (ocupacaoAtiva(o)) doPeriodo.get(o.data)?.push(o);
  });
  return datas.map((data) => {
    const doDia = doPeriodo.get(data) ?? [];
    const alvo = {
      quadraId: molde.quadraId,
      data,
      horaInicio: molde.horaInicio,
      horaFim: molde.horaFim,
    };
    return {
      data,
      conflito: conflitosNaQuadra(doDia, alvo)[0],
      professorOcupado: conflitosDoProfessor(doDia, { ...alvo, professorId: molde.professorId })[0],
    };
  });
}

/**
 * Hipotese H10: professor em duas aulas ao mesmo tempo. Por padrao a tela so
 * avisa; com `bloquearProfessorEmDuasAulas` ligado, a operacao recusa.
 */
export function garantirProfessorLivre(
  banco: Banco,
  alvo: Omit<IntervaloNaQuadra, "quadraId"> & { professorId?: string },
): void {
  if (!banco.configuracoes.bloquearProfessorEmDuasAulas) return;
  const conflito = conflitosDoProfessor(banco.ocupacoes, alvo)[0];
  if (!conflito) return;
  const nome = banco.professores.find((p) => p.id === alvo.professorId)?.nome ?? "O professor";
  throw new ErroDeRegra(
    `${nome} já tem aula em ${formatarDiaMes(alvo.data)} das ${conflito.horaInicio} às ` +
      `${conflito.horaFim} (${rotuloDaQuadra(conflito.quadraId)}).`,
  );
}

/** Hipotese H9: o perfil de professor so consulta a agenda. */
export function garantirPodeEditarAgenda(usuario: Pick<Colaborador, "perfil">): void {
  if (usuario.perfil === "professor") {
    throw new ErroDeRegra("O seu perfil só pode consultar a agenda. Peça à recepção para fazer a alteração.");
  }
}

/** Intervalo de horario em uma ou mais quadras numa data (bloqueio, chuva). */
export interface PeriodoNasQuadras {
  quadrasIds: QuadraId[];
  data: string;
  horaInicio: string;
  horaFim: string;
}

/** Ocupacoes ativas (exceto bloqueios) que batem com o periodo nas quadras escolhidas. */
export function aulasNoPeriodo(banco: Banco, periodo: PeriodoNasQuadras): Ocupacao[] {
  const quadras = new Set(periodo.quadrasIds);
  return banco.ocupacoes
    .filter(
      (o) =>
        o.data === periodo.data &&
        quadras.has(o.quadraId) &&
        o.tipo !== "Bloqueio" &&
        ocupacaoAtiva(o) &&
        sobrepoe(o.horaInicio, o.horaFim, periodo.horaInicio, periodo.horaFim),
    )
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.quadraId.localeCompare(b.quadraId));
}

/** Periodo do cancelamento por chuva: sem horario informado, e o dia inteiro. */
export function periodoDaChuva(dados: {
  data: string;
  quadrasIds: QuadraId[];
  horaInicio?: string;
  horaFim?: string;
}): PeriodoNasQuadras {
  return {
    quadrasIds: [...new Set(dados.quadrasIds)],
    data: dados.data,
    horaInicio: dados.horaInicio || ABERTURA,
    horaFim: dados.horaFim || FECHAMENTO,
  };
}

/**
 * Aulas de um horario fixo que saem da agenda quando ele e encerrado em
 * `fim`: as depois dessa data que ainda nao aconteceram (de hoje em diante,
 * agendadas ou aguardando pagamento). Canceladas e realizadas ficam como
 * historico.
 */
export function aulasDepoisDoFim(
  banco: Banco,
  horarioFixoId: string,
  fim: string,
  hoje: string,
): Ocupacao[] {
  return banco.ocupacoes
    .filter(
      (o) =>
        o.horarioFixoId === horarioFixoId &&
        o.data > fim &&
        o.data >= hoje &&
        (o.situacao === "agendada" || o.situacao === "aguardando_pagamento"),
    )
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Bloqueios ativos que ja ocupam parte do periodo (um bloqueio nao cancela outro). */
export function bloqueiosNoPeriodo(banco: Banco, periodo: PeriodoNasQuadras): Ocupacao[] {
  const quadras = new Set(periodo.quadrasIds);
  return banco.ocupacoes.filter(
    (o) =>
      o.data === periodo.data &&
      quadras.has(o.quadraId) &&
      o.tipo === "Bloqueio" &&
      ocupacaoAtiva(o) &&
      sobrepoe(o.horaInicio, o.horaFim, periodo.horaInicio, periodo.horaFim),
  );
}

/** "29/10/2026 às 18:00" a partir de um carimbo. */
export function descreverCarimbo(carimbo: string): string {
  const [data, hora = ""] = carimbo.split("T");
  return `${formatarData(data)}${hora ? ` às ${hora.slice(0, 5)}` : ""}`;
}

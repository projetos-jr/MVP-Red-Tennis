/**
 * Regras do financeiro.
 *
 * A situacao de um lancamento nunca e digitada: sai das datas.
 *  - pago: tem data de pagamento;
 *  - em atraso: passou do vencimento sem pagamento;
 *  - pendente: ainda dentro do prazo;
 *  - cancelado: anulado (lancamentos nunca se apagam).
 *
 * Tambem ficam aqui as regras que as operacoes do financeiro usam e que viram
 * constraint, politica de acesso ou funcao no banco real: categorias de cada
 * tipo, datas e meses validos, quem mexe em cada tipo de lancamento (H9),
 * quais matriculas geram mensalidade num mes e quanto falta pagar de repasse.
 */

import { diferencaEmDias, formatarMesAno, somarMeses } from "../../date";
import type {
  Banco,
  CategoriaLancamento,
  Colaborador,
  Configuracoes,
  Lancamento,
  Matricula,
  ModuloSistema,
  Ocupacao,
  Repasse,
  TipoLancamento,
} from "../tipos";
import { duracaoEmMinutos } from "./agenda";
import { congelamentoVigente } from "./alunos";
import { ErroDeRegra } from "./comum";

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

// ---------------------------------------------------------------------------
// Categorias, datas e valores
// ---------------------------------------------------------------------------

export const CATEGORIAS_A_RECEBER: CategoriaLancamento[] = [
  "Mensalidade",
  "Aula avulsa",
  "Locação",
  "Consumo",
  "Torneio",
  "Outros",
];

export const CATEGORIAS_A_PAGAR: CategoriaLancamento[] = [
  "Despesa",
  "Fornecedor",
  "Repasse",
  "Outros",
];

export function categoriasDoTipo(tipo: TipoLancamento): CategoriaLancamento[] {
  return tipo === "receber" ? CATEGORIAS_A_RECEBER : CATEGORIAS_A_PAGAR;
}

/** Data "YYYY-MM-DD" que existe no calendario (recusa 31/02, texto solto...). */
export function dataValida(data: string | undefined): data is string {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split("-").map(Number);
  const convertida = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    convertida.getUTCFullYear() === ano &&
    convertida.getUTCMonth() === mes - 1 &&
    convertida.getUTCDate() === dia
  );
}

/** Mes de referencia "YYYY-MM" valido. */
export function competenciaValida(competencia: string | undefined): competencia is string {
  return Boolean(competencia && /^\d{4}-(0[1-9]|1[0-2])$/.test(competencia));
}

/** "2026-10" -> "outubro de 2026" (usado nas mensagens e nas telas). */
export function nomeDoMes(competencia: string): string {
  return formatarMesAno(`${competencia}-01`);
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10" -> "out/2026" (usado no texto das mensalidades e dos repasses). */
export function mesCurto(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES_CURTOS[mes - 1]}/${ano}`;
}

/**
 * Mes "YYYY-MM" somado de `meses` (negativo volta). Parte sempre do dia 1:
 * somar um mes a 31/10 daria 01/12 e pularia novembro.
 */
export function somarMesesNaCompetencia(competencia: string, meses: number): string {
  return somarMeses(`${competencia}-01`, meses).slice(0, 7);
}

/** O mes ja terminou? ("2026-09" com hoje em outubro: sim.) */
export function mesTerminado(competencia: string, hoje: string): boolean {
  return competencia < hoje.slice(0, 7);
}

/** Valor com centavos exatos (evita 0,1 + 0,2 = 0,30000000000000004). */
export function emReais(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// ---------------------------------------------------------------------------
// Quem pode mexer em cada tipo (Hipotese H9)
// ---------------------------------------------------------------------------

/** Modulo de permissao de cada tipo: a recepcao ve so as contas a receber. */
export function moduloDoTipo(tipo: TipoLancamento): ModuloSistema {
  return tipo === "receber" ? "financeiro" : "financeiro_pagar";
}

/**
 * Recusa a operacao se o perfil nao enxerga aquele tipo de lancamento
 * (permissoes editaveis nas Configuracoes). No banco real: politica de
 * acesso (RLS) da tabela `lancamentos`.
 */
export function garantirAcessoAoFinanceiro(
  configuracoes: Configuracoes,
  usuario: Pick<Colaborador, "perfil">,
  tipo: TipoLancamento,
): void {
  const modulos = configuracoes.permissoes[usuario.perfil] ?? [];
  if (modulos.includes(moduloDoTipo(tipo))) return;
  throw new ErroDeRegra(
    tipo === "receber"
      ? "Seu perfil não tem acesso ao financeiro."
      : "Seu perfil não tem acesso às contas a pagar.",
  );
}

// ---------------------------------------------------------------------------
// Reserva ligada ao lancamento (convencao com a agenda, Hipotese H5)
// ---------------------------------------------------------------------------

/**
 * Reserva que ainda espera o pagamento deste lancamento. Pagar o lancamento
 * confirma a reserva; anular nao pode deixar a reserva sem cobranca.
 */
export function reservaAguardandoPagamento(
  banco: Banco,
  lancamento: Lancamento,
): Ocupacao | undefined {
  if (!lancamento.ocupacaoId) return undefined;
  const ocupacao = banco.ocupacoes.find((o) => o.id === lancamento.ocupacaoId);
  return ocupacao?.situacao === "aguardando_pagamento" ? ocupacao : undefined;
}

// ---------------------------------------------------------------------------
// Mensalidades do mes
// ---------------------------------------------------------------------------

/** Vencimento no mes, respeitando o ultimo dia (fevereiro nao tem dia 30). */
function vencimentoNoMes(competencia: string, dia: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const diaCerto = Math.min(Math.max(dia, 1), ultimoDia);
  return `${competencia}-${String(diaCerto).padStart(2, "0")}`;
}

export interface MensalidadeAGerar {
  matricula: Matricula;
  vencimento: string;
  valor: number;
  /** Quem pagou a ultima mensalidade desta matricula (pai, empresa...), se houver. */
  nomePagante?: string;
  /** H4: matricula congelada no vencimento. A cobranca sai igual; a tela sinaliza. */
  congelada: boolean;
}

export interface PlanoDeMensalidades {
  competencia: string;
  novas: MensalidadeAGerar[];
  /** Matriculas vigentes que ja tem a mensalidade do mes (mesmo anulada). */
  jaGeradas: number;
}

/**
 * Mensalidades que faltam no mes: uma por matricula vigente na data de
 * vencimento, se ainda nao houver mensalidade daquela matricula naquele mes.
 * A anulada conta como existente: anular foi decisao da recepcao e gerar de
 * novo nao deve desfaze-la. Por isso gerar pode rodar quantas vezes for
 * preciso sem duplicar. No banco real: funcao agendada e indice unico em
 * (matricula_id, competencia) para mensalidades.
 */
export function mensalidadesAGerar(banco: Banco, competencia: string): PlanoDeMensalidades {
  const jaExistem = new Set<string>();
  const ultimaPorMatricula = new Map<string, Lancamento>();
  banco.lancamentos.forEach((l) => {
    if (l.categoria !== "Mensalidade" || !l.matriculaId) return;
    if (l.competencia === competencia) jaExistem.add(l.matriculaId);
    const ultima = ultimaPorMatricula.get(l.matriculaId);
    if (!ultima || l.vencimento > ultima.vencimento) ultimaPorMatricula.set(l.matriculaId, l);
  });

  const novas: MensalidadeAGerar[] = [];
  let jaGeradas = 0;
  banco.matriculas.forEach((matricula) => {
    const vencimento = vencimentoNoMes(competencia, matricula.diaVencimento);
    const vigente =
      matricula.inicio <= vencimento && (!matricula.fim || matricula.fim >= vencimento);
    if (!vigente) return;
    if (jaExistem.has(matricula.id)) {
      jaGeradas += 1;
      return;
    }
    novas.push({
      matricula,
      vencimento,
      valor: matricula.valorMensal,
      nomePagante: ultimaPorMatricula.get(matricula.id)?.nomePagante,
      congelada: Boolean(congelamentoVigente(banco.congelamentos, matricula.id, vencimento)),
    });
  });

  return { competencia, novas, jaGeradas };
}

// ---------------------------------------------------------------------------
// Repasse fechado e ja lancado
// ---------------------------------------------------------------------------

export function repasseFechado(
  banco: Banco,
  professorId: string,
  competencia: string,
): Repasse | undefined {
  return banco.repasses.find(
    (r) => r.professorId === professorId && r.competencia === competencia,
  );
}

/**
 * Quanto ja foi lancado de repasse para o professor no mes (pago ou nao, sem
 * os anulados): adiantamentos lancados a mao. O fechamento lanca so o que
 * falta, para nao pagar duas vezes.
 */
export function repasseJaLancado(banco: Banco, professorId: string, competencia: string): number {
  return emReais(
    banco.lancamentos
      .filter(
        (l) =>
          l.categoria === "Repasse" &&
          l.pessoaId === professorId &&
          l.competencia === competencia &&
          !l.canceladoEm,
      )
      .reduce((soma, l) => soma + l.valor, 0),
  );
}

/**
 * Helpers de data.
 *
 * Todas as datas do MVP sao resolvidas no fuso da arena (America/Sao_Paulo),
 * independentemente do fuso da maquina que roda o app. Isso mantem o valor de
 * "hoje" identico no servidor e no cliente e evita divergencia de hidratacao.
 */

export const TIMEZONE_ARENA = "America/Sao_Paulo";

export const DIAS_SEMANA_CURTO = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
];

export const DIAS_SEMANA_LONGO = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Ordem de exibicao da grade semanal: segunda -> domingo. */
export const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];

/** Data de hoje na arena, no formato YYYY-MM-DD. */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_ARENA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Data e hora atuais na arena, no formato YYYY-MM-DDTHH:mm:ss. */
export function agoraArena(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_ARENA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${valor("year")}-${valor("month")}-${valor("day")}T${valor("hour")}:${valor("minute")}:${valor("second")}`;
}

/** Converte "YYYY-MM-DD" em Date ancorado ao meio-dia UTC (imune a DST). */
export function paraData(iso: string): Date {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
}

export function paraISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function somarDias(iso: string, dias: number): string {
  const d = paraData(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraISO(d);
}

/**
 * Soma meses mantendo o dia; quando o dia nao existe no mes de destino, cai
 * no ultimo dia dele (31/01 + 1 mes = 28/02, e nao 03/03).
 */
export function somarMeses(iso: string, meses: number): string {
  const d = paraData(iso);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimoDia = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimoDia));
  return paraISO(d);
}

/** 0 = domingo ... 6 = sabado. */
export function diaDaSemana(iso: string): number {
  return paraData(iso).getUTCDay();
}

/** Segunda-feira da semana a que a data pertence. */
export function inicioDaSemana(iso: string): string {
  const dow = diaDaSemana(iso);
  const offset = dow === 0 ? -6 : 1 - dow;
  return somarDias(iso, offset);
}

/** Datas (seg -> dom) da semana a que a data pertence. */
export function datasDaSemana(iso: string): string[] {
  const segunda = inicioDaSemana(iso);
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
}

/** "12/09" */
export function formatarDiaMes(iso: string): string {
  const d = paraData(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(
    d.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

/** "12/09/2026" */
export function formatarData(iso: string): string {
  const d = paraData(iso);
  return `${formatarDiaMes(iso)}/${d.getUTCFullYear()}`;
}

/** "2026-09-10T14:32:05" -> "10/09/2026 · 14:32" */
export function formatarDataHora(carimbo: string): string {
  const [data, hora] = carimbo.split("T");
  return `${formatarData(data)}${hora ? ` · ${hora.slice(0, 5)}` : ""}`;
}

/** "12 de setembro de 2026" */
export function formatarDataExtenso(iso: string): string {
  const d = paraData(iso);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** "setembro de 2026" */
export function formatarMesAno(iso: string): string {
  const d = paraData(iso);
  return `${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** Grade de 6 semanas (42 dias) que cobre o mes da data informada. */
export function gradeDoMes(iso: string): string[] {
  const d = paraData(iso);
  const primeiroDia = paraISO(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12)),
  );
  const inicio = inicioDaSemana(primeiroDia);
  return Array.from({ length: 42 }, (_, i) => somarDias(inicio, i));
}

export function mesmoMes(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** "07:00" -> 420 */
export function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function minutosParaHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Diferenca em dias (b - a). */
export function diferencaEmDias(a: string, b: string): number {
  return Math.round(
    (paraData(b).getTime() - paraData(a).getTime()) / 86_400_000,
  );
}

/** Hora atual (0-23) no fuso da arena. */
export function horaAtualArena(): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE_ARENA,
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
}

export function saudacao(): string {
  const hora = horaAtualArena();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

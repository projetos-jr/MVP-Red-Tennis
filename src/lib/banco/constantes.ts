import { hojeISO } from "../date";
import type { QuadraId } from "./tipos";

/** Data de referencia da demonstracao (fuso da arena). */
export const HOJE = hojeISO();

export const HORA_ABERTURA = 7;
export const HORA_FECHAMENTO = 22;

/** Faixas horarias da grade da agenda: 07:00 ... 21:00 (ultima aula termina 22:00). */
export const FAIXAS_HORARIAS: string[] = Array.from(
  { length: HORA_FECHAMENTO - HORA_ABERTURA },
  (_, i) => `${String(HORA_ABERTURA + i).padStart(2, "0")}:00`,
);

export const IDS_QUADRAS: QuadraId[] = ["1", "2", "3", "4", "paredao"];

/** Quantas semanas de historico os dados de exemplo cobrem. */
export const SEMANAS_DE_HISTORICO = 14;

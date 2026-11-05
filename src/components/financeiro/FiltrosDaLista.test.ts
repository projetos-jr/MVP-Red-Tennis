import { describe, expect, it } from "vitest";
import { filtroDoIndicador } from "@/lib/consultas/financeiro";
import {
  FILTROS_INICIAIS,
  contarFiltrosAtivos,
  descreverFiltrosAtivos,
  filtrosDoIndicador,
} from "./FiltrosDaLista";

/**
 * Os filtros da lista ficam guardados em "Mais filtros"; o botão mostra
 * quantos estão ligados e, com o painel fechado, a tela escreve quais são.
 */
describe("filtros guardados em Mais filtros", () => {
  it("sem filtro ligado: contagem zero e nada escrito (a busca fica à vista e não conta)", () => {
    const filtros = { ...FILTROS_INICIAIS, busca: "guilherme" };
    expect(contarFiltrosAtivos(filtros)).toBe(0);
    expect(descreverFiltrosAtivos(filtros, "2026-11")).toEqual([]);
  });

  it("cartão Em atraso: dois filtros ligados, escritos em palavras", () => {
    const filtros = filtrosDoIndicador(filtroDoIndicador("emAtraso", "2026-11"), "vencimento_desc");
    expect(contarFiltrosAtivos(filtros)).toBe(2);
    expect(descreverFiltrosAtivos(filtros, "2026-11")).toEqual(["Em atraso", "Todos os meses"]);
  });

  it("todos os filtros ligados", () => {
    const filtros = {
      ...FILTROS_INICIAIS,
      situacao: "pago" as const,
      categoria: "Mensalidade" as const,
      forma: "sem_forma",
      periodo: "ate" as const,
    };
    expect(contarFiltrosAtivos(filtros)).toBe(4);
    expect(descreverFiltrosAtivos(filtros, "2026-11")).toEqual([
      "Pagos",
      "Mensalidade",
      "Forma não informada",
      "Até novembro",
    ]);
  });
});

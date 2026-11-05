/**
 * Grade da agenda: linhas de 30 minutos, colunas da Diaria e da semana,
 * posicoes com precisao de minuto, linha do agora e o que pode ser marcado.
 */

import { describe, expect, it } from "vitest";
import type { Ocupacao, Professor, Quadra } from "@/lib/banco/tipos";
import type { ItemAgenda } from "@/lib/consultas/agenda";
import {
  MEIAS_HORAS,
  PASSO,
  PX_POR_MINUTO,
  alturaDaGrade,
  canceladasPorChuva,
  celulasDoDia,
  colunasDaDiaria,
  colunasDaSemana,
  colunasDosProfessores,
  densidadeDoBloco,
  fimLivre,
  fimSugerido,
  itensDaColuna,
  linhasDoBloco,
  minutoDoAgora,
  minutosPassados,
  podeMarcarEm,
  posicaoHorizontal,
  posicaoVertical,
  subcolunas,
} from "./grade";

const QUADRAS: Quadra[] = [
  { id: "1", nome: "Quadra 1", piso: "cimento", ordem: 1 },
  { id: "2", nome: "Quadra 2", piso: "saibro", ordem: 2 },
  { id: "3", nome: "Quadra 3", piso: "saibro", ordem: 3 },
  { id: "4", nome: "Quadra 4", piso: "saibro", ordem: 4 },
  { id: "paredao", nome: "Paredão", piso: "saibro", ordem: 5 },
];

const PROFESSOR = { id: "prof-2", nome: "Renata Coelho" } as Professor;

let proximoId = 0;
function item(
  dados: Partial<Ocupacao> & Pick<Ocupacao, "horaInicio" | "horaFim">,
  cancelada = false,
): ItemAgenda {
  proximoId += 1;
  return {
    ocupacao: {
      id: `oc-${proximoId}`,
      quadraId: "1",
      data: "2026-11-04",
      tipo: "Individual",
      situacao: cancelada ? "cancelada" : "agendada",
      criadoEm: "2026-11-01T10:00:00",
      ...dados,
    } as Ocupacao,
    participantes: [],
    reposicao: false,
    cancelada,
  };
}

describe("linhas e medidas", () => {
  it("tem 30 meias horas, das 07:00 as 21:30", () => {
    expect(PASSO).toBe(30);
    expect(MEIAS_HORAS).toHaveLength(30);
    expect(MEIAS_HORAS[0]).toBe("07:00");
    expect(MEIAS_HORAS[1]).toBe("07:30");
    expect(MEIAS_HORAS.at(-1)).toBe("21:30");
  });

  it("no toque, cada meia hora tem pelo menos 44px; com mouse, 51px (agenda maior)", () => {
    expect(PASSO * PX_POR_MINUTO.toque).toBeGreaterThanOrEqual(44);
    expect(PASSO * PX_POR_MINUTO.mouse).toBeCloseTo(51);
    expect(alturaDaGrade(PX_POR_MINUTO.mouse)).toBeCloseTo(15 * 60 * 1.7);
  });

  it("um horario de 1 h cabe hora, 2 linhas de nomes e o professor (3 linhas no toque)", () => {
    const umaHora = (px: number) => posicaoVertical({ horaInicio: "08:00", horaFim: "09:00" }, px).height;
    expect(linhasDoBloco(umaHora(PX_POR_MINUTO.mouse), true)).toEqual({ nomes: 2, professor: true });
    expect(linhasDoBloco(umaHora(PX_POR_MINUTO.toque), true)).toEqual({ nomes: 3, professor: true });
  });
});

describe("colunas", () => {
  it("Diaria: 2 dias x 5 quadras, cada dia um grupo", () => {
    const grupos = colunasDaDiaria(["2026-11-04", "2026-11-05"], QUADRAS);
    expect(grupos).toHaveLength(2);
    expect(grupos.map((g) => g.tipo)).toEqual(["dia", "dia"]);
    expect(grupos.flatMap((g) => g.colunas)).toHaveLength(10);
    expect(grupos[1].colunas[0]).toMatchObject({ chave: "2026-11-05|1", data: "2026-11-05" });
    expect(grupos[0].colunas.map((c) => c.quadra?.nome)).toEqual([
      "Quadra 1",
      "Quadra 2",
      "Quadra 3",
      "Quadra 4",
      "Paredão",
    ]);
  });

  const semana = ["02", "03", "04", "05", "06", "07", "08"].map((d) => `2026-11-${d}`);

  it("Quadra: um grupo (a quadra) com 7 dias", () => {
    const [grupo, ...resto] = colunasDaSemana(semana, { quadra: QUADRAS[1] });
    expect(resto).toHaveLength(0);
    expect(grupo.tipo).toBe("quadra");
    expect(grupo.colunas).toHaveLength(7);
    expect(grupo.colunas.every((c) => c.quadra?.id === "2")).toBe(true);
  });

  it("Professor: um grupo (o professor) com 7 dias", () => {
    const [grupo] = colunasDaSemana(semana, { professor: PROFESSOR });
    expect(grupo.tipo).toBe("professor");
    expect(grupo.colunas.map((c) => c.professorId)).toEqual(Array(7).fill("prof-2"));
    expect(grupo.colunas[0].quadra).toBeUndefined();
  });

  it("Professores: 2 dias x os professores, cada dia um grupo (Hipotese H20)", () => {
    const outro = { id: "prof-1", nome: "Alexandre Pires" } as Professor;
    const grupos = colunasDosProfessores(["2026-11-04", "2026-11-05"], [outro, PROFESSOR]);
    expect(grupos.map((g) => g.tipo)).toEqual(["dia", "dia"]);
    expect(grupos.flatMap((g) => g.colunas)).toHaveLength(4);
    expect(grupos[1].colunas[1]).toMatchObject({
      chave: "2026-11-05|prof-2",
      data: "2026-11-05",
      professorId: "prof-2",
      professor: PROFESSOR,
    });
    expect(grupos[0].colunas[0].quadra).toBeUndefined();
  });

  it("cada coluna recebe os horarios da sua quadra ou do seu professor", () => {
    const doDia = [
      item({ horaInicio: "08:00", horaFim: "09:00", quadraId: "1", professorId: "prof-2" }),
      item({ horaInicio: "08:00", horaFim: "09:00", quadraId: "2", professorId: "prof-1" }),
      item({ horaInicio: "10:00", horaFim: "11:00", quadraId: "3", professorId: "prof-2" }),
    ];
    const [diaria] = colunasDaDiaria(["2026-11-04"], QUADRAS);
    expect(itensDaColuna(diaria.colunas[1], doDia)).toEqual([doDia[1]]);
    const [prof] = colunasDaSemana(["2026-11-04"], { professor: PROFESSOR });
    expect(itensDaColuna(prof.colunas[0], doDia)).toEqual([doDia[0], doDia[2]]);
    const [professores] = colunasDosProfessores(["2026-11-04"], [PROFESSOR]);
    expect(itensDaColuna(professores.colunas[0], doDia)).toEqual([doDia[0], doDia[2]]);
  });
});

describe("posicoes", () => {
  it("posiciona com precisao de minuto", () => {
    expect(posicaoVertical({ horaInicio: "07:00", horaFim: "08:00" }, 1.2)).toEqual({
      top: 1,
      height: 71,
    });
    expect(posicaoVertical({ horaInicio: "07:30", horaFim: "08:00" }, 1.5)).toEqual({
      top: 46,
      height: 44,
    });
    const quebrado = posicaoVertical({ horaInicio: "10:15", horaFim: "11:05" }, 1.2);
    expect(quebrado.top).toBeCloseTo((3 * 60 + 15) * 1.2 + 1);
    expect(quebrado.height).toBeCloseTo(50 * 1.2 - 1);
  });

  it("nunca sai da grade e nunca fica menor que uma linha", () => {
    expect(posicaoVertical({ horaInicio: "06:00", horaFim: "07:30" }, 1.2).top).toBe(1);
    expect(posicaoVertical({ horaInicio: "21:50", horaFim: "22:00" }, 1.2).height).toBe(24);
  });

  it("divide a largura entre horarios sobrepostos", () => {
    expect(posicaoHorizontal({ coluna: 0, total: 1 })).toEqual({
      left: "calc(0% + 2px)",
      width: "calc(100% - 4px)",
    });
    expect(posicaoHorizontal({ coluna: 1, total: 2 }).left).toBe("calc(50% + 2px)");
  });

  it("densidade pela altura do bloco", () => {
    expect(densidadeDoBloco(24)).toBe("minima"); // 15 minutos
    expect(densidadeDoBloco(50)).toBe("compacta"); // meia hora com mouse
    expect(densidadeDoBloco(53)).toBe("compacta"); // meia hora no toque
    expect(densidadeDoBloco(75.5)).toBe("normal"); // 45 minutos com mouse
    expect(densidadeDoBloco(101)).toBe("ampla"); // 1 hora com mouse
    expect(densidadeDoBloco(107)).toBe("ampla"); // 1 hora no toque
  });

  it("linhas de nomes e professor que cabem no bloco", () => {
    expect(linhasDoBloco(50, true)).toEqual({ nomes: 1, professor: false });
    expect(linhasDoBloco(53, true)).toEqual({ nomes: 1, professor: false });
    expect(linhasDoBloco(75.5, true)).toEqual({ nomes: 1, professor: true });
    expect(linhasDoBloco(75.5, false)).toEqual({ nomes: 2, professor: false });
    expect(linhasDoBloco(101, true)).toEqual({ nomes: 2, professor: true });
    expect(linhasDoBloco(101, false)).toEqual({ nomes: 3, professor: false });
    expect(linhasDoBloco(107, true)).toEqual({ nomes: 3, professor: true });
    expect(linhasDoBloco(24, true).nomes).toBe(0);
  });

  it("aula cancelada fica ao lado da que ocupou o lugar dela", () => {
    const cancelada = item({ horaInicio: "08:00", horaFim: "09:00" }, true);
    const nova = item({ horaInicio: "08:00", horaFim: "09:00" });
    const depois = item({ horaInicio: "09:00", horaFim: "10:00" });
    const posicoes = subcolunas([cancelada, nova, depois]);
    expect(posicoes.get(nova.ocupacao.id)).toEqual({ coluna: 0, total: 2 });
    expect(posicoes.get(cancelada.ocupacao.id)).toEqual({ coluna: 1, total: 2 });
    expect(posicoes.get(depois.ocupacao.id)).toEqual({ coluna: 0, total: 1 });
  });

  it("cancelada sozinha deixa meia coluna livre (para marcar no lugar) quando se pode marcar", () => {
    const cancelada = item({ horaInicio: "08:00", horaFim: "09:00" }, true);
    const outra = item({ horaInicio: "08:30", horaFim: "09:30" }, true);
    const ativa = item({ horaInicio: "11:00", horaFim: "12:00" });
    const comVaga = subcolunas([cancelada, outra, ativa], { vagaAoLadoDasCanceladas: true });
    expect(comVaga.get(cancelada.ocupacao.id)).toEqual({ coluna: 0, total: 3 });
    expect(comVaga.get(outra.ocupacao.id)).toEqual({ coluna: 1, total: 3 });
    // Horario ativo nao ganha vaga (a quadra esta ocupada).
    expect(comVaga.get(ativa.ocupacao.id)).toEqual({ coluna: 0, total: 1 });
    // Sem poder marcar (professor), a cancelada ocupa a largura toda.
    expect(subcolunas([cancelada]).get(cancelada.ocupacao.id)).toEqual({ coluna: 0, total: 1 });
  });
});

describe("agora e passado", () => {
  it("linha do agora so no dia de hoje e dentro do funcionamento", () => {
    expect(minutoDoAgora("2026-11-04T10:42:00", "2026-11-04")).toBe(10 * 60 + 42);
    expect(minutoDoAgora("2026-11-04T10:42:00", "2026-11-05")).toBeUndefined();
    expect(minutoDoAgora("2026-11-04T06:10:00", "2026-11-04")).toBeUndefined();
    expect(minutoDoAgora("2026-11-04T23:00:00", "2026-11-04")).toBeUndefined();
  });

  it("pelicula do passado por coluna", () => {
    const agora = "2026-11-04T10:30:00";
    expect(minutosPassados("2026-11-03", agora)).toBe(900);
    expect(minutosPassados("2026-11-04", agora)).toBe(210);
    expect(minutosPassados("2026-11-05", agora)).toBe(0);
    expect(minutosPassados("2026-11-04", "2026-11-04T05:00:00")).toBe(0);
    expect(minutosPassados("2026-11-04", "2026-11-04T23:00:00")).toBe(900);
  });
});

describe("o que pode ser marcado", () => {
  const coluna = { data: "2026-11-04" };
  const itens = [
    item({ horaInicio: "08:00", horaFim: "09:00" }),
    item({ horaInicio: "10:00", horaFim: "11:00" }, true),
    item({ horaInicio: "12:15", horaFim: "12:45" }),
  ];

  it("meia hora livre pode; ocupada nao; cancelada nao ocupa", () => {
    expect(podeMarcarEm(coluna, "07:30", itens, "2026-11-04")).toBe(true);
    expect(podeMarcarEm(coluna, "08:00", itens, "2026-11-04")).toBe(false);
    expect(podeMarcarEm(coluna, "08:30", itens, "2026-11-04")).toBe(false);
    expect(podeMarcarEm(coluna, "09:00", itens, "2026-11-04")).toBe(true);
    expect(podeMarcarEm(coluna, "10:00", itens, "2026-11-04")).toBe(true);
    // Ocupacao fora do passo de 30 min tambem tira as meias horas que ela toca.
    expect(podeMarcarEm(coluna, "12:00", itens, "2026-11-04")).toBe(false);
    expect(podeMarcarEm(coluna, "12:30", itens, "2026-11-04")).toBe(false);
    expect(podeMarcarEm(coluna, "13:00", itens, "2026-11-04")).toBe(true);
  });

  it("antes de hoje nao (o passado fica como historico); fora do funcionamento nao", () => {
    expect(podeMarcarEm({ data: "2026-11-03" }, "07:30", [], "2026-11-04")).toBe(false);
    expect(podeMarcarEm({ data: "2026-11-05" }, "21:30", [], "2026-11-04")).toBe(true);
    expect(podeMarcarEm({ data: "2026-11-05" }, "22:00", [], "2026-11-04")).toBe(false);
  });

  it("fim ao clicar: para no proximo horario ativo, minimo 30 min, ate as 22h", () => {
    expect(fimLivre("07:30", itens)).toBe("08:00");
    expect(fimLivre("07:00", itens)).toBe("08:00");
    expect(fimLivre("09:00", itens)).toBe("10:00");
    // A cancelada das 10:00 nao segura o fim.
    expect(fimLivre("09:30", itens)).toBe("10:30");
    expect(fimLivre("11:30", itens)).toBe("12:15");
    expect(fimLivre("21:30", [])).toBe("22:00");
  });

  it("fim sugerido: 1 hora depois, ate as 22h", () => {
    expect(fimSugerido("07:30")).toBe("08:30");
    expect(fimSugerido("21:30")).toBe("22:00");
  });
});

describe("lista do celular", () => {
  it("distribui nas faixas de 1 h e conta a chuva", () => {
    const longo = item({ horaInicio: "08:30", horaFim: "10:00" });
    const chuva = item({ horaInicio: "09:00", horaFim: "10:00", motivoCancelamento: "CH" }, true);
    const celulas = celulasDoDia([longo, chuva]);
    expect(celulas.get("08:00")?.comecam).toEqual([longo]);
    expect(celulas.get("09:00")?.continuam).toEqual([longo]);
    expect(celulas.get("09:00")?.comecam).toEqual([chuva]);
    expect(canceladasPorChuva([longo, chuva])).toBe(1);
  });
});

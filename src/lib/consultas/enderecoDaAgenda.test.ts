/**
 * Endereco da agenda: os links antigos (Inicio, ficha do professor, busca,
 * impressao) continuam abrindo a tela certa, e o endereco que a tela grava
 * le de volta o mesmo estado.
 */

import { describe, expect, it } from "vitest";
import { gerarBancoInicial } from "../banco/semente";
import {
  enderecoDaAgenda,
  estadoDaAgendaPelaUrl,
  trocarVisao,
  type ContextoDaAgenda,
  type EstadoDaAgenda,
} from "./enderecoDaAgenda";

const banco = gerarBancoInicial();
const HOJE = "2026-11-04";
const ctx: ContextoDaAgenda = { hoje: HOJE };
const professora: ContextoDaAgenda = { hoje: HOJE, professorTravado: "prof-2" };

function ler(consulta: string, contexto: ContextoDaAgenda = ctx): EstadoDaAgenda {
  return estadoDaAgendaPelaUrl(banco, new URLSearchParams(consulta), contexto);
}

const ocupacao = banco.ocupacoes.find((o) => o.data !== HOJE)!;

describe("links aceitos pela agenda", () => {
  it.each<[string, Partial<EstadoDaAgenda>]>([
    ["", { visao: "diaria", data: HOJE, quadraId: undefined, professorId: undefined }],
    ["visao=dia&data=2026-11-10", { visao: "diaria", data: "2026-11-10" }],
    ["visao=diaria", { visao: "diaria", data: HOJE }],
    ["visao=semana&quadra=3", { visao: "quadra", quadraId: "3" }],
    ["visao=semana", { visao: "quadra", quadraId: "1" }],
    ["visao=semana&professor=prof-3", { visao: "professor", professorId: "prof-3" }],
    ["quadra=paredao", { visao: "quadra", quadraId: "paredao", data: HOJE }],
    ["visao=quadra", { visao: "quadra", quadraId: "1" }],
    // Link do Inicio ("Precisa de atencao"): o dia com a coluna da quadra realcada.
    ["data=2026-11-06&quadra=2", { visao: "diaria", data: "2026-11-06", quadraId: "2" }],
    // Ficha do professor: pelo id ou, como no MVP, pelo nome.
    ["professor=prof-1", { visao: "professor", professorId: "prof-1" }],
    ["professor=Renata%20Coelho", { visao: "professor", professorId: "prof-2" }],
    ["professor=renata coelho", { visao: "professor", professorId: "prof-2" }],
    ["visao=professor", { visao: "professor", professorId: "prof-1" }],
    // Mosaico do Inicio: LAP abre a Diaria filtrada.
    ["tipo=LAP", { visao: "diaria", tipo: "LAP" }],
    ["tipo=locacao%20avulsa", { visao: "diaria", tipo: "Locação Avulsa" }],
    ["visao=mes&data=2026-12-01", { visao: "mes", data: "2026-12-01", quadraId: undefined }],
    ["canceladas=nao", { mostrarCanceladas: false }],
    ["", { mostrarCanceladas: true, tipo: "todos" }],
  ])("?%s", (consulta, esperado) => {
    expect(ler(consulta)).toMatchObject(esperado);
  });

  it("?ocupacao= abre o painel na data do horario (e a data da URL vale mais)", () => {
    expect(ler(`ocupacao=${ocupacao.id}`)).toMatchObject({
      visao: "diaria",
      data: ocupacao.data,
      ocupacaoId: ocupacao.id,
    });
    expect(
      ler(`data=2026-11-10&visao=dia&ocupacao=${ocupacao.id}`),
    ).toMatchObject({ visao: "diaria", data: "2026-11-10", ocupacaoId: ocupacao.id });
  });

  it("ignora valores que nao existem", () => {
    expect(ler("visao=xyz&data=2026-13-99&quadra=9&professor=ninguem&tipo=Tenis")).toEqual({
      visao: "diaria",
      data: HOJE,
      quadraId: undefined,
      professorId: undefined,
      tipo: "todos",
      mostrarCanceladas: true,
      ocupacaoId: undefined,
    });
  });

  it("perfil de professor: abre na visao Professor e fica travado nas proprias aulas", () => {
    expect(ler("", professora)).toMatchObject({ visao: "professor", professorId: "prof-2" });
    expect(ler("professor=prof-1", professora)).toMatchObject({ professorId: "prof-2" });
    expect(ler("visao=dia", professora)).toMatchObject({ visao: "diaria", professorId: "prof-2" });
    expect(ler("visao=mes", professora)).toMatchObject({ visao: "mes", professorId: "prof-2" });
  });
});

describe("endereco gravado pela tela", () => {
  const estados: EstadoDaAgenda[] = [
    { visao: "diaria", data: HOJE, tipo: "todos", mostrarCanceladas: true },
    { visao: "diaria", data: "2026-11-12", quadraId: "2", tipo: "LAP", mostrarCanceladas: false },
    { visao: "quadra", data: "2026-11-05", quadraId: "paredao", tipo: "todos", mostrarCanceladas: true },
    { visao: "quadra", data: HOJE, quadraId: "4", professorId: "prof-3", tipo: "Individual", mostrarCanceladas: true },
    { visao: "professor", data: "2026-11-20", professorId: "prof-2", tipo: "Locação Mensal", mostrarCanceladas: true },
    { visao: "mes", data: "2026-12-01", tipo: "todos", mostrarCanceladas: true },
    { visao: "diaria", data: HOJE, tipo: "todos", mostrarCanceladas: true, ocupacaoId: ocupacao.id },
  ];

  it.each(estados)("le de volta o mesmo estado (%o)", (estado) => {
    const endereco = enderecoDaAgenda(estado, HOJE);
    expect(endereco.startsWith("/agenda?")).toBe(true);
    const lido = ler(endereco.slice("/agenda?".length));
    expect(lido).toEqual({ quadraId: undefined, professorId: undefined, ocupacaoId: undefined, ...estado });
  });

  it("so poe a data quando nao e hoje (ou com um painel aberto)", () => {
    expect(enderecoDaAgenda(estados[0], HOJE)).toBe("/agenda?visao=diaria");
    expect(enderecoDaAgenda(estados[1], HOJE)).toContain("data=2026-11-12");
    expect(enderecoDaAgenda(estados[6], HOJE)).toContain(`data=${HOJE}`);
  });
});

describe("troca de visao", () => {
  const diaria = ler("data=2026-11-06&quadra=2");

  it("da Diaria com a quadra realcada para a Quadra: leva a quadra", () => {
    expect(trocarVisao(banco, diaria, "quadra", ctx)).toMatchObject({
      visao: "quadra",
      quadraId: "2",
      data: "2026-11-06",
    });
  });

  it("da Quadra para a Diaria: tira a quadra (sem realce)", () => {
    const quadra = ler("visao=quadra&quadra=3");
    expect(trocarVisao(banco, quadra, "diaria", ctx).quadraId).toBeUndefined();
  });

  it("da Professor para a Diaria: tira o professor; para o Mes com filtro, mantem", () => {
    const professor = ler("professor=prof-3");
    expect(trocarVisao(banco, professor, "diaria", ctx).professorId).toBeUndefined();
    const filtrada = { ...ler("visao=dia"), professorId: "prof-1" };
    expect(trocarVisao(banco, filtrada, "mes", ctx).professorId).toBe("prof-1");
    expect(trocarVisao(banco, ler(""), "professor", ctx).professorId).toBe("prof-1");
  });

  it("o professor logado continua travado em qualquer visao", () => {
    const estado = ler("", professora);
    expect(trocarVisao(banco, estado, "diaria", professora).professorId).toBe("prof-2");
  });

  it("fecha o painel ao trocar de visao", () => {
    const comPainel = ler(`ocupacao=${ocupacao.id}`);
    expect(trocarVisao(banco, comPainel, "mes", ctx).ocupacaoId).toBeUndefined();
  });
});

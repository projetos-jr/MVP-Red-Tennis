/**
 * Testes do mosaico do Inicio: cada perfil ve so os atalhos das areas que
 * pode abrir (H9), cada atalho cai no modulo certo, e a grade fecha sem buraco.
 */

import { describe, expect, it } from "vitest";
import { gerarBancoInicial } from "@/lib/banco/semente";
import type { Colaborador, Perfil } from "@/lib/banco/tipos";
import { SITE_DA_ARENA } from "@/lib/branding";
import { moduloDaRota } from "./abas";
import { atalhosPermitidos, colunasDoPrimeiro, todosOsAtalhos } from "./atalhos";

const banco = gerarBancoInicial();

function colaborador(perfil: Perfil): Colaborador {
  const encontrado = banco.colaboradores.find((c) => c.perfil === perfil);
  if (!encontrado) throw new Error(`Sem colaborador com perfil ${perfil}.`);
  return encontrado;
}

const ids = (perfil: Perfil, site = "") =>
  atalhosPermitidos(banco, colaborador(perfil), site).map((a) => a.id);

const INTERNOS = [
  "diaria",
  "agenda-professores",
  "financeiro",
  "estoque",
  "historico",
  "clientes",
  "professores",
  "configuracoes",
  "ranking",
  "torneio",
  "lap",
];

describe("atalhos por perfil (H9)", () => {
  it("o endereço do site ainda não foi confirmado: a constante está vazia", () => {
    expect(SITE_DA_ARENA).toBe("");
    expect(atalhosPermitidos(banco, colaborador("dono")).map((a) => a.id)).not.toContain("site");
  });

  it("o dono vê todos os atalhos (o Site só com endereço)", () => {
    expect(ids("dono")).toEqual(INTERNOS);
    expect(ids("dono", "https://site-da-arena.exemplo")).toEqual([...INTERNOS, "site"]);
    expect(ids("dono", "   ")).toEqual(INTERNOS);
  });

  it("a recepção não vê Histórico nem Configurações", () => {
    const recepcao = ids("recepcao");
    expect(recepcao).not.toContain("historico");
    expect(recepcao).not.toContain("configuracoes");
    expect(recepcao).toEqual(INTERNOS.filter((id) => id !== "historico" && id !== "configuracoes"));
  });

  it("o professor vê Diária, Agenda Professores, Clientes e LAP", () => {
    expect(ids("professor")).toEqual(["diaria", "agenda-professores", "clientes", "lap"]);
  });

  it("acompanha a matriz de permissões editada nas Configurações", () => {
    const semEstoque = {
      ...banco,
      configuracoes: {
        ...banco.configuracoes,
        permissoes: {
          ...banco.configuracoes.permissoes,
          recepcao: banco.configuracoes.permissoes.recepcao.filter((m) => m !== "estoque"),
        },
      },
    };
    expect(atalhosPermitidos(semEstoque, colaborador("recepcao"), "").map((a) => a.id)).not.toContain(
      "estoque",
    );
  });
});

describe("destino de cada atalho", () => {
  it("cada endereço interno cai no módulo da permissão exigida", () => {
    todosOsAtalhos("")
      .filter((a) => !a.externo)
      .forEach((atalho) => {
        const caminho = new URL(atalho.href, "http://arena.local").pathname;
        expect(moduloDaRota(caminho), atalho.id).toBe(atalho.modulo);
      });
  });

  it("os atalhos da agenda abrem a visão certa", () => {
    const href = (id: string) => todosOsAtalhos("").find((a) => a.id === id)?.href;
    expect(href("diaria")).toBe("/agenda");
    expect(href("agenda-professores")).toBe("/agenda?visao=professor");
    expect(href("lap")).toBe("/agenda?tipo=LAP");
    expect(href("torneio")).toBe("/ranking?aba=torneios");
    expect(href("clientes")).toBe("/alunos");
  });

  it("o Site é o único externo e não exige permissão", () => {
    const externos = todosOsAtalhos("https://site-da-arena.exemplo").filter((a) => a.externo);
    expect(externos.map((a) => [a.id, a.href, a.modulo])).toEqual([
      ["site", "https://site-da-arena.exemplo", undefined],
    ]);
  });

  it("rótulos e ids sem repetição", () => {
    const todos = todosOsAtalhos("https://site-da-arena.exemplo");
    expect(new Set(todos.map((a) => a.id)).size).toBe(todos.length);
    expect(new Set(todos.map((a) => a.rotulo)).size).toBe(todos.length);
  });
});

describe("grade do mosaico sem buraco", () => {
  it("o primeiro atalho absorve as células que sobrariam na última linha", () => {
    for (const total of [1, 2, 4, 9, 11, 12]) {
      for (const colunas of [2, 3, 4]) {
        const largura = colunasDoPrimeiro(total, colunas);
        expect(largura).toBeGreaterThanOrEqual(1);
        expect(largura).toBeLessThanOrEqual(colunas);
        expect((total - 1 + largura) % colunas, `${total} em ${colunas}`).toBe(0);
      }
    }
  });

  it("dono (11) e recepção (9) nos três tamanhos", () => {
    expect([2, 3, 4].map((c) => colunasDoPrimeiro(11, c))).toEqual([2, 2, 2]);
    expect([2, 3, 4].map((c) => colunasDoPrimeiro(9, c))).toEqual([2, 1, 4]);
  });
});

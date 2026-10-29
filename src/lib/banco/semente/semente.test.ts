/**
 * Os dados de exemplo respeitam as mesmas regras que o banco real vai impor.
 * Se um destes testes falhar, a semente gerou algo que o banco recusaria.
 */

import { describe, expect, it } from "vitest";
import { HOJE } from "../constantes";
import { conflitosNaQuadra, ocupacaoAtiva } from "../regras/agenda";
import { saldosDeEstoque } from "../regras/estoque";
import { extratoReposicao } from "../regras/reposicao";
import { calcularRanking } from "../regras/ranking";
import { gerarBancoInicial } from "./index";

const banco = gerarBancoInicial();

describe("dados de exemplo", () => {
  it("sao sempre os mesmos (deterministicos)", () => {
    const outro = gerarBancoInicial();
    expect(outro.ocupacoes.length).toBe(banco.ocupacoes.length);
    expect(outro.lancamentos.map((l) => l.id)).toEqual(banco.lancamentos.map((l) => l.id));
  });

  it("nao tem ids repetidos em nenhuma tabela", () => {
    (Object.keys(banco) as Array<keyof typeof banco>).forEach((tabela) => {
      const lista = banco[tabela];
      if (!Array.isArray(lista)) return;
      const ids = (lista as Array<{ id: string }>).map((r) => r.id);
      expect(new Set(ids).size, `ids repetidos em ${tabela}`).toBe(ids.length);
    });
  });

  it("nao tem duas ocupacoes ativas na mesma quadra e horario", () => {
    const ativas = banco.ocupacoes.filter(ocupacaoAtiva);
    const porDia = new Map<string, typeof ativas>();
    ativas.forEach((o) => {
      const chave = `${o.quadraId}|${o.data}`;
      porDia.set(chave, [...(porDia.get(chave) ?? []), o]);
    });
    porDia.forEach((lista) => {
      lista.forEach((o) => expect(conflitosNaQuadra(lista, o)).toEqual([]));
    });
  });

  it("toda ocupacao cancelada tem motivo", () => {
    banco.ocupacoes
      .filter((o) => o.situacao === "cancelada")
      .forEach((o) => expect(o.motivoCancelamento).toBeTruthy());
  });

  it("nenhum saldo de reposicao fica negativo e todo uso cabe no saldo", () => {
    banco.alunos.forEach((aluno) => {
      const extrato = extratoReposicao(banco.reposicoes, aluno.id, HOJE);
      expect(extrato.saldo).toBeGreaterThanOrEqual(0);
      const usado = banco.reposicoes
        .filter((r) => r.alunoId === aluno.id && r.minutos < 0)
        .reduce((s, r) => s - r.minutos, 0);
      const consumido = extrato.creditos.reduce(
        (s, c) => s + (c.credito.minutos - c.restante),
        0,
      );
      expect(consumido).toBe(usado);
    });
  });

  it("o saldo de estoque bate com o que o MVP mostrava e nunca e negativo", () => {
    const saldos = saldosDeEstoque(banco.movimentosEstoque);
    expect(saldos.get("p01")).toBe(96);
    expect(saldos.get("p12")).toBe(0);
    expect(saldos.get("p22")).toBe(4);
    saldos.forEach((saldo) => expect(saldo).toBeGreaterThanOrEqual(0));
  });

  it("todo consumo tem baixa no estoque e lancamento a receber", () => {
    const vendas = new Set(banco.movimentosEstoque.map((m) => m.consumoId).filter(Boolean));
    const cobrancas = new Set(banco.lancamentos.map((l) => l.consumoId).filter(Boolean));
    banco.consumos.forEach((c) => {
      expect(vendas.has(c.id)).toBe(true);
      expect(cobrancas.has(c.id)).toBe(true);
    });
  });

  it("tem os casos que as telas precisam demonstrar", () => {
    expect(banco.ocupacoes.some((o) => o.tipo === "Bloqueio")).toBe(true);
    expect(banco.ocupacoes.some((o) => o.situacao === "aguardando_pagamento")).toBe(true);
    expect(banco.ocupacoes.some((o) => o.motivoCancelamento === "CH")).toBe(true);
    expect(banco.reposicoes.some((r) => r.minutos < 0)).toBe(true);
    expect(banco.lancamentos.some((l) => l.tipo === "pagar")).toBe(true);
    expect(banco.lancamentos.some((l) => !l.pagoEm && l.vencimento < HOJE)).toBe(true);
    expect(banco.congelamentos.some((c) => !c.fimReal)).toBe(true);
    expect(banco.matriculas.some((m) => m.fim)).toBe(true);
    expect(banco.partidas.some((p) => p.vencedor)).toBe(true);
    expect(calcularRanking(banco).length).toBe(
      banco.alunos.filter((a) => a.inscritoRanking).length,
    );
  });
});

import { describe, expect, it } from "vitest";
import { HOJE } from "../banco/constantes";
import { gerarBancoInicial } from "../banco/semente";
import {
  FILEIRAS_DA_PIRAMIDE,
  capacidadeDaFileira,
  fileirasDaPiramide,
  montarPiramide,
  rankingDaArena,
} from "./ranking";

describe("pirâmide do ranking (H19)", () => {
  it("segue o pedido do dono: 1, 3, 4 e depois uma a mais por fileira", () => {
    expect(FILEIRAS_DA_PIRAMIDE).toEqual([1, 3, 4]);
    expect([0, 1, 2, 3, 4, 5].map((i) => capacidadeDaFileira(i))).toEqual([1, 3, 4, 5, 6, 7]);
  });

  it("divide o total em fileiras; a última pode ficar incompleta", () => {
    expect(fileirasDaPiramide(0)).toEqual([]);
    expect(fileirasDaPiramide(1)).toEqual([1]);
    expect(fileirasDaPiramide(2)).toEqual([1, 1]);
    expect(fileirasDaPiramide(4)).toEqual([1, 3]);
    expect(fileirasDaPiramide(8)).toEqual([1, 3, 4]);
    expect(fileirasDaPiramide(9)).toEqual([1, 3, 4, 1]);
    expect(fileirasDaPiramide(19)).toEqual([1, 3, 4, 5, 6]);
    expect(fileirasDaPiramide(23)).toEqual([1, 3, 4, 5, 6, 4]);
    expect(fileirasDaPiramide(27)).toEqual([1, 3, 4, 5, 6, 7, 1]);
  });

  it("aceita outra regra, se a arena pedir (ex.: 2ª fileira com 2)", () => {
    expect(fileirasDaPiramide(10, [1, 2])).toEqual([1, 2, 3, 4]);
    expect(fileirasDaPiramide(7, [1, 2, 3])).toEqual([1, 2, 3, 1]);
    // Lista vazia ou inválida: 1, 2, 3... (nunca trava num laço sem fim).
    expect(fileirasDaPiramide(6, [])).toEqual([1, 2, 3]);
    expect(fileirasDaPiramide(6, [0, -2])).toEqual([1, 2, 3]);
  });

  it("monta as fileiras na ordem do ranking, sem perder nem repetir ninguém", () => {
    const banco = gerarBancoInicial();
    const linhas = rankingDaArena(banco, HOJE);
    const piramide = montarPiramide(linhas);
    expect(piramide.map((f) => f.itens.length)).toEqual(fileirasDaPiramide(linhas.length));
    expect(piramide.flatMap((f) => f.itens)).toEqual(linhas);
    expect(piramide[0].itens[0].posicao).toBe(1);
    // A fileira incompleta guarda o tamanho cheio (para as raquetes terem o mesmo tamanho).
    expect(piramide.map((f) => f.capacidade)).toEqual(
      piramide.map((_, i) => capacidadeDaFileira(i)),
    );
  });

  it("refaz com a lista filtrada por categoria (posições da categoria)", () => {
    const banco = gerarBancoInicial();
    const daB = rankingDaArena(banco, HOJE, "B");
    const piramide = montarPiramide(daB);
    expect(piramide.flatMap((f) => f.itens.map((l) => l.aluno.categoriaRanking))).toEqual(
      daB.map(() => "B"),
    );
    expect(piramide[0].itens[0].posicao).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { colunasAlteradas, diferencas } from "./gravar";

describe("gravação direta: só o que mudou", () => {
  const antes = { id: "al-1", nome: "Ana", telefone: "1199", criadoEm: "2026-11-03T10:00:00", email: "" };

  it("separa criados, alterados e apagados por id", () => {
    const alterado = { ...antes, nome: "Ana Paula" };
    const novo = { ...antes, id: "al-2" };
    const resultado = diferencas([antes, { ...antes, id: "al-3" }], [alterado, novo]);
    expect(resultado.criados.map((r) => r.id)).toEqual(["al-2"]);
    expect(resultado.alterados).toEqual([{ antes, depois: alterado }]);
    expect(resultado.apagados.map((r) => r.id)).toEqual(["al-3"]);
  });

  it("manda só as colunas alteradas (as datas iguais não são regravadas)", () => {
    expect(colunasAlteradas("alunos", antes, { ...antes, nome: "Ana Paula" })).toEqual({
      nome: "Ana Paula",
    });
  });

  it("campo opcional apagado vai como null", () => {
    const comNascimento = { ...antes, dataNascimento: "2010-05-02" };
    expect(colunasAlteradas("alunos", comNascimento, antes)).toEqual({ data_nascimento: null });
  });
});

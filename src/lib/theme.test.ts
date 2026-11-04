import { describe, expect, it } from "vitest";
import { contraste, textoLegivelSobre } from "./cores";
import { BRANCO } from "./paleta";
import { APOIO, CORES_AVATAR, ESTILO_CATEGORIA } from "./theme";

/**
 * Estilos de `theme.ts` que nao estao em `cores.test.ts`: iniciais dos
 * avatares, categorias do ranking como filtro ativo e as cores de apoio.
 */
describe("avatares", () => {
  it("as iniciais (branco ou escuro, o mais legível) passam de 4,5:1 em todas as cores", () => {
    for (const cor of CORES_AVATAR) {
      const texto = textoLegivelSobre(cor);
      expect(contraste(texto, cor), `${texto} sobre ${cor}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("nenhuma cor de avatar é vermelha (vermelho é só alerta)", () => {
    for (const cor of CORES_AVATAR) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));
      expect(r > 150 && g < 70 && b < 70, cor).toBe(false);
    }
  });
});

describe("categorias do ranking", () => {
  it("filtro ativo: texto branco sobre a cor da categoria", () => {
    for (const c of Object.values(ESTILO_CATEGORIA)) {
      expect(contraste(BRANCO, c.cor), c.label).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("cores de apoio", () => {
  it("texto sobre o fundo claro de cada cor de apoio", () => {
    for (const cor of [APOIO.ambar, APOIO.ceu, APOIO.violeta]) {
      expect(contraste(cor.texto, cor.fundo)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

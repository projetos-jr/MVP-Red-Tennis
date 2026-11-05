import coresDoTailwind from "tailwindcss/colors";
import { describe, expect, it } from "vitest";
import { TONS } from "@/components/ui/EtiquetaDeSituacao";
import { contraste, misturar, textoLegivelSobre } from "./cores";
import { BRANCO, LADRILHO, PALETA, TINTA } from "./paleta";
import {
  CORES_AVATAR,
  ESTILO_CATEGORIA,
  ESTILO_CATEGORIA_PRODUTO,
  ESTILO_MOVIMENTO,
  ESTILO_NIVEL_ESTOQUE,
  ESTILO_OCUPACAO,
  estiloDaSigla,
} from "./theme";

/**
 * Cores vivas sem perder a leitura: todo texto pequeno precisa de 4,5:1 de
 * contraste com o fundo (WCAG AA); texto grande e negrito (≥ 18,66px) e
 * elementos que não são texto (anel de foco), de 3:1.
 */
const TEXTO = 4.5;
const GRANDE = 3;

function esperarContraste(texto: string, fundo: string, minimo = TEXTO) {
  const razao = contraste(texto, fundo);
  expect(razao, `${texto} sobre ${fundo} = ${razao.toFixed(2)}:1 (mínimo ${minimo})`).toBeGreaterThanOrEqual(minimo);
}

describe("contas de cor", () => {
  it("contraste conhecido: preto e branco = 21, igual = 1", () => {
    expect(contraste("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contraste("#C8460B", "#C8460B")).toBeCloseTo(1, 5);
  });

  it("escolhe o texto mais legível (branco no escuro, tinta no claro)", () => {
    expect(textoLegivelSobre(PALETA.saibro[700])).toBe(BRANCO);
    expect(textoLegivelSobre(PALETA.bola[300])).toBe(TINTA);
  });

  it("mistura duas cores", () => {
    expect(misturar("#000000", "#FFFFFF", 0.5)).toBe("rgb(128, 128, 128)");
  });
});

describe("tokens da paleta", () => {
  it("texto branco sobre as cores de ação (600+ e verde 700+)", () => {
    for (const fundo of [
      PALETA.saibro[600],
      PALETA.saibro[700],
      PALETA.tijolo[600],
      PALETA.tijolo[700],
      PALETA.cimento[600],
      PALETA.cimento[700],
      PALETA.quadra[700],
      PALETA.quadra[800],
    ]) {
      esperarContraste(BRANCO, fundo);
    }
  });

  it("textos de apoio e links sobre os fundos claros", () => {
    for (const fundo of [BRANCO, PALETA.areia[50], PALETA.areia[100]]) {
      esperarContraste(PALETA.areia[500], fundo);
      esperarContraste(PALETA.saibro[700], fundo);
      esperarContraste(PALETA.tijolo[700], fundo);
      esperarContraste(PALETA.quadra[700], fundo);
    }
    esperarContraste(PALETA.saibro[700], PALETA.saibro[50]);
    esperarContraste(PALETA.saibro[800], PALETA.saibro[100]);
  });

  it("tinta escura sobre a bola e os claros vivos", () => {
    for (const fundo of [PALETA.bola[300], PALETA.bola[200], PALETA.quadra[200], PALETA.cimento[100]]) {
      esperarContraste(TINTA, fundo);
    }
  });

  it("rótulo branco e grande do mosaico sobre o laranja com textura", () => {
    esperarContraste(BRANCO, LADRILHO.topo, GRANDE);
    esperarContraste(BRANCO, LADRILHO.referencia, GRANDE);
    esperarContraste(BRANCO, LADRILHO.base);
  });

  it("placa de atenção: \"!\" na bola, textos claros no fundo escuro do botão", () => {
    esperarContraste(PALETA.areia[900], PALETA.bola[300]);
    esperarContraste(BRANCO, PALETA.areia[900]);
    esperarContraste(PALETA.areia[200], PALETA.areia[900]);
    esperarContraste(BRANCO, PALETA.tijolo[600]);
  });

  it("anel de foco visível sobre o branco e o fundo do app (3:1)", () => {
    esperarContraste(PALETA.saibro[600], BRANCO, GRANDE);
    esperarContraste(PALETA.saibro[600], PALETA.areia[100], GRANDE);
  });
});

describe("cores da agenda (legenda do cliente)", () => {
  for (const [tipo, estilo] of Object.entries(ESTILO_OCUPACAO)) {
    it(`${tipo}: texto do bloco vivo e etiqueta clara legíveis`, () => {
      esperarContraste(estilo.sobreCheia, estilo.cheia);
      esperarContraste(estilo.texto, estilo.fundo);
    });
  }
});

describe("etiquetas e estilos dos módulos", () => {
  it("tons das etiquetas de situação", () => {
    for (const tom of Object.values(TONS)) esperarContraste(tom.cor, tom.fundo);
  });

  it("siglas, categorias, estoque e movimentos", () => {
    for (const codigo of ["CH", "24h", "FP", "IAC", "TIP", "NOVA"]) {
      const sigla = estiloDaSigla(codigo);
      esperarContraste(sigla.cor, sigla.fundo);
    }
    for (const c of Object.values(ESTILO_CATEGORIA)) esperarContraste(c.cor, c.fundo);
    for (const c of Object.values(ESTILO_NIVEL_ESTOQUE)) esperarContraste(c.cor, c.fundo);
    for (const c of Object.values(ESTILO_CATEGORIA_PRODUTO)) esperarContraste(c.cor, c.fundo);
    for (const c of Object.values(ESTILO_MOVIMENTO)) esperarContraste(c.cor, c.fundo);
  });

  it("reposição (violeta nativo do Tailwind): marcador da agenda e coluna de Clientes", () => {
    esperarContraste(coresDoTailwind.violet[800], coresDoTailwind.violet[100]);
  });

  it("ranking: pirâmide de raquetes (nome, pontos, posição na bolinha, faixa de saibro)", () => {
    // Faixa de saibro atrás do topo (pior caso: saibro-100) e o resto em branco.
    for (const fundo of [PALETA.saibro[100], PALETA.saibro[50], BRANCO]) {
      esperarContraste(PALETA.areia[900], fundo); // nome e pontos em negrito
      esperarContraste(PALETA.areia[700], fundo); // "pontos", texto de apoio
      esperarContraste(PALETA.saibro[700], fundo); // nome ao passar o mouse
      esperarContraste(PALETA.saibro[800], fundo); // dica "Arraste para o lado"
    }
    // Número da posição na bolinha de tênis.
    esperarContraste(PALETA.areia[900], PALETA.bola[300]);
    // Iniciais (sem foto) sobre a cor do avatar.
    for (const cor of CORES_AVATAR) esperarContraste(textoLegivelSobre(cor), cor);
  });
});

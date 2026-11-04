/**
 * Paleta da Red Tennis: a fonte unica das cores do sistema.
 *
 * O `tailwind.config.ts` le daqui (classes `bg-saibro-600`, `text-areia-500`...)
 * e os arquivos que precisam do valor (agenda, etiquetas, quadras) importam
 * daqui. Para recalibrar o visual, mude so este arquivo; o teste
 * `cores.test.ts` confere que todo texto continua legivel.
 *
 * Cores VIVAS (pedido do cliente), inspiradas na quadra:
 *  - saibro  : laranja do saibro. Cor principal: botoes, mosaico, abas.
 *  - tijolo  : vermelho do letreiro. So perigo, alerta e a marca.
 *  - areia   : neutros (fundo, textos, bordas).
 *  - cimento : azul/roxo da Quadra 1 (piso de cimento).
 *  - quadra  : verde de quadra (faixa das quadras, "livre", positivo).
 *  - bola    : amarelo da bola de tenis (destaques pequenos, interruptor).
 *
 * Regra de contraste (texto pequeno precisa de 4,5:1):
 *  - texto BRANCO so sobre saibro/tijolo/cimento 600+ e quadra 700+;
 *  - texto laranja: saibro-700 ou mais escuro (o 600 so sobre branco);
 *  - sobre bola, quadra 100-300 e azuis claros: texto escuro (areia-900).
 *
 * Sem o atalho "@/": este arquivo tambem e lido pelo tailwind.config.ts.
 */

export const PALETA = {
  saibro: {
    50: "#FFF4EC",
    100: "#FFE6D3",
    200: "#FFCBA6",
    300: "#FFA672",
    400: "#F98543",
    500: "#EE6A1F",
    600: "#C8460B",
    700: "#A8390A",
    800: "#86300D",
    900: "#6B2810",
    950: "#3D1506",
  },
  tijolo: {
    50: "#FEF2F1",
    100: "#FDE1DE",
    200: "#FBC2BC",
    300: "#F6958B",
    400: "#EE5E50",
    500: "#DC3A2B",
    600: "#C42B1F",
    700: "#A32116",
    800: "#821B13",
    900: "#641611",
  },
  areia: {
    50: "#FAFAF9",
    // Fundo do app: cinza claro e limpo (o sistema antigo usa #F2F2F2).
    100: "#F3F3F1",
    200: "#E4E4E0",
    300: "#D0CFCA",
    // So icone, traco e placeholder (nao e texto: contraste 2,6:1).
    400: "#A3A19B",
    // Texto de apoio: 5,8:1 no branco e 5,2:1 no fundo.
    500: "#67655F",
    600: "#57554F",
    700: "#43413C",
    800: "#2D2C29",
    900: "#1C1B19",
  },
  cimento: {
    50: "#EEF0FF",
    100: "#E0E4FF",
    200: "#C5CCFD",
    300: "#A0A9FA",
    400: "#7C83F2",
    500: "#6366F1",
    600: "#4F46E5",
    700: "#4338CA",
    800: "#3730A3",
    900: "#312E81",
  },
  quadra: {
    50: "#ECFDF3",
    100: "#D1FADF",
    200: "#A6F0C4",
    300: "#6EDDA0",
    400: "#34C27A",
    500: "#16A35C",
    600: "#0E8A4B",
    700: "#0B6E3D",
    800: "#0B5733",
    900: "#0A472B",
  },
  bola: {
    50: "#FBFEE7",
    100: "#F5FCC4",
    200: "#EDF98E",
    // A bola: texto escuro por cima (14:1).
    300: "#E0F34F",
    400: "#CDE52A",
    500: "#B2CC12",
    600: "#8BA00B",
    700: "#6A7908",
    800: "#535F0D",
    900: "#454F10",
  },
} as const;

export const BRANCO = "#FFFFFF";
/** Texto principal (escuro) sobre fundos claros e vivos claros. */
export const TINTA = PALETA.areia[900];

/**
 * Pisos desenhados (quadras do Inicio e cabecalhos da agenda): o saibro
 * laranja das quadras 2 a 4 e do paredao e o cimento azul da quadra 1,
 * como no sistema antigo.
 */
export const PISO = {
  saibro: { clara: "#F59A5E", media: "#E8743A", escura: "#C9571F", linha: "rgba(255, 250, 244, 0.95)" },
  cimento: { clara: "#8C93F5", media: "#6366F1", escura: "#4338CA", linha: "rgba(255, 255, 255, 0.95)" },
} as const;

/**
 * Botao grande do mosaico do Inicio (`.ladrilho`): gradiente de laranja vivo.
 * O rotulo e branco, grande e em negrito (minimo 3:1); a cor de referencia do
 * contraste e a do meio do gradiente.
 */
export const LADRILHO = { topo: "#E85D04", base: PALETA.saibro[600], referencia: "#D94E0A" } as const;

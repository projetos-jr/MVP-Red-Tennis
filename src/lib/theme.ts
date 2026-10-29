import type {
  CategoriaProduto,
  CategoriaRanking,
  TipoMovimento,
  TipoOcupacao,
} from "./banco/tipos";

/** Formas de pagamento com cor propria; formas novas (Configuracoes) ficam neutras. */
type FormaPagamentoConhecida = "Stone" | "Bradesco" | "Total Pass" | "Dinheiro";

/**
 * Tokens visuais compartilhados.
 * As cores dos tipos de alocacao seguem exatamente a legenda definida com o
 * cliente na Reuniao Diagnostica e nao devem ser alteradas sem alinhamento.
 */
export interface EstiloTipo {
  /** Cor "cheia" — usada na legenda e na barra lateral do evento. */
  cor: string;
  /** Fundo suave do chip do evento. */
  fundo: string;
  /** Cor do texto sobre o fundo suave. */
  texto: string;
  /** Cor da borda do chip. */
  borda: string;
}

export const ESTILO_TIPO: Record<Exclude<TipoOcupacao, "Bloqueio">, EstiloTipo> = {
  Individual: {
    cor: "#DC2626",
    fundo: "#FEF2F2",
    texto: "#991B1B",
    borda: "#FCA5A5",
  },
  "Locação Mensal": {
    cor: "#1E3A8A",
    fundo: "#EFF4FF",
    texto: "#1E3A8A",
    borda: "#A9BEF0",
  },
  Dupla: {
    cor: "#16A34A",
    fundo: "#F0FDF4",
    texto: "#15803D",
    borda: "#9DE0B4",
  },
  LAP: {
    cor: "#EA580C",
    fundo: "#FFF6ED",
    texto: "#C2410C",
    borda: "#FBBF8F",
  },
  "Locação Avulsa": {
    cor: "#38BDF8",
    fundo: "#F0FAFF",
    texto: "#0369A1",
    borda: "#A5DFF7",
  },
  Ranking: {
    cor: "#7C3AED",
    fundo: "#F7F3FF",
    texto: "#6D28D9",
    borda: "#CBB4F8",
  },
  "Plano de locação": {
    cor: "#EAB308",
    fundo: "#FEFBEB",
    texto: "#A16207",
    borda: "#F5D97A",
  },
};

/**
 * Cores dos tipos de ocupacao do modelo novo: as mesmas da legenda, mais o
 * bloqueio de quadra (neutro, para nao competir com as aulas).
 */
export const ESTILO_OCUPACAO: Record<TipoOcupacao, EstiloTipo> = {
  ...ESTILO_TIPO,
  Bloqueio: {
    cor: "#6B6255",
    fundo: "#F4F1EC",
    texto: "#4F483E",
    borda: "#D6CEC2",
  },
};

/** Cores das siglas de falta/cancelamento, pelo codigo (CH, 24h, FP, IAC, TIP). */
const ESTILO_SIGLA: Record<string, { cor: string; fundo: string }> = {
  CH: { cor: "#0369A1", fundo: "#F0FAFF" },
  "24h": { cor: "#15803D", fundo: "#F0FDF4" },
  FP: { cor: "#A16207", fundo: "#FEFBEB" },
  IAC: { cor: "#6D28D9", fundo: "#F7F3FF" },
  TIP: { cor: "#C2410C", fundo: "#FFF6ED" },
};

/** Siglas novas (cadastradas nas Configuracoes) caem num estilo neutro. */
export function estiloDaSigla(codigo: string): { cor: string; fundo: string } {
  return ESTILO_SIGLA[codigo] ?? { cor: "#4F483E", fundo: "#F4F1EC" };
}

/**
 * Formas de pagamento.
 *
 * `cor` e usada nos chips de texto (precisa de contraste de leitura) e
 * `corGrafico` nas barras do painel de planejamento — sao passos diferentes da
 * mesma familia de matiz, para que a mesma forma de pagamento seja reconhecida
 * na tabela e no grafico. A serie de `corGrafico` foi validada para daltonismo
 * (separacao CVD ≥ 8 em todos os pares) sobre fundo claro.
 */
export const ESTILO_FORMA_PAGAMENTO: Record<
  FormaPagamentoConhecida,
  {
    label: string;
    detalhe: string;
    cor: string;
    fundo: string;
    corGrafico: string;
  }
> = {
  Stone: {
    label: "Stone",
    detalhe: "Boleto / link de pagamento",
    cor: "#0F766E",
    fundo: "#F0FDFA",
    corGrafico: "#1BAF7A",
  },
  Bradesco: {
    label: "Bradesco",
    detalhe: "Crédito / débito",
    cor: "#A32A1C",
    fundo: "#FDF3F2",
    corGrafico: "#EB6834",
  },
  "Total Pass": {
    label: "Total Pass",
    detalhe: "Convênio com complemento",
    cor: "#1E3A8A",
    fundo: "#EFF4FF",
    corGrafico: "#2A78D6",
  },
  Dinheiro: {
    label: "Dinheiro",
    detalhe: "Espécie / PIX no balcão",
    cor: "#4A3AA7",
    fundo: "#F5F3FF",
    corGrafico: "#4A3AA7",
  },
};

export const ESTILO_CATEGORIA: Record<
  CategoriaRanking,
  { label: string; descricao: string; cor: string; fundo: string; borda: string }
> = {
  A: {
    label: "Categoria A",
    descricao: "Avançado",
    cor: "#8A2118",
    fundo: "#FBE3E0",
    borda: "#EC9A90",
  },
  B: {
    label: "Categoria B",
    descricao: "Intermediário +",
    cor: "#9A4720",
    fundo: "#F3CEAF",
    borda: "#EAAD82",
  },
  C: {
    label: "Categoria C",
    descricao: "Intermediário",
    cor: "#B95A28",
    fundo: "#FAE8DA",
    borda: "#F3CEAF",
  },
  D: {
    label: "Categoria D",
    descricao: "Iniciante",
    cor: "#6B6255",
    fundo: "#F4F1EC",
    borda: "#E8E3DB",
  },
};

/** Paleta dos avatares placeholder (iniciais sobre fundo colorido). */
export const CORES_AVATAR = [
  "#B95A28",
  "#8A2118",
  "#0E7490",
  "#4D7C0F",
  "#6D28D9",
  "#A16207",
  "#1E3A8A",
  "#15803D",
  "#C43F2F",
  "#6B6255",
];

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** 90 -> "1h30" ; 60 -> "1h" ; 45 -> "45min" */
export function formatarMinutos(minutos: number): string {
  if (minutos < 60) return `${minutos}min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Escolhe uma cor estavel de avatar a partir do id do aluno. */
export function corAvatar(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return CORES_AVATAR[hash % CORES_AVATAR.length];
}

// ---------------------------------------------------------------------------
// Estoque
// ---------------------------------------------------------------------------
/**
 * Situacao do saldo de cada item.
 * O cliente pediu "bater o olho e entender": cor + rotulo + barra de nivel,
 * nunca so a cor.
 */
export const ESTILO_NIVEL_ESTOQUE = {
  esgotado: {
    label: "Esgotado",
    cor: "#8A2118",
    fundo: "#FBE3E0",
    borda: "#EC9A90",
    barra: "#C43F2F",
  },
  critico: {
    label: "Repor já",
    cor: "#A32A1C",
    fundo: "#FDF3F2",
    borda: "#F6C4BE",
    barra: "#DC6557",
  },
  atencao: {
    label: "Atenção",
    cor: "#A16207",
    fundo: "#FEFBEB",
    borda: "#F5D97A",
    barra: "#EAB308",
  },
  saudavel: {
    label: "Em dia",
    cor: "#15803D",
    fundo: "#F0FDF4",
    borda: "#9DE0B4",
    barra: "#16A34A",
  },
} as const;

export const ESTILO_CATEGORIA_PRODUTO: Record<
  CategoriaProduto,
  { cor: string; fundo: string; borda: string }
> = {
  Bebidas: { cor: "#0369A1", fundo: "#F0FAFF", borda: "#A5DFF7" },
  Cervejas: { cor: "#A16207", fundo: "#FEFBEB", borda: "#F5D97A" },
  Lanches: { cor: "#C2410C", fundo: "#FFF6ED", borda: "#FBBF8F" },
  Acessórios: { cor: "#6D28D9", fundo: "#F7F3FF", borda: "#CBB4F8" },
};

export const ESTILO_MOVIMENTO: Record<
  TipoMovimento,
  { label: string; sinal: string; cor: string; fundo: string }
> = {
  entrada: { label: "Entrada", sinal: "+", cor: "#15803D", fundo: "#F0FDF4" },
  venda: { label: "Venda", sinal: "−", cor: "#0369A1", fundo: "#F0FAFF" },
  perda: { label: "Perda", sinal: "−", cor: "#8A2118", fundo: "#FBE3E0" },
  ajuste: { label: "Ajuste", sinal: "±", cor: "#6B6255", fundo: "#F4F1EC" },
};

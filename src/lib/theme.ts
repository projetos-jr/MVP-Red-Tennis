import type {
  CategoriaProduto,
  CategoriaRanking,
  TipoMovimento,
  TipoOcupacao,
} from "./banco/tipos";
import { BRANCO, PALETA, TINTA } from "./paleta";

/**
 * Tokens visuais compartilhados.
 * As cores dos tipos de alocacao seguem a legenda definida com o cliente na
 * Reuniao Diagnostica (o MATIZ nao muda sem alinhamento). Desde o redesign de
 * novembro, os blocos da agenda sao pintados com a cor CHEIA e viva (pedido do
 * cliente: "cores vivas, nao pasteis"); os tons claros ficam para etiquetas e
 * para a impressao.
 */
export interface EstiloTipo {
  /** Cor de referencia do tipo (legenda, bolinhas, barras). */
  cor: string;
  /** Fundo vivo do bloco na agenda. */
  cheia: string;
  /** Texto sobre `cheia` (branco ou escuro, o que passar de 4,5:1). */
  sobreCheia: string;
  /** Fundo suave do chip do evento. */
  fundo: string;
  /** Cor do texto sobre o fundo suave. */
  texto: string;
  /** Cor da borda do chip. */
  borda: string;
}

export const ESTILO_TIPO: Record<Exclude<TipoOcupacao, "Bloqueio">, EstiloTipo> = {
  Individual: {
    cheia: "#DC2626",
    sobreCheia: BRANCO,
    cor: "#DC2626",
    fundo: "#FEF2F2",
    texto: "#991B1B",
    borda: "#FCA5A5",
  },
  "Locação Mensal": {
    cheia: "#1E40AF",
    sobreCheia: BRANCO,
    cor: "#1E3A8A",
    fundo: "#EFF4FF",
    texto: "#1E3A8A",
    borda: "#A9BEF0",
  },
  Dupla: {
    cheia: "#15803D",
    sobreCheia: BRANCO,
    cor: "#16A34A",
    fundo: "#F0FDF4",
    texto: "#15803D",
    borda: "#9DE0B4",
  },
  LAP: {
    cheia: "#F97316",
    sobreCheia: TINTA,
    cor: "#EA580C",
    fundo: "#FFF6ED",
    texto: "#C2410C",
    borda: "#FBBF8F",
  },
  "Locação Avulsa": {
    cheia: "#38BDF8",
    sobreCheia: TINTA,
    cor: "#38BDF8",
    fundo: "#F0FAFF",
    texto: "#0369A1",
    borda: "#A5DFF7",
  },
  Ranking: {
    cheia: "#7C3AED",
    sobreCheia: BRANCO,
    cor: "#7C3AED",
    fundo: "#F7F3FF",
    texto: "#6D28D9",
    borda: "#CBB4F8",
  },
  "Plano de locação": {
    cheia: "#EAB308",
    sobreCheia: TINTA,
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
    cheia: PALETA.areia[200],
    sobreCheia: PALETA.areia[800],
    cor: PALETA.areia[600],
    fundo: PALETA.areia[100],
    texto: PALETA.areia[700],
    borda: PALETA.areia[300],
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
  return ESTILO_SIGLA[codigo] ?? { cor: PALETA.areia[700], fundo: PALETA.areia[100] };
}

export const ESTILO_CATEGORIA: Record<
  CategoriaRanking,
  { label: string; descricao: string; cor: string; fundo: string; borda: string }
> = {
  A: {
    label: "Categoria A",
    descricao: "Avançado",
    cor: PALETA.tijolo[800],
    fundo: PALETA.tijolo[100],
    borda: PALETA.tijolo[300],
  },
  // B e C: texto um tom mais escuro que o do MVP, para o contraste passar de 4,5:1.
  B: {
    label: "Categoria B",
    descricao: "Intermediário +",
    cor: PALETA.saibro[900],
    fundo: PALETA.saibro[200],
    borda: PALETA.saibro[300],
  },
  C: {
    label: "Categoria C",
    descricao: "Intermediário",
    cor: PALETA.saibro[800],
    fundo: PALETA.saibro[100],
    borda: PALETA.saibro[200],
  },
  D: {
    label: "Categoria D",
    descricao: "Iniciante",
    cor: PALETA.areia[700],
    fundo: PALETA.areia[100],
    borda: PALETA.areia[200],
  },
};

/** Paleta dos avatares placeholder (iniciais sobre fundo colorido). */
export const CORES_AVATAR = [
  PALETA.saibro[600],
  PALETA.tijolo[700],
  "#0E7490",
  PALETA.quadra[700],
  "#6D28D9",
  "#A16207",
  PALETA.cimento[700],
  "#15803D",
  PALETA.tijolo[600],
  PALETA.areia[600],
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
  ajuste: { label: "Ajuste", sinal: "±", cor: PALETA.areia[700], fundo: PALETA.areia[100] },
};

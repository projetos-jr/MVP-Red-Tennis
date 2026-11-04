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

/**
 * Cores de apoio que nao sao da paleta da arena: as cores nativas do Tailwind
 * que ja tem significado no sistema (ambar = aguardando, ceu = chuva/info,
 * violeta = reposicao/ranking, ciano = avatar). Ficam so aqui, nas tabelas de
 * estilo, e cada par texto/fundo e conferido em `cores.test.ts`.
 */
export const APOIO = {
  ambar: { texto: "#A16207", fundo: "#FEFBEB", borda: "#F5D97A", barra: "#EAB308" },
  ceu: { texto: "#0369A1", fundo: "#F0FAFF", borda: "#A5DFF7" },
  violeta: { texto: "#6D28D9", fundo: "#F7F3FF", borda: "#CBB4F8" },
  ciano: "#0E7490",
} as const;

/** Cores das siglas de falta/cancelamento, pelo codigo (CH, 24h, FP, IAC, TIP). */
const ESTILO_SIGLA: Record<string, { cor: string; fundo: string }> = {
  CH: { cor: APOIO.ceu.texto, fundo: APOIO.ceu.fundo },
  "24h": { cor: PALETA.quadra[700], fundo: PALETA.quadra[50] },
  FP: { cor: APOIO.ambar.texto, fundo: APOIO.ambar.fundo },
  IAC: { cor: APOIO.violeta.texto, fundo: APOIO.violeta.fundo },
  TIP: { cor: PALETA.saibro[800], fundo: PALETA.saibro[50] },
};

/** Siglas novas (cadastradas nas Configuracoes) caem num estilo neutro. */
export function estiloDaSigla(codigo: string): { cor: string; fundo: string } {
  return ESTILO_SIGLA[codigo] ?? { cor: PALETA.areia[700], fundo: PALETA.areia[100] };
}

export const ESTILO_CATEGORIA: Record<
  CategoriaRanking,
  { label: string; descricao: string; cor: string; fundo: string; borda: string }
> = {
  // Escala do saibro: quanto mais alta a categoria, mais forte o laranja (o
  // vermelho fica so para alerta). A letra vai sempre escrita no selo.
  A: {
    label: "Categoria A",
    descricao: "Avançado",
    cor: PALETA.saibro[950],
    fundo: PALETA.saibro[300],
    borda: PALETA.saibro[400],
  },
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

/**
 * Paleta dos avatares placeholder (iniciais brancas sobre fundo colorido; todos
 * passam de 4,5:1). Sem vermelho: ao lado de um nome, ele pareceria alerta.
 */
export const CORES_AVATAR = [
  PALETA.saibro[600],
  PALETA.cimento[600],
  APOIO.ciano,
  PALETA.quadra[700],
  APOIO.violeta.texto,
  APOIO.ambar.texto,
  PALETA.cimento[800],
  PALETA.bola[800],
  PALETA.saibro[800],
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
    cor: PALETA.tijolo[800],
    fundo: PALETA.tijolo[100],
    borda: PALETA.tijolo[300],
    barra: PALETA.tijolo[600],
  },
  critico: {
    label: "Repor já",
    cor: PALETA.tijolo[700],
    fundo: PALETA.tijolo[50],
    borda: PALETA.tijolo[200],
    barra: PALETA.tijolo[500],
  },
  atencao: {
    label: "Atenção",
    cor: APOIO.ambar.texto,
    fundo: APOIO.ambar.fundo,
    borda: APOIO.ambar.borda,
    barra: APOIO.ambar.barra,
  },
  saudavel: {
    label: "Em dia",
    cor: PALETA.quadra[700],
    fundo: PALETA.quadra[50],
    borda: PALETA.quadra[200],
    barra: PALETA.quadra[500],
  },
} as const;

export const ESTILO_CATEGORIA_PRODUTO: Record<
  CategoriaProduto,
  { cor: string; fundo: string; borda: string }
> = {
  Bebidas: { cor: APOIO.ceu.texto, fundo: APOIO.ceu.fundo, borda: APOIO.ceu.borda },
  Cervejas: { cor: APOIO.ambar.texto, fundo: APOIO.ambar.fundo, borda: APOIO.ambar.borda },
  Lanches: { cor: PALETA.saibro[800], fundo: PALETA.saibro[50], borda: PALETA.saibro[200] },
  Acessórios: { cor: APOIO.violeta.texto, fundo: APOIO.violeta.fundo, borda: APOIO.violeta.borda },
};

export const ESTILO_MOVIMENTO: Record<
  TipoMovimento,
  { label: string; sinal: string; cor: string; fundo: string }
> = {
  entrada: { label: "Entrada", sinal: "+", cor: PALETA.quadra[700], fundo: PALETA.quadra[50] },
  venda: { label: "Venda", sinal: "−", cor: APOIO.ceu.texto, fundo: APOIO.ceu.fundo },
  perda: { label: "Perda", sinal: "−", cor: PALETA.tijolo[800], fundo: PALETA.tijolo[100] },
  ajuste: { label: "Ajuste", sinal: "±", cor: PALETA.areia[700], fundo: PALETA.areia[100] },
};

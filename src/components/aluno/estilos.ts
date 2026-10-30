import type {
  SituacaoAluno,
  SituacaoCongelamento,
  SituacaoLancamento,
  SituacaoMatricula,
  SituacaoNaAula,
} from "@/lib/consultas/alunos";
import type { RegraRepasse } from "@/lib/banco/tipos";
import { TONS } from "@/components/ui/EtiquetaDeSituacao";
import { diferencaEmDias } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";

/**
 * Rotulos e cores do modulo de alunos e professores. Toda cor vem junto de
 * um rotulo de texto: a cor nunca e o unico indicador. As cores sao os tons
 * comuns de `components/ui/EtiquetaDeSituacao` (as mesmas dos outros modulos).
 */
export interface EstiloRotulo {
  rotulo: string;
  cor: string;
  fundo: string;
  borda?: string;
}

const VERDE = TONS.positivo;
const AZUL = TONS.info;
const AMARELO = TONS.atencao;
const VERMELHO = TONS.alerta;
const NEUTRO = TONS.neutro;

export const ESTILO_SITUACAO_ALUNO: Record<SituacaoAluno, EstiloRotulo & { descricao: string }> = {
  ativo: { rotulo: "Ativo", descricao: "com plano valendo", ...VERDE },
  congelado: { rotulo: "Congelado", descricao: "plano pausado", ...AZUL },
  avulso: { rotulo: "Sem plano", descricao: "sem plano mensal", ...NEUTRO },
  inativo: { rotulo: "Inativo", descricao: "saíram da arena", ...VERMELHO },
};

export const ORDEM_SITUACOES: SituacaoAluno[] = ["ativo", "congelado", "avulso", "inativo"];

export const ESTILO_SITUACAO_NA_AULA: Record<SituacaoNaAula, EstiloRotulo> = {
  presente: { rotulo: "Presente", ...VERDE },
  falta: { rotulo: "Falta", cor: "#991B1B", fundo: "#FEF2F2", borda: "#FCA5A5" },
  falta_avisada: { rotulo: "Falta avisada", ...AMARELO },
  a_marcar: { rotulo: "A marcar", ...NEUTRO },
  cancelada: { rotulo: "Aula cancelada", cor: "#6B6255", fundo: "#FFFFFF", borda: "#D6CEC2" },
  suspensa: { rotulo: "Suspensa", ...AZUL },
};

export const ESTILO_SITUACAO_LANCAMENTO: Record<SituacaoLancamento, EstiloRotulo> = {
  pago: { rotulo: "Pago", ...VERDE },
  pendente: { rotulo: "Pendente", ...AMARELO },
  em_atraso: { rotulo: "Em atraso", ...VERMELHO },
  cancelado: { rotulo: "Anulado", ...NEUTRO },
};

export const ESTILO_SITUACAO_MATRICULA: Record<SituacaoMatricula, EstiloRotulo> = {
  vigente: { rotulo: "Vigente", ...VERDE },
  agendada: { rotulo: "Agendada", ...AMARELO },
  encerrada: { rotulo: "Encerrada", ...NEUTRO },
};

export const ESTILO_SITUACAO_CONGELAMENTO: Record<SituacaoCongelamento, EstiloRotulo> = {
  em_curso: { rotulo: "Em curso", ...AZUL },
  agendado: { rotulo: "Agendado", ...AMARELO },
  encerrado: { rotulo: "Encerrado", ...NEUTRO },
  cancelado: { rotulo: "Cancelado", ...NEUTRO },
};

/** Marca de tabela do plano (Hipotese H3). */
export const ESTILO_TABELA: Record<"nova" | "antiga", EstiloRotulo> = {
  nova: { rotulo: "Tabela nova", ...NEUTRO },
  antiga: { rotulo: "Tabela antiga", ...AMARELO },
};

/** "R$ 78,00 por hora-aula" ou "30% das mensalidades" (Hipotese H6). */
export function rotuloDaRegraDeRepasse(regra: RegraRepasse): string {
  return regra.modo === "por_hora"
    ? `${formatarMoeda(regra.valor)} por hora-aula`
    : `${regra.valor.toLocaleString("pt-BR")}% das mensalidades`;
}

/**
 * Valor digitado em reais -> numero: "720", "720,50", "1.200,50", "R$ 1.200"
 * e "720.50" funcionam. Texto que nao e numero vira NaN (a regra recusa).
 */
export function lerValorEmReais(texto: string): number {
  let limpo = texto.replace(/R\$|\s/g, "");
  if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) limpo = limpo.replace(/\./g, "");
  return limpo === "" ? Number.NaN : Number(limpo);
}

/** 720 -> "720,00" (para preencher um campo de valor). */
export function valorParaCampo(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

/**
 * Classe do campo de formulario, com a borda vermelha quando ha erro (a
 * mensagem aparece embaixo, pelo `Campo`).
 */
export function classeDoCampo(erro?: string): string {
  return erro ? "campo border-tijolo-400 focus:border-tijolo-500 focus:ring-tijolo-500/20" : "campo";
}

/** plural(1, "aula", "aulas") -> "1 aula"; plural(3, ...) -> "3 aulas". */
export function plural(quantidade: number, singular: string, varias: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : varias}`;
}

/** Idade completa em anos na data `hoje`. */
export function idade(dataNascimento: string, hoje: string): number {
  const anos = Number(hoje.slice(0, 4)) - Number(dataNascimento.slice(0, 4));
  return hoje.slice(5) < dataNascimento.slice(5) ? anos - 1 : anos;
}

/** "hoje", "amanhã", "em 12 dias", "há 3 dias". */
export function distanciaEmDias(data: string, hoje: string): string {
  const dias = diferencaEmDias(hoje, data);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  return dias > 0 ? `em ${dias} dias` : `há ${-dias} dias`;
}

/** Nomes amigaveis dos campos no historico de alteracoes. */
export const ROTULOS_ALUNO: Record<string, string> = {
  nome: "Nome",
  telefone: "Telefone",
  email: "E-mail",
  dataNascimento: "Data de nascimento",
  professorPrincipalId: "Professor principal",
  ativo: "Ativo",
  inscritoRanking: "Inscrito no ranking",
  categoriaRanking: "Categoria do ranking",
  fotoUrl: "Foto",
};

export const ROTULOS_MATRICULA: Record<string, string> = {
  planoId: "Plano",
  valorMensal: "Valor combinado",
  diaVencimento: "Dia de vencimento",
  inicio: "Início",
  fim: "Último dia",
};

export const ROTULOS_CONGELAMENTO: Record<string, string> = {
  inicio: "Início",
  fimPrevisto: "Fim previsto",
  fimReal: "Último dia congelado",
  motivo: "Motivo",
  aulasSuspensas: "Aulas suspensas",
};

export const ROTULOS_PROFESSOR: Record<string, string> = {
  nome: "Nome",
  cor: "Cor na agenda",
  especialidade: "Especialidade",
  telefone: "Telefone",
  email: "E-mail",
  repasse: "Regra de repasse",
  ativo: "Ativo",
};

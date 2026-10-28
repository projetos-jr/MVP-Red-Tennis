/**
 * Dados carregados do Supabase.
 *
 * O `AppProvider` carrega tudo depois do login e chama `definirBase`. As telas
 * internas so sao montadas depois disso, entao os seletores sempre encontram
 * os dados preenchidos. As exportacoes sao `let` de proposito: imports ES sao
 * vinculos vivos e passam a enxergar os valores novos.
 */

import type {
  Aluno,
  Consumo,
  Horario,
  MovimentoEstoque,
  Pagamento,
  Produto,
  Professor,
  Torneio,
} from "./types";

export interface BaseDeDados {
  alunos: Aluno[];
  professores: Professor[];
  horarios: Horario[];
  pagamentos: Pagamento[];
  produtos: Produto[];
  consumos: Consumo[];
  movimentos: MovimentoEstoque[];
  torneios: Torneio[];
  diasComChuva: string[];
  idsInscritosRanking: string[];
  mensalidadePorAluno: Record<string, number>;
}

export let ALUNOS: Aluno[] = [];
export let PROFESSORES: Professor[] = [];
export let HORARIOS: Horario[] = [];
export let PAGAMENTOS: Pagamento[] = [];
export let PRODUTOS: Produto[] = [];
export let CONSUMOS: Consumo[] = [];
export let MOVIMENTOS_ESTOQUE: MovimentoEstoque[] = [];
export let TORNEIOS: Torneio[] = [];
export let DIAS_COM_CHUVA: string[] = [];
export let IDS_INSCRITOS_RANKING: string[] = [];
export let MENSALIDADE_POR_ALUNO: Record<string, number> = {};

let avatares = new Map<string, string>();

export function definirBase(base: BaseDeDados): void {
  ALUNOS = base.alunos;
  PROFESSORES = base.professores;
  HORARIOS = base.horarios;
  PAGAMENTOS = base.pagamentos;
  PRODUTOS = base.produtos;
  CONSUMOS = base.consumos;
  MOVIMENTOS_ESTOQUE = base.movimentos;
  TORNEIOS = base.torneios;
  DIAS_COM_CHUVA = base.diasComChuva;
  IDS_INSCRITOS_RANKING = base.idsInscritosRanking;
  MENSALIDADE_POR_ALUNO = base.mensalidadePorAluno;
  avatares = new Map(
    base.alunos.flatMap((a) => (a.avatarUrl ? [[a.id, a.avatarUrl]] : [])),
  );
}

/** Foto da pessoa, quando cadastrada; senao o <Avatar> mostra as iniciais. */
export function caminhoAvatar(id: string): string | undefined {
  return avatares.get(id);
}

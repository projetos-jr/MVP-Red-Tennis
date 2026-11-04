import type { Banco, Colaborador, ModuloSistema } from "@/lib/banco/tipos";
import { SITE_DA_ARENA } from "@/lib/branding";
import { podeAcessar } from "@/lib/consultas/base";

/**
 * Atalhos do mosaico do Inicio (os botoes grandes laranja, como no sistema
 * antigo que o cliente usa). So dados: o desenho fica em
 * `components/inicio/MosaicoDeAtalhos.tsx` e os icones em
 * `components/inicio/IconesDoMosaico.tsx`.
 *
 * Cada atalho leva a uma tela que ja existe; o filtro por perfil usa a mesma
 * permissao das abas (`podeAcessar`, Hipotese H9).
 */

export type IdDoAtalho =
  | "diaria"
  | "agenda-professores"
  | "financeiro"
  | "estoque"
  | "historico"
  | "clientes"
  | "professores"
  | "configuracoes"
  | "ranking"
  | "torneio"
  | "lap"
  | "site";

export interface Atalho {
  id: IdDoAtalho;
  rotulo: string;
  /** Frase curta para leitor de tela e para a dica do mouse. */
  descricao: string;
  href: string;
  /** Permissao exigida. Sem modulo = todos (so o link externo do site). */
  modulo?: ModuloSistema;
  /** Link para fora do sistema: abre em nova aba. */
  externo?: boolean;
}

/**
 * Na ordem da lista combinada para o Inicio (a do sistema antigo).
 * LAP abre a agenda filtrada por LAP (hipotese a confirmar com o cliente).
 */
const ATALHOS_INTERNOS: Atalho[] = [
  { id: "diaria", rotulo: "Diária", descricao: "Agenda de hoje e de amanhã, quadra por quadra", href: "/agenda", modulo: "agenda" },
  {
    id: "agenda-professores",
    rotulo: "Agenda Professores",
    descricao: "Semana de cada professor",
    href: "/agenda?visao=professor",
    modulo: "agenda",
  },
  { id: "financeiro", rotulo: "Financeiro", descricao: "Recebimentos, pagamentos e repasses", href: "/financeiro", modulo: "financeiro" },
  { id: "estoque", rotulo: "Estoque", descricao: "Produtos, entradas e consumo", href: "/estoque", modulo: "estoque" },
  { id: "historico", rotulo: "Histórico", descricao: "Histórico de alterações do sistema", href: "/historico", modulo: "historico" },
  { id: "clientes", rotulo: "Clientes", descricao: "Lista e fichas dos clientes", href: "/alunos", modulo: "alunos" },
  { id: "professores", rotulo: "Professores", descricao: "Professores, aulas e repasses", href: "/professores", modulo: "professores" },
  { id: "configuracoes", rotulo: "Configurações", descricao: "Regras, planos e permissões", href: "/configuracoes", modulo: "configuracoes" },
  { id: "ranking", rotulo: "Ranking", descricao: "Ranking geral e resultados", href: "/ranking", modulo: "ranking" },
  { id: "torneio", rotulo: "Torneio", descricao: "Torneios e chaves", href: "/ranking?aba=torneios", modulo: "ranking" },
  { id: "lap", rotulo: "LAP", descricao: "Agenda só com os horários de LAP", href: "/agenda?tipo=LAP", modulo: "agenda" },
];

/** Todos os atalhos possiveis. O "Site" so entra quando o endereco existe. */
export function todosOsAtalhos(siteDaArena: string = SITE_DA_ARENA): Atalho[] {
  const site = siteDaArena.trim();
  return site
    ? [
        ...ATALHOS_INTERNOS,
        { id: "site", rotulo: "Site", descricao: "Site da arena (abre em nova aba)", href: site, externo: true },
      ]
    : ATALHOS_INTERNOS;
}

/** Atalhos que o perfil de quem esta logado pode abrir. */
export function atalhosPermitidos(
  banco: Banco,
  colaborador: Colaborador,
  siteDaArena: string = SITE_DA_ARENA,
): Atalho[] {
  return todosOsAtalhos(siteDaArena).filter(
    (atalho) => !atalho.modulo || podeAcessar(banco, colaborador, atalho.modulo),
  );
}

/**
 * Quantas colunas o primeiro atalho (Diária) ocupa para a grade fechar sem
 * buraco na ultima linha: ele absorve as celulas que sobrariam.
 * Ex.: 11 atalhos em 4 colunas -> 2 (12 celulas, 3 linhas cheias).
 */
export function colunasDoPrimeiro(total: number, colunas: number): number {
  if (total <= 0 || colunas <= 1) return 1;
  return 1 + ((colunas - (total % colunas)) % colunas);
}

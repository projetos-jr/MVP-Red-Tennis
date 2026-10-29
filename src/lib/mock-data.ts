/**
 * ============================================================================
 *  DADOS NO FORMATO ANTIGO DO MVP — temporario
 * ============================================================================
 *  Os dados de exemplo agora vivem no banco em memoria (`src/lib/banco/`),
 *  no modelo novo descrito em `docs/MODELO-E-TELAS.md`. Este arquivo so
 *  reexporta uma fotografia desse banco no formato antigo (via `legado.ts`),
 *  para as telas que ainda nao foram migradas.
 *
 *  Codigo novo NAO deve importar daqui: use `useApp().banco` com as funcoes
 *  de `src/lib/consultas/` e as constantes de `src/lib/banco/constantes.ts`.
 * ============================================================================
 */

import { DIAS_COM_CHUVA as DIAS_DE_CHUVA } from "./banco/semente/agenda";
import { CATEGORIAS_PRODUTO as CATEGORIAS } from "./banco/semente/estoque";
import { LEGADO } from "./legado";
import type {
  Aluno,
  CategoriaProduto,
  CategoriaRanking,
  Consumo,
  Horario,
  MovimentoEstoque,
  Pagamento,
  PisoQuadra,
  Produto,
  Professor,
  Quadra,
  Torneio,
} from "./types";

export {
  FAIXAS_HORARIAS,
  HOJE,
  HORA_ABERTURA,
  HORA_FECHAMENTO,
} from "./banco/constantes";

export const QUADRAS: Quadra[] = [1, 2, 3, 4, "paredao"];

/** A quadra 1 e de cimento; as demais e o paredao sao de saibro. */
export const PISO_DAS_QUADRAS: Record<string, PisoQuadra> = {
  "1": "cimento",
  "2": "saibro",
  "3": "saibro",
  "4": "saibro",
  paredao: "saibro",
};

export function pisoDaQuadra(quadra: Quadra): PisoQuadra {
  return PISO_DAS_QUADRAS[String(quadra)] ?? "saibro";
}

export const ARENA = {
  nome: "Red Tennis",
  endereco: "3 quadras de saibro · 1 de cimento · paredão",
  horarioFuncionamento: "07h às 22h",
  gestor: "Francisco",
  equipe: "Lucas",
};

/** Usuarios da tela de login (os ids sao os mesmos de `colaboradores`). */
export const USUARIOS = [
  {
    id: "u-francisco",
    nome: "Francisco Menezes",
    usuario: "francisco",
    cargo: "Diretor · Acesso total",
  },
  {
    id: "u-lucas",
    nome: "Lucas Ferreira",
    usuario: "lucas",
    cargo: "Operação · Agenda e caixa",
  },
  {
    id: "u-renata",
    nome: "Renata Coelho",
    usuario: "renata",
    cargo: "Professora · Agenda própria",
  },
];

export const PROFESSORES: Professor[] = LEGADO.professores;
export const NOMES_PROFESSORES = PROFESSORES.map((p) => p.nome);

/** Usado em locacoes e reservas de ranking, onde nao ha professor alocado. */
export const SEM_PROFESSOR = "Sem professor";

export const ALUNOS: Aluno[] = LEGADO.alunos;
export const IDS_ALUNOS = ALUNOS.map((a) => a.id);

/** Ids dos alunos inscritos no ranking (os 23 membros com foto). */
export const IDS_INSCRITOS_RANKING: string[] = LEGADO.idsInscritosRanking;

/** Ids que possuem foto em `/public/avatars/[id].jpg`. */
export const IDS_COM_FOTO = new Set<string>(
  ALUNOS.filter((a) => a.avatarUrl).map((a) => a.id),
);

export function caminhoAvatar(id: string): string | undefined {
  return IDS_COM_FOTO.has(id) ? `/avatars/${id}.jpg` : undefined;
}

/** Datas em que a arena nao operou por chuva. */
export const DIAS_COM_CHUVA: string[] = DIAS_DE_CHUVA;

/** Grade semanal: os horarios fixos que valem hoje (sem conflitos — o modelo novo os impede). */
export const HORARIOS: Horario[] = LEGADO.horarios;

export const PAGAMENTOS: Pagamento[] = LEGADO.pagamentos;

/** Valor de mensalidade por aluno — usado nos totais do Financeiro. */
export const MENSALIDADE_POR_ALUNO: Record<string, number> = LEGADO.mensalidadePorAluno;

/**
 * Formato da piramide do MVP: 6 faixas, do topo para a base.
 * 1 + 2 + 3 + 4 + 6 + 7 = 23 posicoes, uma para cada membro inscrito.
 * (A piramide sai da v1; fica ate a tela de torneios ser refeita.)
 */
export const LINHAS_PIRAMIDE = [1, 2, 3, 4, 6, 7];

export const CATEGORIA_POR_LINHA: CategoriaRanking[] = ["A", "A", "B", "B", "C", "D"];

export const TORNEIOS: Torneio[] = LEGADO.torneios;

export const CATEGORIAS_PRODUTO: CategoriaProduto[] = CATEGORIAS;

export const PRODUTOS: Produto[] = LEGADO.produtos;

export const CONSUMOS: Consumo[] = LEGADO.consumos;

export const MOVIMENTOS_ESTOQUE: MovimentoEstoque[] = LEGADO.movimentos;

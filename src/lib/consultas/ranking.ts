/**
 * Consultas do ranking e dos torneios: o que as telas do modulo leem.
 *
 * Toda funcao recebe o `banco` como primeiro parametro (veja `base.ts`). O
 * ranking e a chave dos torneios sao calculados aqui a partir das partidas,
 * com as regras de `banco/regras/ranking.ts` e `banco/regras/torneios.ts`.
 */

import { somarDias } from "../date";
import {
  conflitosNaQuadra,
  descreverOcupacao,
  rotuloDaQuadra,
  type IntervaloNaQuadra,
} from "../banco/regras/agenda";
import { calcularRanking, inverterPlacar, lerPlacar, type LinhaRanking } from "../banco/regras/ranking";
import {
  bloqueioDeCorrecao,
  campeaoDoTorneio,
  classificar,
  nomeDaFase,
  partidasDaEliminatoria,
  previaDaChave,
  type LinhaDaClassificacao,
  type PreviaDaChave,
} from "../banco/regras/torneios";
import type {
  Aluno,
  Banco,
  CategoriaRanking,
  FormatoTorneio,
  Ocupacao,
  Partida,
  Quadra,
  SituacaoTorneio,
  Torneio,
  TorneioInscrito,
} from "../banco/tipos";
import { nomeCompacto } from "./base";

export const ROTULO_FORMATO: Record<FormatoTorneio, string> = {
  eliminatoria: "Eliminatória simples",
  grupos_eliminatoria: "Grupos + eliminatória",
  todos_contra_todos: "Todos contra todos",
};

export const EXPLICACAO_FORMATO: Record<FormatoTorneio, string> = {
  eliminatoria:
    "Quem perde sai. Se faltar gente para fechar a chave, os cabeças de chave passam direto (folga).",
  grupos_eliminatoria:
    "Grupos de 3 ou 4, todos contra todos no grupo; os melhores de cada grupo vão para a eliminatória.",
  todos_contra_todos:
    "Cada inscrição joga uma vez contra todas as outras. Vence quem somar mais vitórias.",
};

export const ROTULO_SITUACAO_TORNEIO: Record<SituacaoTorneio, string> = {
  inscricoes: "Inscrições abertas",
  em_andamento: "Em andamento",
  encerrado: "Encerrado",
};

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Ranking geral
// ---------------------------------------------------------------------------

export interface LinhaDoRanking extends LinhaRanking {
  aluno: Aluno;
  /** Posicao no ranking geral (`posicao` e a da lista mostrada, ja filtrada). */
  posicaoGeral: number;
  /** Posicoes ganhas (+) ou perdidas (-) nos ultimos 7 dias. */
  variacao: number;
}

/**
 * Ranking calculado das partidas (H7), com a variacao de posicao desde 7 dias
 * atras. Com `categoria`, a lista e as posicoes sao so da categoria.
 */
export function rankingDaArena(
  banco: Banco,
  hoje: string,
  categoria?: CategoriaRanking,
): LinhaDoRanking[] {
  const alunoPorId = new Map(banco.alunos.map((a) => [a.id, a]));
  const daCategoria = (linha: LinhaRanking) =>
    !categoria || alunoPorId.get(linha.alunoId)?.categoriaRanking === categoria;

  const semanaPassada = calcularRanking(banco, somarDias(hoje, -7)).filter(daCategoria);
  const posicaoAntes = new Map(semanaPassada.map((linha, i) => [linha.alunoId, i + 1]));

  return calcularRanking(banco)
    .filter(daCategoria)
    .map((linha, i) => ({
      ...linha,
      aluno: alunoPorId.get(linha.alunoId) as Aluno,
      posicao: i + 1,
      posicaoGeral: linha.posicao,
      variacao: (posicaoAntes.get(linha.alunoId) ?? i + 1) - (i + 1),
    }));
}

export interface ResumoDoRanking {
  lider?: LinhaDoRanking;
  jogadores: number;
  /** Partidas de ranking com resultado nos ultimos 30 dias. */
  partidasRecentes: number;
  /** Proximo torneio com inscricoes abertas (ou o que esta em andamento). */
  proximoTorneio?: Torneio;
}

export function resumoDoRanking(
  banco: Banco,
  hoje: string,
  geral: LinhaDoRanking[],
): ResumoDoRanking {
  const desde = somarDias(hoje, -30);
  const abertos = banco.torneios
    .filter((t) => t.situacao === "inscricoes" && t.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data));
  return {
    lider: geral[0],
    jogadores: geral.length,
    partidasRecentes: banco.partidas.filter(
      (p) => !p.torneioId && p.vencedor && (p.data ?? "") >= desde && (p.data ?? "") <= hoje,
    ).length,
    proximoTorneio: abertos[0] ?? banco.torneios.find((t) => t.situacao === "em_andamento"),
  };
}

/** Quem pode jogar partida de ranking: inscritos no ranking e ativos, por nome. */
export function jogadoresDoRanking(banco: Banco): Aluno[] {
  return banco.alunos
    .filter((a) => a.inscritoRanking && a.ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/** Alunos ativos que podem se inscrever num torneio, por nome. */
export function alunosParaInscricao(banco: Banco): Aluno[] {
  return banco.alunos.filter((a) => a.ativo).sort((a, b) => a.nome.localeCompare(b.nome));
}

/** Quadras onde se marca partida (o paredao nao recebe partidas). */
export function quadrasParaPartida(banco: Banco): Quadra[] {
  return banco.quadras.filter((q) => q.id !== "paredao").sort((a, b) => a.ordem - b.ordem);
}

/**
 * Aviso antecipado de conflito para a reserva da partida (a regra que vale e
 * a da operacao). Ex.: "Quadra 2 ocupada das 19:00 às 20:00 (Individual · Ana)."
 */
export function conflitoDaReserva(banco: Banco, alvo: IntervaloNaQuadra): string | undefined {
  if (!alvo.data || !(alvo.horaInicio < alvo.horaFim)) return undefined;
  const conflito = conflitosNaQuadra(banco.ocupacoes, alvo)[0];
  if (!conflito) return undefined;
  return `${rotuloDaQuadra(alvo.quadraId)} ocupada das ${conflito.horaInicio} às ${conflito.horaFim} (${descreverOcupacao(banco, conflito)}).`;
}

// ---------------------------------------------------------------------------
// Partidas
// ---------------------------------------------------------------------------

export interface LadoDaPartida {
  /** "Ana Beatriz" (simples), "Ana Moraes / Bia Lima" (duplas) ou "A definir". */
  nome: string;
  alunos: Aluno[];
}

export interface PartidaNaLista {
  partida: Partida;
  a: LadoDaPartida;
  b: LadoDaPartida;
  torneio?: Torneio;
  /** Reserva de quadra ligada a partida. */
  reserva?: Ocupacao;
}

function nomeDoLado(alunos: Aluno[]): string {
  if (alunos.length === 0) return "A definir";
  if (alunos.length === 1) return alunos[0].nome;
  return alunos.map((a) => nomeCompacto(a.nome)).join(" / ");
}

/** Prepara a montagem das linhas (indices montados uma vez so). */
function montadorDePartidas(banco: Banco): (partida: Partida) => PartidaNaLista {
  const alunoPorId = new Map(banco.alunos.map((a) => [a.id, a]));
  const torneioPorId = new Map(banco.torneios.map((t) => [t.id, t]));
  const ligadas = new Set(banco.partidas.map((p) => p.ocupacaoId).filter(Boolean));
  const reservaPorId = new Map(
    banco.ocupacoes.filter((o) => ligadas.has(o.id)).map((o) => [o.id, o]),
  );
  const lado = (ids: string[]): LadoDaPartida => {
    const alunos = ids.map((id) => alunoPorId.get(id)).filter((a): a is Aluno => Boolean(a));
    return { nome: nomeDoLado(alunos), alunos };
  };
  return (partida) => ({
    partida,
    a: lado(partida.ladoA),
    b: lado(partida.ladoB),
    torneio: partida.torneioId ? torneioPorId.get(partida.torneioId) : undefined,
    reserva: partida.ocupacaoId ? reservaPorId.get(partida.ocupacaoId) : undefined,
  });
}

export type TipoDePartida = "todas" | "ranking" | "torneio";
export type SituacaoDePartida = "todas" | "jogadas" | "marcadas";

export interface FiltroDePartidas {
  /** Nome de jogador ou de torneio. */
  busca?: string;
  tipo?: TipoDePartida;
  situacao?: SituacaoDePartida;
  /** So a partir desta data. */
  desde?: string;
}

/** Historico de partidas, da mais recente para a mais antiga. */
export function listarPartidas(banco: Banco, filtro: FiltroDePartidas = {}): PartidaNaLista[] {
  const montar = montadorDePartidas(banco);
  const termo = semAcento(filtro.busca?.trim() ?? "");
  return banco.partidas
    .filter((p) => p.ladoA.length > 0 || p.ladoB.length > 0)
    .filter((p) =>
      filtro.tipo === "ranking" ? !p.torneioId : filtro.tipo === "torneio" ? Boolean(p.torneioId) : true,
    )
    .filter((p) =>
      filtro.situacao === "jogadas" ? Boolean(p.vencedor) : filtro.situacao === "marcadas" ? !p.vencedor : true,
    )
    .filter((p) => !filtro.desde || (p.data ?? "") >= filtro.desde)
    .map(montar)
    .filter(
      (item) =>
        !termo || semAcento(`${item.a.nome} ${item.b.nome} ${item.torneio?.nome ?? ""}`).includes(termo),
    )
    .sort(
      (x, y) =>
        (y.partida.data ?? "").localeCompare(x.partida.data ?? "") ||
        y.partida.criadoEm.localeCompare(x.partida.criadoEm),
    );
}

/**
 * Partidas sem resultado e com os dois lados definidos (de ranking e de
 * torneio): primeiro as atrasadas, depois as proximas, pela data e hora.
 */
export function proximasPartidas(banco: Banco, limite = 6): PartidaNaLista[] {
  const montar = montadorDePartidas(banco);
  return banco.partidas
    .filter((p) => !p.vencedor && p.ladoA.length > 0 && p.ladoB.length > 0)
    .map(montar)
    .sort(
      (x, y) =>
        (x.partida.data ?? "").localeCompare(y.partida.data ?? "") ||
        (x.reserva?.horaInicio ?? "99").localeCompare(y.reserva?.horaInicio ?? "99"),
    )
    .slice(0, limite);
}

export function buscarPartida(banco: Banco, id: string): PartidaNaLista | undefined {
  const partida = banco.partidas.find((p) => p.id === id);
  return partida ? montadorDePartidas(banco)(partida) : undefined;
}

// ---------------------------------------------------------------------------
// Torneios
// ---------------------------------------------------------------------------

export interface InscricaoNaTela {
  inscricao: TorneioInscrito;
  /** Nome do jogador (simples) ou "Ana Moraes / Bia Lima" (duplas). */
  nome: string;
  alunos: Aluno[];
}

function inscricoesDoTorneio(banco: Banco, torneioId: string): InscricaoNaTela[] {
  const alunoPorId = new Map(banco.alunos.map((a) => [a.id, a]));
  return banco.torneioInscritos
    .filter((i) => i.torneioId === torneioId)
    .map((inscricao) => {
      const alunos = inscricao.alunosIds
        .map((id) => alunoPorId.get(id))
        .filter((a): a is Aluno => Boolean(a));
      return { inscricao, nome: nomeDoLado(alunos), alunos };
    })
    // Cabecas de chave primeiro e, depois, a ordem de inscricao (a ordenacao e
    // estavel): e a mesma ordem do ultimo criterio de desempate.
    .sort((a, b) => (a.inscricao.cabecaDeChave ?? 99) - (b.inscricao.cabecaDeChave ?? 99));
}

export function buscarTorneio(banco: Banco, id: string): Torneio | undefined {
  return banco.torneios.find((t) => t.id === id);
}

export interface TorneioNaLista {
  torneio: Torneio;
  inscricoes: number;
  partidas: number;
  jogadas: number;
  campeao?: InscricaoNaTela;
}

const ORDEM_DA_SITUACAO: Record<SituacaoTorneio, number> = {
  em_andamento: 0,
  inscricoes: 1,
  encerrado: 2,
};

/** Em andamento primeiro, depois as inscricoes abertas e por fim os encerrados (mais recente antes). */
export function listarTorneios(banco: Banco): TorneioNaLista[] {
  const criterios = banco.configuracoes.criteriosDesempate;
  return banco.torneios
    .map((torneio) => {
      const partidas = banco.partidas.filter((p) => p.torneioId === torneio.id);
      const campeaoId = campeaoDoTorneio(torneio, banco.torneioInscritos, banco.partidas, criterios);
      return {
        torneio,
        inscricoes: banco.torneioInscritos.filter((i) => i.torneioId === torneio.id).length,
        partidas: partidas.length,
        jogadas: partidas.filter((p) => p.vencedor).length,
        campeao: campeaoId
          ? inscricoesDoTorneio(banco, torneio.id).find((i) => i.inscricao.id === campeaoId)
          : undefined,
      };
    })
    .sort(
      (a, b) =>
        ORDEM_DA_SITUACAO[a.torneio.situacao] - ORDEM_DA_SITUACAO[b.torneio.situacao] ||
        (a.torneio.situacao === "encerrado"
          ? b.torneio.data.localeCompare(a.torneio.data)
          : a.torneio.data.localeCompare(b.torneio.data)),
    );
}

// --- Chave do torneio ------------------------------------------------------

export interface LadoNaCaixa {
  inscricao?: InscricaoNaTela;
  /** Games de cada set deste lado, para o placar em colunas. */
  games: string[];
  venceu: boolean;
  /** Para lado ainda vazio: "Vencedor do jogo 2". */
  aguardando?: string;
}

export interface CaixaDePartida {
  tipo: "partida";
  partida: Partida;
  /** Numero do jogo no torneio (1, 2, 3...), para a recepcao se orientar. */
  numero: number;
  a: LadoNaCaixa;
  b: LadoNaCaixa;
}

export interface CaixaDeFolga {
  tipo: "folga";
  inscricao?: InscricaoNaTela;
}

export interface RodadaNaTela {
  rodada: number;
  nome: string;
  caixas: Array<CaixaDePartida | CaixaDeFolga>;
}

export interface LinhaNaTela extends LinhaDaClassificacao {
  inscricao: InscricaoNaTela;
  /** Na zona de classificacao do grupo. */
  classifica: boolean;
}

export interface GrupoNaTela {
  letra: string;
  classificacao: LinhaNaTela[];
  jogos: CaixaDePartida[];
  restantes: number;
}

export interface CelulaDaMatriz {
  partidaId: string;
  numero: number;
  /** Do ponto de vista da linha: venceu, perdeu ou ainda nao jogou. */
  venceu?: boolean;
  placar?: string;
}

export interface LinhaDaMatriz {
  inscricao: InscricaoNaTela;
  /** Uma celula por coluna (na mesma ordem das linhas); vazia na diagonal. */
  celulas: Array<CelulaDaMatriz | undefined>;
}

export interface DetalheDoTorneio {
  torneio: Torneio;
  inscricoes: InscricaoNaTela[];
  /** O que a chave tera (ou por que ainda nao da para gerar). */
  previa: PreviaDaChave;
  total: number;
  jogadas: number;
  campeao?: InscricaoNaTela;
  /** Todos os jogos, numerados, na ordem do torneio. */
  jogos: CaixaDePartida[];
  eliminatoria: RodadaNaTela[];
  grupos: GrupoNaTela[];
  /** Todos contra todos: classificacao e matriz de confrontos. */
  classificacao: LinhaNaTela[];
  matriz: LinhaDaMatriz[];
  classificadosPorGrupo: number;
  podeDesfazerChave: boolean;
}

/** Jogos de grupo primeiro (por grupo), depois a eliminatoria; dentro, por rodada e ordem. */
function ordemDosJogos(a: Partida, b: Partida): number {
  return (
    Number(!a.grupo) - Number(!b.grupo) ||
    (a.grupo ?? "").localeCompare(b.grupo ?? "") ||
    (a.rodada ?? 0) - (b.rodada ?? 0) ||
    (a.ordem ?? 0) - (b.ordem ?? 0)
  );
}

export function detalheDoTorneio(banco: Banco, id: string): DetalheDoTorneio | undefined {
  const torneio = buscarTorneio(banco, id);
  if (!torneio) return undefined;
  const { criteriosDesempate, classificadosPorGrupo } = banco.configuracoes;

  const inscricoes = inscricoesDoTorneio(banco, torneio.id);
  const porId = new Map(inscricoes.map((i) => [i.inscricao.id, i]));
  // A classificacao recebe as inscricoes na ordem do banco (a ordem de
  // inscricao, ultimo criterio de desempate), a mesma usada pela operacao
  // que monta a eliminatoria. A lista da tela e que vem por nome.
  const naOrdemDeInscricao = banco.torneioInscritos.filter((i) => i.torneioId === torneio.id);
  const partidas = banco.partidas.filter((p) => p.torneioId === torneio.id).sort(ordemDosJogos);
  const numeroDe = new Map(partidas.map((p, i) => [p.id, i + 1]));

  const lado = (partida: Partida, qual: "A" | "B"): LadoNaCaixa => {
    const inscricaoId = qual === "A" ? partida.inscricaoAId : partida.inscricaoBId;
    const sets = partida.wo ? [] : (lerPlacar(partida.placar ?? "") ?? []);
    const origem = inscricaoId
      ? undefined
      : partidas.find((p) => p.proximaPartidaId === partida.id && p.ladoNaProxima === qual);
    return {
      inscricao: inscricaoId ? porId.get(inscricaoId) : undefined,
      games: sets.map((s) => String(qual === "A" ? s.a : s.b)),
      venceu: partida.vencedor === qual,
      aguardando: origem ? `Vencedor do jogo ${numeroDe.get(origem.id)}` : undefined,
    };
  };
  const caixa = (partida: Partida): CaixaDePartida => ({
    tipo: "partida",
    partida,
    numero: numeroDe.get(partida.id) ?? 0,
    a: lado(partida, "A"),
    b: lado(partida, "B"),
  });
  const linhas = (membros: TorneioInscrito[], jogos: Partida[], vagas: number): LinhaNaTela[] =>
    classificar(membros, jogos, criteriosDesempate).map((linha) => ({
      ...linha,
      inscricao: porId.get(linha.inscricaoId) as InscricaoNaTela,
      classifica: linha.posicao <= vagas,
    }));

  // Eliminatoria: rodada a rodada, com as folgas da 1a rodada no lugar delas.
  const eliminatoria = partidasDaEliminatoria(torneio, partidas);
  const totalDeRodadas = Math.max(0, ...eliminatoria.map((p) => p.rodada ?? 0));
  const rodadas: RodadaNaTela[] = Array.from({ length: totalDeRodadas }, (_, r) => {
    const rodada = r + 1;
    const quantas = 2 ** (totalDeRodadas - rodada);
    return {
      rodada,
      nome: nomeDaFase(rodada, totalDeRodadas),
      caixas: Array.from({ length: quantas }, (_, i): CaixaDePartida | CaixaDeFolga => {
        const partida = eliminatoria.find((p) => p.rodada === rodada && p.ordem === i + 1);
        if (partida) return caixa(partida);
        // Folga: quem a recebeu ja esta na partida seguinte.
        const seguinte = eliminatoria.find(
          (p) => p.rodada === rodada + 1 && p.ordem === Math.floor(i / 2) + 1,
        );
        const inscricaoId = i % 2 === 0 ? seguinte?.inscricaoAId : seguinte?.inscricaoBId;
        return { tipo: "folga", inscricao: inscricaoId ? porId.get(inscricaoId) : undefined };
      }),
    };
  });

  // Grupos.
  const letras = [...new Set(inscricoes.map((i) => i.inscricao.grupo).filter(Boolean))].sort() as string[];
  const grupos: GrupoNaTela[] = letras.map((letra) => {
    const jogos = partidas.filter((p) => p.grupo === letra);
    return {
      letra,
      classificacao: linhas(
        naOrdemDeInscricao.filter((i) => i.grupo === letra),
        jogos,
        classificadosPorGrupo,
      ),
      jogos: jogos.map(caixa),
      restantes: jogos.filter((p) => !p.vencedor).length,
    };
  });

  // Todos contra todos: classificacao e matriz (linhas e colunas na ordem da tabela).
  const todosContraTodos = torneio.formato === "todos_contra_todos" && partidas.length > 0;
  const classificacao = todosContraTodos ? linhas(naOrdemDeInscricao, partidas, 1) : [];
  const matriz: LinhaDaMatriz[] = classificacao.map((linha) => ({
    inscricao: linha.inscricao,
    celulas: classificacao.map((coluna) => {
      if (coluna.inscricaoId === linha.inscricaoId) return undefined;
      const partida = partidas.find(
        (p) =>
          (p.inscricaoAId === linha.inscricaoId && p.inscricaoBId === coluna.inscricaoId) ||
          (p.inscricaoBId === linha.inscricaoId && p.inscricaoAId === coluna.inscricaoId),
      );
      if (!partida) return undefined;
      const daLinhaEhA = partida.inscricaoAId === linha.inscricaoId;
      return {
        partidaId: partida.id,
        numero: numeroDe.get(partida.id) ?? 0,
        venceu: partida.vencedor ? partida.vencedor === (daLinhaEhA ? "A" : "B") : undefined,
        placar: partida.placar && !daLinhaEhA ? inverterPlacar(partida.placar) : partida.placar,
      };
    }),
  }));

  const campeaoId = campeaoDoTorneio(torneio, banco.torneioInscritos, banco.partidas, criteriosDesempate);
  return {
    torneio,
    inscricoes,
    previa: previaDaChave(torneio.formato, inscricoes.length, classificadosPorGrupo),
    total: partidas.length,
    jogadas: partidas.filter((p) => p.vencedor).length,
    campeao: campeaoId ? porId.get(campeaoId) : undefined,
    jogos: partidas.map(caixa),
    eliminatoria: rodadas,
    grupos,
    classificacao,
    matriz,
    classificadosPorGrupo,
    podeDesfazerChave: torneio.situacao !== "inscricoes" && !partidas.some((p) => p.vencedor),
  };
}

/** Por que o resultado da partida de torneio nao pode mais mudar (vazio = pode). */
export function bloqueioDaPartida(banco: Banco, partidaId: string): string | undefined {
  const partida = banco.partidas.find((p) => p.id === partidaId);
  const torneio = partida?.torneioId ? buscarTorneio(banco, partida.torneioId) : undefined;
  if (!partida || !torneio) return undefined;
  return bloqueioDeCorrecao(torneio, banco.partidas, partida);
}

/**
 * Ranking e torneios: ligacao das operacoes de `src/lib/banco/operacoes/ranking.ts`
 * ao banco real. Todas viram funcoes do banco (mapa completo em
 * `docs/modulos/ranking.md`, secao "No banco (funções)").
 *
 * Gerar a chave: a tela sorteia quem nao e cabeca de chave e mostra a chave
 * sorteada. Para o banco gravar EXATAMENTE essa chave, a ordem sorteada vai em
 * `p_sorteio` (veja `ordemSorteadaNaTela`).
 */

import {
  apagarResultadoDeTorneio,
  corrigirResultadoDePartida,
  corrigirResultadoDeTorneio,
  criarTorneio,
  desfazerChaveDoTorneio,
  editarTorneio,
  excluirPartida,
  gerarChaveDoTorneio,
  marcarPartida,
  registrarPartida,
  registrarResultadoDePartida,
  registrarResultadoDeTorneio,
  type DadosResultadoDePartida,
  type DadosResultadoDeTorneio,
} from "@/lib/banco/operacoes/ranking";
import type { ResultadoDigitado } from "@/lib/banco/regras/ranking";
import { gerarChave } from "@/lib/banco/regras/torneios";
import type { Partida, TabelaDoBanco, TorneioInscrito } from "@/lib/banco/tipos";
import { ligar, porFuncao, type ContextoGravacao } from "../gravar";

// Tabelas que cada grupo de funcoes pode mudar.
const PARTIDA: TabelaDoBanco[] = ["partidas"];
// A reserva da partida de ranking e uma ocupacao "Ranking" com os dois jogadores.
const PARTIDA_COM_RESERVA: TabelaDoBanco[] = ["partidas", "ocupacoes", "ocupacaoAlunos"];
const TORNEIO: TabelaDoBanco[] = ["torneios", "torneioInscritos"];
// Grupos: gerar/desfazer a chave preenche/limpa o grupo das inscricoes.
const CHAVE: TabelaDoBanco[] = ["torneios", "torneioInscritos", "partidas"];
// Resultado de torneio: partidas (avanco, eliminatoria dos grupos) e situacao.
const RESULTADO_DE_TORNEIO: TabelaDoBanco[] = ["partidas", "torneios"];

/** Placar, vencedor e W.O. como a funcao do banco recebe ("" = nao informado). */
function resultado(d: ResultadoDigitado) {
  return { p_placar: d.placar || undefined, p_vencedor: d.vencedor || undefined, p_wo: d.wo ?? false };
}

// ---------------------------------------------------------------------------
// Partidas de ranking
// ---------------------------------------------------------------------------

ligar(
  registrarPartida,
  porFuncao(
    "registrar_partida",
    (d) => ({ p_jogador_a: d.jogadorA, p_jogador_b: d.jogadorB, p_data: d.data, ...resultado(d) }),
    PARTIDA,
  ),
);

ligar(
  marcarPartida,
  porFuncao(
    "marcar_partida",
    (d) => ({
      p_jogador_a: d.jogadorA,
      p_jogador_b: d.jogadorB,
      p_data: d.data,
      p_reserva: d.reserva
        ? { quadraId: d.reserva.quadraId, horaInicio: d.reserva.horaInicio, horaFim: d.reserva.horaFim }
        : undefined,
    }),
    PARTIDA_COM_RESERVA,
  ),
);

// Com reserva, a data e a da reserva (a tela manda vazia; o banco ignora).
const resultadoDePartida = (d: DadosResultadoDePartida) => ({
  p_id: d.id,
  ...resultado(d),
  p_data: d.data || undefined,
});

ligar(
  registrarResultadoDePartida,
  porFuncao("registrar_resultado_de_partida", resultadoDePartida, PARTIDA),
);

ligar(
  corrigirResultadoDePartida,
  porFuncao("corrigir_resultado_de_partida", resultadoDePartida, PARTIDA),
);

// A reserva futura ligada a partida e cancelada junto.
ligar(excluirPartida, porFuncao("excluir_partida", (d) => ({ p_id: d.id }), PARTIDA_COM_RESERVA));

// ---------------------------------------------------------------------------
// Torneios: cadastro e chave
// ---------------------------------------------------------------------------

// O banco cria os ids do torneio e das inscricoes; a tela abre o torneio pelo
// id devolvido (`resultado.id`).
ligar(
  criarTorneio,
  porFuncao(
    "criar_torneio",
    (d) => ({
      p_nome: d.nome,
      p_data: d.data,
      p_formato: d.formato,
      p_duplas: d.duplas,
      p_categoria: d.categoria || undefined,
      p_inscricoes: d.inscricoes.map((i) => ({ alunosIds: i.alunosIds, cabecaDeChave: i.cabecaDeChave })),
    }),
    TORNEIO,
  ),
);

// Inscricao com `id` (lido do banco) e mantida; sem `id`, e nova. Sem lista
// (chave ja gerada), o banco nao mexe nas inscricoes.
ligar(
  editarTorneio,
  porFuncao(
    "editar_torneio",
    (d) => ({
      p_id: d.id,
      p_nome: d.nome,
      p_data: d.data,
      p_formato: d.formato,
      p_duplas: d.duplas,
      p_categoria: d.categoria || undefined,
      p_inscricoes: d.inscricoes?.map((i) => ({
        id: i.id,
        alunosIds: i.alunosIds,
        cabecaDeChave: i.cabecaDeChave,
      })),
    }),
    TORNEIO,
  ),
);

/** Posicao de um lado de partida na chave (os ids das partidas mudam no banco). */
function vagas(partidas: Partida[]): Array<[string, string | undefined]> {
  return partidas.flatMap((p) => {
    const lugar = `${p.grupo ?? ""}|${p.rodada ?? ""}|${p.ordem ?? ""}`;
    return [
      [`${lugar}|A`, p.inscricaoAId],
      [`${lugar}|B`, p.inscricaoBId],
    ];
  });
}

/**
 * Ordem das inscricoes que a tela usou ao gerar a chave (cabecas de chave pelo
 * numero, depois os demais na ordem sorteada), lida da chave que ela montou em
 * `ctx.depois`. A chave so depende dessa ordem: monta-se a mesma chave com
 * inscricoes "numeradas" (1a, 2a, 3a...) e cada vaga diz quem estava em cada
 * posicao.
 */
function ordemSorteadaNaTela(ctx: ContextoGravacao, torneioId: string): string[] {
  const torneio = ctx.depois.torneios.find((t) => t.id === torneioId);
  const inscritos = ctx.antes.torneioInscritos.filter((i) => i.torneioId === torneioId);
  const novas = ctx.depois.partidas.filter((p) => p.torneioId === torneioId);
  if (!torneio) throw new Error("Torneio não encontrado na tela.");

  const numeradas: TorneioInscrito[] = inscritos.map((_, n) => ({
    id: String(n),
    torneioId,
    alunosIds: [],
  }));
  const molde = gerarChave(torneio, numeradas, {
    prefixoId: "molde",
    criadoEm: "",
    classificadosPorGrupo: ctx.depois.configuracoes.classificadosPorGrupo,
  });

  const naTela = new Map(vagas(novas));
  const ordem: string[] = [];
  for (const [vaga, posicao] of vagas(molde.partidas)) {
    if (posicao !== undefined) ordem[Number(posicao)] ??= naTela.get(vaga) ?? "";
  }
  if (ordem.length !== inscritos.length || ordem.some((id) => !id) || new Set(ordem).size !== ordem.length) {
    throw new Error("Não foi possível ler a ordem sorteada da chave.");
  }
  return ordem;
}

ligar(
  gerarChaveDoTorneio,
  porFuncao(
    "gerar_chave_do_torneio",
    (d, ctx) => ({ p_id: d.id, p_sorteio: ordemSorteadaNaTela(ctx, d.id) }),
    CHAVE,
  ),
);

ligar(desfazerChaveDoTorneio, porFuncao("desfazer_chave_do_torneio", (d) => ({ p_id: d.id }), CHAVE));

// ---------------------------------------------------------------------------
// Torneios: resultados (o banco leva o vencedor para a partida seguinte e,
// nos grupos, monta a eliminatoria quando o ultimo jogo termina)
// ---------------------------------------------------------------------------

const resultadoDeTorneio = (d: DadosResultadoDeTorneio) => ({
  p_partida_id: d.partidaId,
  ...resultado(d),
  p_data: d.data || undefined,
});

ligar(
  registrarResultadoDeTorneio,
  porFuncao("registrar_resultado_de_torneio", resultadoDeTorneio, RESULTADO_DE_TORNEIO),
);

ligar(
  corrigirResultadoDeTorneio,
  porFuncao("corrigir_resultado_de_torneio", resultadoDeTorneio, RESULTADO_DE_TORNEIO),
);

ligar(
  apagarResultadoDeTorneio,
  porFuncao("apagar_resultado_de_torneio", (d) => ({ p_partida_id: d.partidaId }), RESULTADO_DE_TORNEIO),
);

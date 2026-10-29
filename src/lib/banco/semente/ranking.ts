/**
 * Dados de exemplo: ranking e torneios.
 *
 * - Partidas de ranking: uma para cada reserva de quadra do tipo "Ranking".
 *   As passadas tem resultado; quem tem mais nivel tende a vencer.
 * - Torneios: um em inscricoes, um em andamento (duplas) e um encerrado,
 *   cobrindo os tres formatos da v1. As chaves sao geradas pelos mesmos
 *   geradores que a tela usa (`regras/torneios.ts`), e os resultados entram
 *   por `aplicarResultado`, que leva o vencedor adiante.
 */

import { somarDias } from "../../date";
import { HOJE } from "../constantes";
import { aplicarResultado, gerarChave } from "../regras/torneios";
import type { Ocupacao, OcupacaoAluno, Partida, Torneio, TorneioInscrito } from "../tipos";
import { criarRng, embaralhar, inteiro, type Sorteio } from "./aleatorio";
import { DATA_TORNEIO_INTERNO } from "./agenda";
import { CONFIGURACOES_INICIAIS, PERFIL_POR_ALUNO, PERFIS_DE_SEMENTE } from "./cadastros";

export interface RankingGerado {
  torneios: Torneio[];
  torneioInscritos: TorneioInscrito[];
  partidas: Partida[];
}

/** Chance de A vencer B pela diferenca de nivel (curva tipo Elo). */
function chanceDeVitoria(forcaA: number, forcaB: number): number {
  return 1 / (1 + 10 ** ((forcaB - forcaA) / 400));
}

/** Placar de tenis plausivel em sets, do ponto de vista do vencedor. */
function placarDoVencedor(rng: Sorteio): string[] {
  const set = () => {
    const perdedor = inteiro(rng, 0, 5);
    return perdedor === 5 ? "7/5" : `6/${perdedor}`;
  };
  if (rng() < 0.7) return [set(), set()];
  const perdido = inteiro(rng, 0, 4);
  return [set(), `${perdido}/6`, `10/${inteiro(rng, 3, 8)}`];
}

/** Inverte "6/4" para "4/6" (placar visto pelo lado A quando B venceu). */
function inverter(sets: string[]): string {
  return sets
    .map((s) => s.split("/").reverse().join("/"))
    .join(" ");
}

/** Nivel de uma inscricao de torneio (dupla = media dos dois). */
function forcaDaInscricao(inscricao: TorneioInscrito | undefined): number {
  const forcas = (inscricao?.alunosIds ?? []).map((id) => PERFIL_POR_ALUNO.get(id)?.forca ?? 1000);
  return forcas.length ? forcas.reduce((soma, f) => soma + f, 0) / forcas.length : 1000;
}

/** Joga uma partida da chave e leva o vencedor adiante. */
function jogarPartidaDaChave(
  rng: Sorteio,
  partidas: Partida[],
  partidaId: string,
  inscritos: TorneioInscrito[],
  data: string,
  wo = false,
): Partida[] {
  const partida = partidas.find((p) => p.id === partidaId);
  const forcaA = forcaDaInscricao(inscritos.find((i) => i.id === partida?.inscricaoAId));
  const forcaB = forcaDaInscricao(inscritos.find((i) => i.id === partida?.inscricaoBId));
  const vencedor = rng() < chanceDeVitoria(forcaA, forcaB) ? "A" : "B";
  if (wo) return aplicarResultado(partidas, partidaId, { placar: "W.O.", vencedor, wo: true, data });
  const sets = placarDoVencedor(rng);
  const placar = vencedor === "A" ? sets.join(" ") : inverter(sets);
  return aplicarResultado(partidas, partidaId, { placar, vencedor, wo: false, data });
}

export function gerarRanking(
  ocupacoes: Ocupacao[],
  ocupacaoAlunos: OcupacaoAluno[],
): RankingGerado {
  const rng = criarRng(7331);

  // --- Partidas de ranking --------------------------------------------------
  const jogadores = new Map<string, string[]>();
  ocupacaoAlunos.forEach((p) => {
    const lista = jogadores.get(p.ocupacaoId) ?? [];
    lista.push(p.alunoId);
    jogadores.set(p.ocupacaoId, lista);
  });

  const partidas: Partida[] = [];
  ocupacoes
    .filter((o) => o.tipo === "Ranking" && o.situacao !== "cancelada")
    .forEach((ocupacao) => {
      const [a, b] = jogadores.get(ocupacao.id) ?? [];
      if (!a || !b) return;
      const partida: Partida = {
        id: `pt-${ocupacao.id}`,
        data: ocupacao.data,
        ladoA: [a],
        ladoB: [b],
        ocupacaoId: ocupacao.id,
        criadoEm: ocupacao.criadoEm,
      };

      if (ocupacao.data < HOJE) {
        const forcaA = PERFIL_POR_ALUNO.get(a)?.forca ?? 1000;
        const forcaB = PERFIL_POR_ALUNO.get(b)?.forca ?? 1000;
        const vencedor = rng() < chanceDeVitoria(forcaA, forcaB) ? "A" : "B";
        partida.vencedor = vencedor;
        if (rng() < 0.04) {
          partida.wo = true;
          partida.placar = "W.O.";
        } else {
          const sets = placarDoVencedor(rng);
          partida.placar = vencedor === "A" ? sets.join(" ") : inverter(sets);
        }
      }
      partidas.push(partida);
    });

  // --- Torneios ---------------------------------------------------------------
  const torneios: Torneio[] = [
    {
      id: "t-1",
      nome: "Torneio Interno · Categoria B",
      data: DATA_TORNEIO_INTERNO,
      formato: "grupos_eliminatoria",
      categoria: "B",
      duplas: false,
      situacao: "inscricoes",
      criadoEm: `${somarDias(HOJE, -20)}T10:00:00`,
    },
    {
      id: "t-2",
      nome: "Torneio de Duplas do Saibro",
      data: somarDias(HOJE, -3),
      formato: "eliminatoria",
      duplas: true,
      situacao: "em_andamento",
      criadoEm: `${somarDias(HOJE, -30)}T10:00:00`,
    },
    {
      id: "t-3",
      nome: "Copa Red Tennis · Etapa 3",
      data: somarDias(HOJE, -38),
      formato: "todos_contra_todos",
      categoria: "A",
      duplas: false,
      situacao: "encerrado",
      criadoEm: `${somarDias(HOJE, -60)}T10:00:00`,
    },
  ];

  const principais = PERFIS_DE_SEMENTE.filter((p) => p.principal && !p.congelado).sort(
    (a, b) => b.forca - a.forca,
  );
  const torneioInscritos: TorneioInscrito[] = [];

  // t-1: categoria B e os dois melhores da C (8 inscritos, 2 cabecas de chave).
  principais
    .filter((p) => p.categoriaRanking === "B" || p.alunoId === "a11" || p.alunoId === "a12")
    .forEach((p, i) =>
      torneioInscritos.push({
        id: `ti-t-1-${p.alunoId}`,
        torneioId: "t-1",
        alunosIds: [p.alunoId],
        cabecaDeChave: i < 2 ? i + 1 : undefined,
      }),
    );

  // t-2: 6 duplas (numero que nao fecha a chave: 2 cabecas de chave passam direto).
  const paraDuplas = embaralhar(rng, principais.slice(4, 16));
  for (let i = 0; i < 6; i += 1) {
    torneioInscritos.push({
      id: `ti-t-2-${i + 1}`,
      torneioId: "t-2",
      alunosIds: [paraDuplas[i * 2].alunoId, paraDuplas[i * 2 + 1].alunoId],
      cabecaDeChave: i < 2 ? i + 1 : undefined,
    });
  }

  // t-3: os 5 primeiros (todos contra todos = 10 partidas).
  principais.slice(0, 5).forEach((p) =>
    torneioInscritos.push({
      id: `ti-t-3-${p.alunoId}`,
      torneioId: "t-3",
      alunosIds: [p.alunoId],
    }),
  );

  // --- Chaves de t-2 e t-3 ----------------------------------------------------
  // Sorteio proprio, para nao mudar os dados gerados acima. O t-1 continua
  // com as inscricoes abertas (sem chave).
  const rngChaves = criarRng(8080);
  const gerar = (torneioId: string) => {
    const torneio = torneios.find((t) => t.id === torneioId) as Torneio;
    const inscritos = torneioInscritos.filter((i) => i.torneioId === torneioId);
    const chave = gerarChave(torneio, inscritos, {
      prefixoId: `pt-${torneioId}`,
      criadoEm: `${somarDias(torneio.data, -2)}T18:00:00`,
      classificadosPorGrupo: CONFIGURACOES_INICIAIS.classificadosPorGrupo,
    });
    return { torneio, inscritos, partidas: chave.partidas };
  };

  // t-2 (em andamento): jogadas as quartas e a 1a semifinal; a outra
  // semifinal e a final foram remarcadas para o fim de semana.
  const duplas = gerar("t-2");
  let chaveDuplas = duplas.partidas;
  const jogarDuplas = (quais: (p: Partida) => boolean) =>
    chaveDuplas.filter(quais).forEach((p) => {
      chaveDuplas = jogarPartidaDaChave(rngChaves, chaveDuplas, p.id, duplas.inscritos, duplas.torneio.data);
    });
  jogarDuplas((p) => p.rodada === 1);
  jogarDuplas((p) => p.rodada === 2 && p.ordem === 1);
  const remarcadas = somarDias(HOJE, 3);
  chaveDuplas = chaveDuplas.map((p) => (p.vencedor ? p : { ...p, data: remarcadas }));

  // t-3 (encerrado): as 10 partidas jogadas no dia, uma delas por W.O.
  const copa = gerar("t-3");
  let chaveCopa = copa.partidas;
  copa.partidas.forEach((p, i) => {
    chaveCopa = jogarPartidaDaChave(rngChaves, chaveCopa, p.id, copa.inscritos, copa.torneio.data, i === 6);
  });

  return { torneios, torneioInscritos, partidas: [...partidas, ...chaveDuplas, ...chaveCopa] };
}

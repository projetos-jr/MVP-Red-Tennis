/**
 * Operacoes do ranking e dos torneios.
 *
 * Partidas de ranking: registrar o resultado de uma partida jogada, marcar
 * uma partida futura (com reserva de quadra opcional), registrar ou corrigir
 * o resultado e excluir. Torneios: criar, editar, gerar e desfazer a chave,
 * registrar, corrigir e apagar resultados (o vencedor avanca sozinho).
 *
 * As regras ficam em `regras/ranking.ts` (placar) e `regras/torneios.ts`
 * (chaves e classificacao); aqui elas viram gravacoes "tudo ou nada".
 */

import { formatarData } from "../../date";
import { definirOperacao, type ContextoOperacao } from "../executar";
import { garantirHorarioValido, garantirQuadraLivre } from "../regras/agenda";
import { exigir, novoId } from "../regras/comum";
import { validarResultado, type ResultadoDigitado } from "../regras/ranking";
import {
  aplicarResultado,
  atualizarFaseEliminatoria,
  bloqueioDeCorrecao,
  desfazerResultado,
  gerarChave,
  sortearInscritos,
  torneioTerminou,
  validarInscricoes,
  type InscricaoDigitada,
} from "../regras/torneios";
import type {
  Aluno,
  Banco,
  CategoriaRanking,
  FormatoTorneio,
  Ocupacao,
  OcupacaoAluno,
  Partida,
  QuadraId,
  SituacaoTorneio,
  Torneio,
  TorneioInscrito,
} from "../tipos";

// ---------------------------------------------------------------------------
// Pecas comuns
// ---------------------------------------------------------------------------

/** H9: so quem enxerga o modulo de ranking grava nele. */
function garantirAcesso(banco: Banco, ctx: ContextoOperacao): void {
  exigir(
    banco.configuracoes.permissoes[ctx.usuario.perfil]?.includes("ranking"),
    "Seu perfil não tem acesso ao ranking e aos torneios.",
  );
}

function dataValida(data: string | undefined): data is string {
  return /^\d{4}-\d{2}-\d{2}$/.test(data ?? "");
}

/** Jogador de partida de ranking: aluno ativo e inscrito no ranking. */
function jogadorDoRanking(banco: Banco, alunoId: string, papel: string): Aluno {
  const aluno = banco.alunos.find((a) => a.id === alunoId);
  exigir(aluno, `Escolha o ${papel}.`);
  exigir(aluno.ativo, `${aluno.nome} não está ativo na arena.`);
  exigir(aluno.inscritoRanking, `${aluno.nome} não está inscrito no ranking.`);
  return aluno;
}

/** Nome de cada lado de uma partida, para as mensagens ("Ana", "Ana / Bia"). */
function nomesDosLados(banco: Banco, partida: Partida): { A: string; B: string } {
  const nome = (ids: string[]) =>
    ids.map((id) => banco.alunos.find((a) => a.id === id)?.nome ?? "?").join(" / ") || "?";
  return { A: nome(partida.ladoA), B: nome(partida.ladoB) };
}

function mudarSituacao(banco: Banco, torneio: Torneio, situacao: SituacaoTorneio): Torneio[] {
  if (torneio.situacao === situacao) return banco.torneios;
  return banco.torneios.map((t): Torneio => (t.id === torneio.id ? { ...t, situacao } : t));
}

// ---------------------------------------------------------------------------
// Partidas de ranking
// ---------------------------------------------------------------------------

export interface DadosPartidaJogada extends ResultadoDigitado {
  jogadorA: string;
  jogadorB: string;
  data: string;
}

/** Resultado de uma partida de ranking que ja aconteceu. A pontuacao e recalculada sozinha. */
export const registrarPartida = definirOperacao(
  "Registrar partida de ranking",
  (banco, dados: DadosPartidaJogada, ctx) => {
    garantirAcesso(banco, ctx);
    const a = jogadorDoRanking(banco, dados.jogadorA, "jogador A");
    const b = jogadorDoRanking(banco, dados.jogadorB, "jogador B");
    exigir(a.id !== b.id, "Escolha dois jogadores diferentes.");
    exigir(dataValida(dados.data), "Informe a data da partida.");
    exigir(
      dados.data <= ctx.hoje,
      "Essa data ainda não chegou: para uma partida futura, use “Marcar partida”.",
    );
    const resultado = validarResultado(dados, { A: a.nome, B: b.nome });

    const partida: Partida = {
      id: novoId("pt"),
      data: dados.data,
      ladoA: [a.id],
      ladoB: [b.id],
      placar: resultado.placar,
      vencedor: resultado.vencedor,
      wo: resultado.wo || undefined,
      criadoEm: ctx.agora,
    };
    return { ...banco, partidas: [...banco.partidas, partida] };
  },
);

export interface ReservaDaPartida {
  quadraId: QuadraId;
  horaInicio: string;
  horaFim: string;
}

export interface DadosPartidaMarcada {
  jogadorA: string;
  jogadorB: string;
  data: string;
  /** Opcional: reserva a quadra (ocupacao "Ranking", roxa na agenda). */
  reserva?: ReservaDaPartida;
}

/**
 * Partida de ranking marcada para hoje ou depois. Com reserva, cria a
 * ocupacao do tipo "Ranking" (com a checagem de conflito de quadra) e a liga
 * a partida. A reserva de ranking nao gera cobranca (como nos dados de exemplo).
 */
export const marcarPartida = definirOperacao(
  "Marcar partida de ranking",
  (banco, dados: DadosPartidaMarcada, ctx) => {
    garantirAcesso(banco, ctx);
    const a = jogadorDoRanking(banco, dados.jogadorA, "jogador A");
    const b = jogadorDoRanking(banco, dados.jogadorB, "jogador B");
    exigir(a.id !== b.id, "Escolha dois jogadores diferentes.");
    exigir(dataValida(dados.data), "Informe a data da partida.");
    exigir(
      dados.data >= ctx.hoje,
      "Essa data já passou: para uma partida que já aconteceu, registre o resultado.",
    );

    let ocupacoes = banco.ocupacoes;
    let ocupacaoAlunos = banco.ocupacaoAlunos;
    let ocupacaoId: string | undefined;

    if (dados.reserva) {
      const { quadraId, horaInicio, horaFim } = dados.reserva;
      exigir(quadraId !== "paredao", "O paredão não recebe partidas: escolha uma das quadras 1 a 4.");
      garantirHorarioValido(horaInicio, horaFim);
      const alvo = { quadraId, data: dados.data, horaInicio, horaFim };
      garantirQuadraLivre(banco, alvo);

      const ocupacao: Ocupacao = {
        id: novoId("oc"),
        ...alvo,
        tipo: "Ranking",
        situacao: "agendada",
        criadoEm: ctx.agora,
      };
      ocupacaoId = ocupacao.id;
      const participantes: OcupacaoAluno[] = [a.id, b.id].map((alunoId) => ({
        id: novoId("pa"),
        ocupacaoId: ocupacao.id,
        alunoId,
        presenca: "a_marcar",
      }));
      ocupacoes = [...banco.ocupacoes, ocupacao];
      ocupacaoAlunos = [...banco.ocupacaoAlunos, ...participantes];
    }

    const partida: Partida = {
      id: novoId("pt"),
      data: dados.data,
      ladoA: [a.id],
      ladoB: [b.id],
      ocupacaoId,
      criadoEm: ctx.agora,
    };
    return { ...banco, ocupacoes, ocupacaoAlunos, partidas: [...banco.partidas, partida] };
  },
);

export interface DadosResultadoDePartida extends ResultadoDigitado {
  id: string;
  /** Ignorada quando a partida tem reserva: a data e a da reserva. */
  data?: string;
}

function gravarResultadoDeRanking(
  banco: Banco,
  dados: DadosResultadoDePartida,
  ctx: ContextoOperacao,
  correcao: boolean,
): Banco {
  garantirAcesso(banco, ctx);
  const partida = banco.partidas.find((p) => p.id === dados.id);
  exigir(partida, "Partida não encontrada.");
  exigir(!partida.torneioId, "O resultado de partida de torneio é registrado na chave do torneio.");
  exigir(
    correcao ? partida.vencedor : !partida.vencedor,
    correcao ? "Esta partida ainda não tem resultado." : "Esta partida já tem resultado: use a correção.",
  );

  // Partida com reserva de quadra fica na data da reserva.
  const reserva = partida.ocupacaoId
    ? banco.ocupacoes.find((o) => o.id === partida.ocupacaoId)
    : undefined;
  const data = reserva ? reserva.data : (dados.data ?? partida.data);
  exigir(dataValida(data), "Informe a data da partida.");
  exigir(
    data <= ctx.hoje,
    reserva
      ? `A partida está marcada para ${formatarData(data)}: o resultado entra a partir desse dia.`
      : "A data da partida não pode ser depois de hoje.",
  );
  const resultado = validarResultado(dados, nomesDosLados(banco, partida));

  return {
    ...banco,
    partidas: banco.partidas.map((p) =>
      p.id === partida.id
        ? { ...p, data, placar: resultado.placar, vencedor: resultado.vencedor, wo: resultado.wo || undefined }
        : p,
    ),
  };
}

/** Resultado de uma partida de ranking que estava marcada. */
export const registrarResultadoDePartida = definirOperacao(
  "Registrar resultado de partida de ranking",
  (banco, dados: DadosResultadoDePartida, ctx) => gravarResultadoDeRanking(banco, dados, ctx, false),
);

/** Correcao de resultado (a auditoria guarda como era e como ficou). */
export const corrigirResultadoDePartida = definirOperacao(
  "Corrigir resultado de partida de ranking",
  (banco, dados: DadosResultadoDePartida, ctx) => gravarResultadoDeRanking(banco, dados, ctx, true),
);

/** Exclui uma partida de ranking; a reserva de quadra futura ligada a ela e cancelada junto. */
export const excluirPartida = definirOperacao(
  "Excluir partida de ranking",
  (banco, dados: { id: string }, ctx) => {
    garantirAcesso(banco, ctx);
    const partida = banco.partidas.find((p) => p.id === dados.id);
    exigir(partida, "Partida não encontrada.");
    exigir(
      !partida.torneioId,
      "Partidas de torneio não são excluídas uma a uma: desfaça a chave do torneio.",
    );

    const reserva = banco.ocupacoes.find((o) => o.id === partida.ocupacaoId);
    const cancelarReserva =
      reserva &&
      reserva.data >= ctx.hoje &&
      (reserva.situacao === "agendada" || reserva.situacao === "aguardando_pagamento");

    return {
      ...banco,
      partidas: banco.partidas.filter((p) => p.id !== partida.id),
      ocupacoes: cancelarReserva
        ? banco.ocupacoes.map((o): Ocupacao =>
            o.id === reserva?.id
              ? {
                  ...o,
                  situacao: "cancelada",
                  motivoCancelamento: "Partida de ranking excluída",
                  canceladaEm: ctx.agora,
                }
              : o,
          )
        : banco.ocupacoes,
    };
  },
);

// ---------------------------------------------------------------------------
// Torneios: cadastro e chave
// ---------------------------------------------------------------------------

const FORMATOS: FormatoTorneio[] = ["eliminatoria", "grupos_eliminatoria", "todos_contra_todos"];

export interface DadosTorneio {
  nome: string;
  data: string;
  formato: FormatoTorneio;
  /** Vazio = torneio livre. */
  categoria?: CategoriaRanking;
  duplas: boolean;
  inscricoes: InscricaoDigitada[];
}

function validarDadosDoTorneio(dados: Omit<DadosTorneio, "inscricoes">): void {
  exigir(dados.nome.trim(), "Dê um nome ao torneio.");
  exigir(dataValida(dados.data), "Informe a data do torneio.");
  exigir(FORMATOS.includes(dados.formato), "Escolha o formato do torneio.");
}

export const criarTorneio = definirOperacao(
  "Criar torneio",
  (banco, dados: DadosTorneio, ctx) => {
    garantirAcesso(banco, ctx);
    validarDadosDoTorneio(dados);
    validarInscricoes(banco.alunos, dados.duplas, dados.inscricoes);

    const torneio: Torneio = {
      id: novoId("t"),
      nome: dados.nome.trim(),
      data: dados.data,
      formato: dados.formato,
      categoria: dados.categoria,
      duplas: dados.duplas,
      situacao: "inscricoes",
      criadoEm: ctx.agora,
    };
    const inscritos: TorneioInscrito[] = dados.inscricoes.map((inscricao) => ({
      id: novoId("ti"),
      torneioId: torneio.id,
      alunosIds: [...inscricao.alunosIds],
      cabecaDeChave: inscricao.cabecaDeChave,
    }));
    return {
      ...banco,
      torneios: [...banco.torneios, torneio],
      torneioInscritos: [...banco.torneioInscritos, ...inscritos],
    };
  },
);

export interface DadosEdicaoDoTorneio extends Omit<DadosTorneio, "inscricoes"> {
  id: string;
  /** So enquanto as inscricoes estao abertas; vazio = nao mexe nas inscricoes. */
  inscricoes?: InscricaoDigitada[];
}

/**
 * Edita nome, data e categoria a qualquer momento. Formato, simples/duplas e
 * inscricoes so mudam enquanto a chave nao foi gerada.
 */
export const editarTorneio = definirOperacao(
  "Editar torneio",
  (banco, dados: DadosEdicaoDoTorneio, ctx) => {
    garantirAcesso(banco, ctx);
    const torneio = banco.torneios.find((t) => t.id === dados.id);
    exigir(torneio, "Torneio não encontrado.");
    validarDadosDoTorneio(dados);
    if (torneio.situacao !== "inscricoes") {
      exigir(
        dados.formato === torneio.formato && dados.duplas === torneio.duplas && !dados.inscricoes,
        "A chave já foi gerada: para mudar formato ou inscrições, desfaça a chave primeiro.",
      );
    }

    const atuais = banco.torneioInscritos.filter((i) => i.torneioId === torneio.id);
    validarInscricoes(banco.alunos, dados.duplas, dados.inscricoes ?? atuais);

    const editado: Torneio = {
      ...torneio,
      nome: dados.nome.trim(),
      data: dados.data,
      formato: dados.formato,
      categoria: dados.categoria,
      duplas: dados.duplas,
    };
    const mudouTorneio = (["nome", "data", "formato", "categoria", "duplas"] as const).some(
      (campo) => editado[campo] !== torneio[campo],
    );

    let torneioInscritos = banco.torneioInscritos;
    if (dados.inscricoes) {
      const porId = new Map(atuais.map((i) => [i.id, i]));
      const mantidas = new Map<string, TorneioInscrito>();
      const novas: TorneioInscrito[] = [];
      dados.inscricoes.forEach((digitada) => {
        const atual = digitada.id ? porId.get(digitada.id) : undefined;
        if (!atual) {
          novas.push({
            id: novoId("ti"),
            torneioId: torneio.id,
            alunosIds: [...digitada.alunosIds],
            cabecaDeChave: digitada.cabecaDeChave,
          });
          return;
        }
        const igual =
          atual.cabecaDeChave === digitada.cabecaDeChave &&
          atual.alunosIds.join("|") === digitada.alunosIds.join("|");
        mantidas.set(
          atual.id,
          igual
            ? atual
            : { ...atual, alunosIds: [...digitada.alunosIds], cabecaDeChave: digitada.cabecaDeChave },
        );
      });
      torneioInscritos = [
        ...banco.torneioInscritos
          .filter((i) => i.torneioId !== torneio.id || mantidas.has(i.id))
          .map((i) => mantidas.get(i.id) ?? i),
        ...novas,
      ];
    }

    return {
      ...banco,
      torneios: mudouTorneio
        ? banco.torneios.map((t) => (t.id === torneio.id ? editado : t))
        : banco.torneios,
      torneioInscritos,
    };
  },
);

/**
 * Gera a chave: sorteia quem nao e cabeca de chave, cria as partidas e poe o
 * torneio "em andamento".
 */
export const gerarChaveDoTorneio = definirOperacao(
  "Gerar chave do torneio",
  (banco, dados: { id: string }, ctx) => {
    garantirAcesso(banco, ctx);
    const torneio = banco.torneios.find((t) => t.id === dados.id);
    exigir(torneio, "Torneio não encontrado.");
    exigir(torneio.situacao === "inscricoes", "A chave deste torneio já foi gerada.");

    const inscritos = banco.torneioInscritos.filter((i) => i.torneioId === torneio.id);
    const chave = gerarChave(torneio, sortearInscritos(inscritos, `${torneio.id}|${ctx.agora}`), {
      prefixoId: novoId("pt"),
      criadoEm: ctx.agora,
      classificadosPorGrupo: banco.configuracoes.classificadosPorGrupo,
    });
    const comGrupo = new Map(chave.inscritos.filter((i) => i.grupo).map((i) => [i.id, i]));

    return {
      ...banco,
      torneios: mudarSituacao(banco, torneio, "em_andamento"),
      torneioInscritos: banco.torneioInscritos.map((i) => comGrupo.get(i.id) ?? i),
      partidas: [...banco.partidas, ...chave.partidas],
    };
  },
);

/** Apaga a chave (so sem nenhum resultado) e reabre as inscricoes. */
export const desfazerChaveDoTorneio = definirOperacao(
  "Desfazer chave do torneio",
  (banco, dados: { id: string }, ctx) => {
    garantirAcesso(banco, ctx);
    const torneio = banco.torneios.find((t) => t.id === dados.id);
    exigir(torneio, "Torneio não encontrado.");
    exigir(torneio.situacao !== "inscricoes", "Este torneio ainda não tem chave.");
    exigir(
      !banco.partidas.some((p) => p.torneioId === torneio.id && p.vencedor),
      "Já há resultados registrados: a chave não pode mais ser desfeita.",
    );

    return {
      ...banco,
      torneios: mudarSituacao(banco, torneio, "inscricoes"),
      torneioInscritos: banco.torneioInscritos.map((i) =>
        i.torneioId === torneio.id && i.grupo ? { ...i, grupo: undefined } : i,
      ),
      partidas: banco.partidas.filter((p) => p.torneioId !== torneio.id),
    };
  },
);

// ---------------------------------------------------------------------------
// Torneios: resultados
// ---------------------------------------------------------------------------

export interface DadosResultadoDeTorneio extends ResultadoDigitado {
  partidaId: string;
  data?: string;
}

function partidaDeTorneio(banco: Banco, partidaId: string): { partida: Partida; torneio: Torneio } {
  const partida = banco.partidas.find((p) => p.id === partidaId);
  exigir(partida?.torneioId, "Partida de torneio não encontrada.");
  const torneio = banco.torneios.find((t) => t.id === partida.torneioId);
  exigir(torneio, "Torneio não encontrado.");
  exigir(torneio.situacao !== "inscricoes", "A chave deste torneio ainda não foi gerada.");
  return { partida, torneio };
}

/**
 * Depois de mudar resultados: no formato de grupos, (re)monta a eliminatoria
 * quando os grupos terminam; e atualiza a situacao do torneio.
 */
function fecharMudanca(
  banco: Banco,
  torneio: Torneio,
  partida: Partida,
  partidas: Partida[],
  ctx: ContextoOperacao,
): Banco {
  const atualizadas = partida.grupo
    ? atualizarFaseEliminatoria(
        torneio,
        banco.torneioInscritos,
        partidas,
        banco.configuracoes.classificadosPorGrupo,
        banco.configuracoes.criteriosDesempate,
        novoId("pt"),
        ctx.agora,
      )
    : partidas;
  return {
    ...banco,
    partidas: atualizadas,
    torneios: mudarSituacao(
      banco,
      torneio,
      torneioTerminou(torneio, atualizadas) ? "encerrado" : "em_andamento",
    ),
  };
}

function gravarResultadoDeTorneio(
  banco: Banco,
  dados: DadosResultadoDeTorneio,
  ctx: ContextoOperacao,
  correcao: boolean,
): Banco {
  garantirAcesso(banco, ctx);
  const { partida, torneio } = partidaDeTorneio(banco, dados.partidaId);
  exigir(
    correcao ? partida.vencedor : !partida.vencedor,
    correcao ? "Esta partida ainda não tem resultado." : "Esta partida já tem resultado: use a correção.",
  );
  const bloqueio = bloqueioDeCorrecao(torneio, banco.partidas, partida);
  exigir(!bloqueio, bloqueio ?? "");
  exigir(
    partida.inscricaoAId && partida.inscricaoBId,
    "Esta partida ainda espera o vencedor da rodada anterior.",
  );

  const data = dados.data || (partida.data && partida.data <= ctx.hoje ? partida.data : ctx.hoje);
  exigir(dataValida(data), "Informe a data da partida.");
  exigir(data <= ctx.hoje, "A data da partida não pode ser depois de hoje.");
  const resultado = validarResultado(dados, nomesDosLados(banco, partida));

  const partidas = aplicarResultado(banco.partidas, partida.id, { ...resultado, data });
  return fecharMudanca(banco, torneio, partida, partidas, ctx);
}

/** Grava o resultado; o vencedor vai sozinho para a partida seguinte. */
export const registrarResultadoDeTorneio = definirOperacao(
  "Registrar resultado de torneio",
  (banco, dados: DadosResultadoDeTorneio, ctx) => gravarResultadoDeTorneio(banco, dados, ctx, false),
);

/** Corrige um resultado, so enquanto a partida seguinte nao foi jogada. */
export const corrigirResultadoDeTorneio = definirOperacao(
  "Corrigir resultado de torneio",
  (banco, dados: DadosResultadoDeTorneio, ctx) => gravarResultadoDeTorneio(banco, dados, ctx, true),
);

/** Apaga um resultado lancado por engano (mesmas condicoes da correcao). */
export const apagarResultadoDeTorneio = definirOperacao(
  "Apagar resultado de torneio",
  (banco, dados: { partidaId: string }, ctx) => {
    garantirAcesso(banco, ctx);
    const { partida, torneio } = partidaDeTorneio(banco, dados.partidaId);
    const bloqueio = bloqueioDeCorrecao(torneio, banco.partidas, partida);
    exigir(!bloqueio, bloqueio ?? "");
    const partidas = desfazerResultado(banco.partidas, partida.id);
    return fecharMudanca(banco, torneio, partida, partidas, ctx);
  },
);

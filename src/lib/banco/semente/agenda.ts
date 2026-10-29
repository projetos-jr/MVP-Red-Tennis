/**
 * Dados de exemplo: agenda e reposicao.
 *
 * Parte da mesma grade semanal do MVP (sem os conflitos plantados — no modelo
 * novo eles sao impossiveis) e transforma cada horario fixo em uma ocupacao
 * por data, de SEMANAS_DE_HISTORICO semanas atras ate `semanasGeradasAFrente`
 * semanas a frente. Sobre isso aplica o que acontece numa arena de verdade:
 *  - dias de chuva (todas as aulas canceladas com CH, gerando creditos);
 *  - faltas do professor (FP), faltas avisadas (24h, TIP) e faltas simples;
 *  - bloqueios de quadra, que cancelam as aulas do horario com IAC;
 *  - locacoes avulsas (algumas aguardando pagamento) e reservas de ranking;
 *  - reposicoes ja marcadas, consumindo creditos;
 *  - alguns creditos antigos ja vencidos.
 */

import { inicioDaSemana, somarDias, somarMeses } from "../../date";
import { HOJE, IDS_QUADRAS, SEMANAS_DE_HISTORICO } from "../constantes";
import {
  datasDoHorarioFixo,
  duracaoEmMinutos,
  indexarPorQuadraEData,
  livreNoIndice,
  conflitosNaQuadra,
} from "../regras/agenda";
import { sobrepoe } from "../regras/comum";
import { creditosPorAulaPerdida } from "../regras/reposicao";
import type {
  Congelamento,
  HorarioAluno,
  HorarioFixo,
  LancamentoReposicao,
  Matricula,
  Ocupacao,
  OcupacaoAluno,
  QuadraId,
  TipoOcupacao,
} from "../tipos";
import { criarRng, doisDigitos, embaralhar, escolher, inteiro, type Sorteio } from "./aleatorio";
import {
  CONFIGURACOES_INICIAIS,
  PERFIS_DE_SEMENTE,
  PROFESSORES,
  type PerfilDeSemente,
} from "./cadastros";

const SEGUNDA_DESTA_SEMANA = inicioDaSemana(HOJE);

/** Primeiro e ultimo dia com ocupacoes geradas. */
export const INICIO_DO_HISTORICO = somarDias(SEGUNDA_DESTA_SEMANA, -7 * SEMANAS_DE_HISTORICO);
export const FIM_DAS_OCUPACOES = somarDias(
  SEGUNDA_DESTA_SEMANA,
  7 * CONFIGURACOES_INICIAIS.semanasGeradasAFrente - 1,
);

/** Data em que os horarios fixos de exemplo comecaram a valer. */
const INICIO_DOS_FIXOS = somarDias(INICIO_DO_HISTORICO, -14);

/**
 * Datas em que a arena nao operou por chuva. Todas as areas sao descobertas,
 * entao um dia de chuva cancela a operacao inteira.
 */
export const DIAS_COM_CHUVA: string[] = [
  somarDias(HOJE, -4),
  somarDias(HOJE, -19),
  somarDias(HOJE, -33),
].sort();

/** Sabado da semana que vem: dia do torneio interno (quadras 2 e 3 bloqueadas). */
export const DATA_TORNEIO_INTERNO = somarDias(SEGUNDA_DESTA_SEMANA, 12);

// ---------------------------------------------------------------------------
// Grade semanal (mesma logica do MVP)
// ---------------------------------------------------------------------------

/** Meta de horarios por quadra em cada dia da semana (0 = domingo ... 6 = sabado). */
const OCUPACAO_ALVO: Record<QuadraId, number[]> = {
  "1": [3, 9, 7, 9, 8, 9, 6],
  "2": [2, 6, 8, 6, 7, 6, 5],
  "3": [4, 10, 8, 8, 9, 8, 7],
  "4": [2, 5, 6, 4, 5, 6, 4],
  paredao: [1, 3, 3, 3, 3, 3, 2],
};

/** Maximo de quadras ocupadas ao mesmo tempo numa faixa (mantem a grade legivel). */
const MAXIMO_SIMULTANEO = 3;
const HORAS_PICO = [18, 19, 7, 20, 8, 21, 9, 17];
const HORAS_VALE = [10, 16, 11, 15, 12, 14, 13];

const TIPOS_COM_PROFESSOR: TipoOcupacao[] = ["Individual", "Dupla", "LAP"];
/** Tipos que viram horario fixo; locacao avulsa e ranking sao reservas pontuais. */
const TIPOS_FIXOS: TipoOcupacao[] = [
  "Individual",
  "Dupla",
  "LAP",
  "Locação Mensal",
  "Plano de locação",
];

const SORTEIO_TIPO_QUADRA: TipoOcupacao[] = [
  "Individual", "Individual", "Individual", "Individual", "Individual", "Individual",
  "Dupla", "Dupla", "Dupla", "Dupla",
  "Locação Mensal", "Locação Mensal", "Locação Mensal",
  "LAP", "LAP",
  "Plano de locação", "Plano de locação",
  "Locação Avulsa", "Locação Avulsa",
  "Ranking",
];

const SORTEIO_TIPO_PAREDAO: TipoOcupacao[] = [
  "Individual", "Individual", "Individual",
  "LAP", "LAP",
  "Locação Avulsa", "Locação Avulsa",
  "Plano de locação",
];

const TAMANHO_TURMA: Record<TipoOcupacao, [number, number]> = {
  Individual: [1, 1],
  Dupla: [2, 2],
  LAP: [4, 6],
  "Locação Mensal": [2, 4],
  "Locação Avulsa": [2, 4],
  Ranking: [2, 2],
  "Plano de locação": [1, 3],
  Bloqueio: [0, 0],
};

interface CelulaDaGrade {
  quadraId: QuadraId;
  diaSemana: number;
  hora: number;
  tipo: TipoOcupacao;
  professorId?: string;
  alunosIds: string[];
}

function hora(h: number): string {
  return `${doisDigitos(h)}:00`;
}

function gerarGradeSemanal(): CelulaDaGrade[] {
  const ativos = PERFIS_DE_SEMENTE.filter((p) => !p.congelado);
  const usoNaSemana = new Map<string, number>();

  const menosAlocados = (rng: Sorteio, candidatos: PerfilDeSemente[]) =>
    embaralhar(rng, candidatos).sort(
      (a, b) => (usoNaSemana.get(a.alunoId) ?? 0) - (usoNaSemana.get(b.alunoId) ?? 0),
    );

  const registrarUso = (ids: string[]) => {
    ids.forEach((id) => usoNaSemana.set(id, (usoNaSemana.get(id) ?? 0) + 1));
    return ids;
  };

  const sortearAlunos = (rng: Sorteio, tipo: TipoOcupacao, professorId?: string) => {
    const [min, max] = TAMANHO_TURMA[tipo];
    const quantidade = inteiro(rng, min, max);

    if (professorId) {
      // Aulas: prioriza os alunos do proprio professor que tem menos horarios.
      const doProfessor = ativos.filter((a) => a.professorPrincipalId === professorId);
      const demais = ativos.filter((a) => !doProfessor.includes(a));
      const pool = [...menosAlocados(rng, doProfessor), ...menosAlocados(rng, demais)];
      return registrarUso(pool.slice(0, quantidade).map((a) => a.alunoId));
    }

    // Locacoes: o titular vem de quem tem plano de locacao; os demais sao convidados.
    const locatarios = ativos.filter(
      (a) => a.planoDoMvp === "Locação Mensal" || a.planoDoMvp === "Locação Avulsa",
    );
    const titular = menosAlocados(rng, locatarios)[0];
    const convidados = menosAlocados(
      rng,
      ativos.filter((a) => a.alunoId !== titular?.alunoId),
    );
    const pool = titular ? [titular, ...convidados] : convidados;
    return registrarUso(pool.slice(0, quantidade).map((a) => a.alunoId));
  };

  const celulas: CelulaDaGrade[] = [];

  for (let dia = 0; dia <= 6; dia += 1) {
    const ocupacaoPorHora = new Map<number, number>();

    IDS_QUADRAS.forEach((quadraId, indiceQuadra) => {
      const meta = OCUPACAO_ALVO[quadraId][dia];
      const rng = criarRng(9173 + indiceQuadra * 101 + dia * 17);
      const preferencia = [...embaralhar(rng, HORAS_PICO), ...embaralhar(rng, HORAS_VALE)];

      const ordem: number[] = [];
      for (const h of preferencia) {
        if (ordem.length >= meta) break;
        if ((ocupacaoPorHora.get(h) ?? 0) >= MAXIMO_SIMULTANEO) continue;
        ocupacaoPorHora.set(h, (ocupacaoPorHora.get(h) ?? 0) + 1);
        ordem.push(h);
      }

      ordem
        .sort((a, b) => a - b)
        .forEach((h) => {
          const tipo =
            quadraId === "paredao"
              ? escolher(rng, SORTEIO_TIPO_PAREDAO)
              : escolher(rng, SORTEIO_TIPO_QUADRA);
          const professorId = TIPOS_COM_PROFESSOR.includes(tipo)
            ? escolher(rng, PROFESSORES).id
            : undefined;
          celulas.push({
            quadraId,
            diaSemana: dia,
            hora: h,
            tipo,
            professorId,
            alunosIds: sortearAlunos(rng, tipo, professorId),
          });
        });
    });
  }

  return celulas;
}

// ---------------------------------------------------------------------------
// Geracao
// ---------------------------------------------------------------------------

export interface AgendaGerada {
  horariosFixos: HorarioFixo[];
  horarioAlunos: HorarioAluno[];
  ocupacoes: Ocupacao[];
  ocupacaoAlunos: OcupacaoAluno[];
  reposicoes: LancamentoReposicao[];
}

/** Tipo de aula de cada plano, para o horario antigo de quem esta congelado. */
const TIPO_DO_PLANO: Partial<Record<PerfilDeSemente["planoDoMvp"], TipoOcupacao>> = {
  Individual: "Individual",
  Dupla: "Dupla",
  LAP: "LAP",
  "Locação Mensal": "Locação Mensal",
};

export function gerarAgenda(
  matriculas: Matricula[],
  congelamentos: Congelamento[],
): AgendaGerada {
  const celulas = gerarGradeSemanal();
  const horariosFixos: HorarioFixo[] = [];
  const horarioAlunos: HorarioAluno[] = [];

  const adicionarFixo = (fixo: HorarioFixo, alunosIds: string[]) => {
    horariosFixos.push(fixo);
    alunosIds.forEach((alunoId) =>
      horarioAlunos.push({ id: `ha-${fixo.id}-${alunoId}`, horarioFixoId: fixo.id, alunoId }),
    );
  };

  celulas
    .filter((c) => TIPOS_FIXOS.includes(c.tipo))
    .forEach((c) =>
      adicionarFixo(
        {
          id: `hf-${c.quadraId}-${c.diaSemana}-${c.hora}`,
          quadraId: c.quadraId,
          diaSemana: c.diaSemana,
          horaInicio: hora(c.hora),
          horaFim: hora(c.hora + 1),
          tipo: c.tipo,
          professorId: c.professorId,
          inicio: INICIO_DOS_FIXOS,
        },
        c.alunosIds,
      ),
    );

  // Quem esta congelado tinha um horario fixo que terminou no congelamento:
  // e ele que alimenta o historico de aulas da ficha.
  const celulasUsadas = new Set(celulas.map((c) => `${c.quadraId}|${c.diaSemana}|${c.hora}`));
  const professorOcupado = new Set(
    celulas
      .filter((c) => c.professorId)
      .map((c) => `${c.professorId}|${c.diaSemana}|${c.hora}`),
  );
  PERFIS_DE_SEMENTE.filter((p) => p.congelado).forEach((perfil) => {
    const matricula = matriculas.find((m) => m.alunoId === perfil.alunoId && !m.fim);
    const congelamento = congelamentos.find(
      (c) => c.matriculaId === matricula?.id && !c.fimReal,
    );
    const tipo = TIPO_DO_PLANO[perfil.planoDoMvp];
    if (!matricula || !congelamento || !tipo) return;

    const professorId = TIPOS_COM_PROFESSOR.includes(tipo) ? perfil.professorPrincipalId : undefined;
    for (const dia of [2, 4, 3, 1, 5]) {
      for (const h of [18, 19, 17, 20, 8, 9]) {
        for (const quadraId of ["2", "3", "4", "1"] as QuadraId[]) {
          const celula = `${quadraId}|${dia}|${h}`;
          if (celulasUsadas.has(celula)) continue;
          if (professorId && professorOcupado.has(`${professorId}|${dia}|${h}`)) continue;
          celulasUsadas.add(celula);
          if (professorId) professorOcupado.add(`${professorId}|${dia}|${h}`);
          adicionarFixo(
            {
              id: `hf-${quadraId}-${dia}-${h}-${perfil.alunoId}`,
              quadraId,
              diaSemana: dia,
              horaInicio: hora(h),
              horaFim: hora(h + 1),
              tipo,
              professorId,
              inicio: INICIO_DOS_FIXOS,
              fim: somarDias(congelamento.inicio, -1),
            },
            [perfil.alunoId],
          );
          return;
        }
      }
    }
  });

  // --- Ocupacoes dos horarios fixos ---------------------------------------
  const ocupacoes: Ocupacao[] = [];
  const participantes: OcupacaoAluno[] = [];
  const reposicoes: LancamentoReposicao[] = [];

  const alunosDoFixo = new Map<string, string[]>();
  horarioAlunos.forEach((ha) => {
    const lista = alunosDoFixo.get(ha.horarioFixoId) ?? [];
    lista.push(ha.alunoId);
    alunosDoFixo.set(ha.horarioFixoId, lista);
  });

  const adicionarParticipantes = (ocupacao: Ocupacao, alunosIds: string[]) => {
    alunosIds.forEach((alunoId) =>
      participantes.push({
        id: `pa-${ocupacao.id}-${alunoId}`,
        ocupacaoId: ocupacao.id,
        alunoId,
        presenca: "a_marcar",
      }),
    );
  };

  horariosFixos.forEach((fixo) => {
    datasDoHorarioFixo(fixo, INICIO_DO_HISTORICO, FIM_DAS_OCUPACOES).forEach((data) => {
      const geradaEm = somarDias(data, -84) < fixo.inicio ? fixo.inicio : somarDias(data, -84);
      const ocupacao: Ocupacao = {
        id: `oc-${fixo.id}-${data}`,
        quadraId: fixo.quadraId,
        data,
        horaInicio: fixo.horaInicio,
        horaFim: fixo.horaFim,
        tipo: fixo.tipo,
        professorId: fixo.professorId,
        horarioFixoId: fixo.id,
        situacao: data < HOJE ? "realizada" : "agendada",
        criadoEm: `${geradaEm}T06:00:00`,
      };
      ocupacoes.push(ocupacao);
      adicionarParticipantes(ocupacao, alunosDoFixo.get(fixo.id) ?? []);
    });
  });

  // Participantes por ocupacao (indice, para nao varrer a lista toda).
  const porOcupacao = new Map<string, OcupacaoAluno[]>();
  participantes.forEach((p) => {
    const lista = porOcupacao.get(p.ocupacaoId) ?? [];
    lista.push(p);
    porOcupacao.set(p.ocupacaoId, lista);
  });

  const creditar = (ocupacao: Ocupacao, sigla: string, alunosIds: string[], em: string) => {
    creditosPorAulaPerdida(CONFIGURACOES_INICIAIS, ocupacao, sigla, alunosIds, em).forEach(
      (credito) =>
        reposicoes.push({ ...credito, id: `rp-${ocupacao.id}-${credito.alunoId}` }),
    );
  };

  const cancelar = (ocupacao: Ocupacao, sigla: string, em: string) => {
    ocupacao.situacao = "cancelada";
    ocupacao.motivoCancelamento = sigla;
    ocupacao.canceladaEm = em;
    const lista = porOcupacao.get(ocupacao.id) ?? [];
    lista.forEach((p) => {
      p.presenca = "a_marcar";
      p.sigla = undefined;
    });
    creditar(ocupacao, sigla, lista.map((p) => p.alunoId), em);
  };

  // --- O que aconteceu nas aulas passadas ----------------------------------
  const rngAulas = criarRng(4400);
  ocupacoes.forEach((ocupacao) => {
    if (ocupacao.data >= HOJE) return;

    if (DIAS_COM_CHUVA.includes(ocupacao.data)) {
      cancelar(ocupacao, "CH", `${ocupacao.data}T06:30:00`);
      return;
    }

    if (ocupacao.professorId && rngAulas() < 0.012) {
      cancelar(ocupacao, "FP", `${ocupacao.data}T07:00:00`);
      return;
    }

    const lista = porOcupacao.get(ocupacao.id) ?? [];
    lista.forEach((participante) => {
      const sorteio = rngAulas();
      if (sorteio < 0.86) {
        participante.presenca = "presente";
        return;
      }
      if (sorteio < 0.93) {
        participante.presenca = "falta";
        return;
      }
      const sigla = sorteio < 0.99 ? "24h" : "TIP";
      const avisadoEm = `${somarDias(ocupacao.data, -1)}T10:00:00`;
      participante.presenca = "falta_avisada";
      participante.sigla = sigla;

      if (ocupacao.tipo === "Individual") {
        // Aula individual sem o unico aluno nao acontece: e cancelada.
        ocupacao.situacao = "cancelada";
        ocupacao.motivoCancelamento = sigla;
        ocupacao.canceladaEm = avisadoEm;
      }
      creditar(ocupacao, sigla, [participante.alunoId], avisadoEm);
    });
  });

  // --- Bloqueios de quadra (cancelam as aulas do horario com IAC) ----------
  const bloqueios: Array<Pick<Ocupacao, "quadraId" | "data" | "horaInicio" | "horaFim" | "descricao">> = [
    { quadraId: "1", data: somarDias(SEGUNDA_DESTA_SEMANA, -13), horaInicio: "13:00", horaFim: "15:00", descricao: "Pintura das linhas" },
    { quadraId: "4", data: somarDias(SEGUNDA_DESTA_SEMANA, 7), horaInicio: "07:00", horaFim: "10:00", descricao: "Manutenção do saibro" },
    { quadraId: "2", data: DATA_TORNEIO_INTERNO, horaInicio: "08:00", horaFim: "13:00", descricao: "Torneio Interno · Categoria B" },
    { quadraId: "3", data: DATA_TORNEIO_INTERNO, horaInicio: "08:00", horaFim: "13:00", descricao: "Torneio Interno · Categoria B" },
  ];

  bloqueios.forEach((bloqueio, indice) => {
    const seisDiasAntes = somarDias(bloqueio.data, -6);
    const decididoEm = seisDiasAntes < HOJE ? seisDiasAntes : somarDias(HOJE, -1);
    conflitosNaQuadra(ocupacoes, bloqueio).forEach((afetada) =>
      cancelar(afetada, "IAC", `${decididoEm}T10:00:00`),
    );
    ocupacoes.push({
      id: `oc-bl-${indice + 1}`,
      ...bloqueio,
      tipo: "Bloqueio",
      situacao: bloqueio.data < HOJE ? "realizada" : "agendada",
      criadoEm: `${decididoEm}T09:00:00`,
    });
  });

  // --- Reservas pontuais: locacao avulsa e ranking --------------------------
  const indice = indexarPorQuadraEData(ocupacoes);
  const adicionarAoIndice = (ocupacao: Ocupacao) => {
    const chave = `${ocupacao.quadraId}|${ocupacao.data}`;
    indice.set(chave, [...(indice.get(chave) ?? []), ocupacao]);
  };

  const limiteDasReservas = somarDias(HOJE, 14);
  const inscritosNoRanking = PERFIS_DE_SEMENTE.filter((p) => p.principal && !p.congelado);
  const rngReservas = criarRng(31337);

  celulas
    .filter((c) => c.tipo === "Locação Avulsa" || c.tipo === "Ranking")
    .forEach((celula) => {
      const datas = datasDoHorarioFixo(
        { diaSemana: celula.diaSemana, inicio: INICIO_DO_HISTORICO },
        INICIO_DO_HISTORICO,
        limiteDasReservas,
      );

      datas.forEach((data) => {
        if (DIAS_COM_CHUVA.includes(data)) return;
        const passada = data < HOJE;
        const chance = celula.tipo === "Ranking" ? (passada ? 0.75 : 0.6) : passada ? 0.55 : 0.5;
        if (rngReservas() > chance) return;

        const alvo = {
          quadraId: celula.quadraId,
          data,
          horaInicio: hora(celula.hora),
          horaFim: hora(celula.hora + 1),
        };
        if (!livreNoIndice(indice, alvo)) return;

        const base = `oc-${celula.tipo === "Ranking" ? "rk" : "av"}-${celula.quadraId}-${data}-${celula.hora}`;
        let alunosIds = celula.alunosIds;
        let situacao: Ocupacao["situacao"] = passada ? "realizada" : "agendada";
        let prazoPagamento: string | undefined;
        let criadoEm = `${somarDias(data, -3) < HOJE ? somarDias(data, -3) : somarDias(HOJE, -1)}T12:00:00`;

        if (celula.tipo === "Ranking") {
          // Dois inscritos de nivel parecido.
          const jogadorA = escolher(rngReservas, inscritosNoRanking);
          const candidatos = inscritosNoRanking
            .filter((p) => p.alunoId !== jogadorA.alunoId)
            .sort((a, b) => Math.abs(a.forca - jogadorA.forca) - Math.abs(b.forca - jogadorA.forca))
            .slice(0, 4);
          alunosIds = [jogadorA.alunoId, escolher(rngReservas, candidatos).alunoId];
        } else if (!passada && data <= somarDias(HOJE, 3) && rngReservas() < 0.6) {
          // Reserva ainda sem pagamento: algumas ja passaram do prazo (Hipotese H5).
          const prazoVencido = rngReservas() < 0.4;
          const diaDoPrazo = prazoVencido ? somarDias(HOJE, -1) : somarDias(HOJE, 1);
          situacao = "aguardando_pagamento";
          prazoPagamento = `${diaDoPrazo}T18:00:00`;
          criadoEm = `${somarDias(diaDoPrazo, -1)}T18:00:00`;
        }

        const ocupacao: Ocupacao = {
          id: base,
          ...alvo,
          tipo: celula.tipo,
          situacao,
          prazoPagamento,
          criadoEm,
        };
        ocupacoes.push(ocupacao);
        adicionarAoIndice(ocupacao);
        alunosIds.forEach((alunoId) =>
          participantes.push({
            id: `pa-${ocupacao.id}-${alunoId}`,
            ocupacaoId: ocupacao.id,
            alunoId,
            presenca: passada ? "presente" : "a_marcar",
          }),
        );
      });
    });

  // --- Reposicoes marcadas (usam creditos) ----------------------------------
  const ocupacaoPorId = new Map(ocupacoes.map((o) => [o.id, o]));
  const professorNoDia = new Map<string, Ocupacao[]>();
  ocupacoes.forEach((o) => {
    if (!o.professorId || o.situacao === "cancelada") return;
    const chave = `${o.professorId}|${o.data}`;
    professorNoDia.set(chave, [...(professorNoDia.get(chave) ?? []), o]);
  });

  const rngUsos = criarRng(2718);
  const usos: LancamentoReposicao[] = [];

  reposicoes.forEach((credito) => {
    const origem = ocupacaoPorId.get(credito.ocupacaoOrigemId ?? "");
    const diaDoCredito = credito.criadoEm.slice(0, 10);
    if (!origem || diaDoCredito > somarDias(HOJE, -5)) return;
    if (rngUsos() > 0.75) return;

    const referencia = origem.data > diaDoCredito ? origem.data : diaDoCredito;
    const data = somarDias(referencia, inteiro(rngUsos, 3, 12));
    if (data > somarDias(HOJE, 10) || DIAS_COM_CHUVA.includes(data)) return;

    for (const h of embaralhar(rngUsos, [8, 9, 10, 11, 14, 15, 16, 17])) {
      for (const quadraId of ["2", "3", "4", "1"] as QuadraId[]) {
        const alvo = { quadraId, data, horaInicio: hora(h), horaFim: hora(h + 1) };
        if (!livreNoIndice(indice, alvo)) continue;
        const agendaDoProfessor = origem.professorId
          ? (professorNoDia.get(`${origem.professorId}|${data}`) ?? [])
          : [];
        if (agendaDoProfessor.some((o) => sobrepoe(o.horaInicio, o.horaFim, alvo.horaInicio, alvo.horaFim))) {
          continue;
        }

        const doisDiasAntes = somarDias(data, -2);
        const marcadoEm = [doisDiasAntes < HOJE ? doisDiasAntes : HOJE, diaDoCredito].sort()[1];
        if (marcadoEm > (credito.validade ?? "")) return;

        // Aula com professor vira aula individual de reposicao; locacao mensal
        // e plano de locacao viram uma reserva da quadra do mesmo tipo.
        const ocupacao: Ocupacao = {
          id: `oc-rp-${credito.id}`,
          ...alvo,
          tipo: origem.professorId ? "Individual" : origem.tipo,
          professorId: origem.professorId,
          descricao: "Reposição",
          situacao: data < HOJE ? "realizada" : "agendada",
          criadoEm: `${marcadoEm}T11:00:00`,
        };
        ocupacoes.push(ocupacao);
        adicionarAoIndice(ocupacao);
        if (origem.professorId) {
          professorNoDia.set(`${origem.professorId}|${data}`, [...agendaDoProfessor, ocupacao]);
        }
        participantes.push({
          id: `pa-${ocupacao.id}-${credito.alunoId}`,
          ocupacaoId: ocupacao.id,
          alunoId: credito.alunoId,
          presenca: data < HOJE ? "presente" : "a_marcar",
        });
        usos.push({
          id: `rp-uso-${credito.id}`,
          alunoId: credito.alunoId,
          minutos: -duracaoEmMinutos(ocupacao),
          ocupacaoUsoId: ocupacao.id,
          criadoEm: `${marcadoEm}T11:00:00`,
        });
        return;
      }
    }
  });

  // --- Creditos antigos, ja vencidos ----------------------------------------
  const rngAntigos = criarRng(1618);
  PERFIS_DE_SEMENTE.filter((p) => p.principal && !p.congelado)
    .filter((_, i) => i % 3 === 1)
    .forEach((perfil) => {
      const validade = somarDias(HOJE, -inteiro(rngAntigos, 5, 25));
      usos.push({
        id: `rp-antigo-${perfil.alunoId}`,
        alunoId: perfil.alunoId,
        minutos: 60,
        sigla: "CH",
        validade,
        observacao: "Crédito anterior ao período dos dados de exemplo",
        criadoEm: `${somarMeses(validade, -3)}T06:30:00`,
      });
    });

  return {
    horariosFixos,
    horarioAlunos,
    ocupacoes: ocupacoes.sort(
      (a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio),
    ),
    ocupacaoAlunos: participantes,
    reposicoes: [...reposicoes, ...usos],
  };
}

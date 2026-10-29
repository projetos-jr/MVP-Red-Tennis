/**
 * Dados de exemplo: financeiro.
 *
 * - Mensalidades dos ultimos 6 meses de cada matricula (o mes corrente com
 *   pagamentos pendentes e em atraso). As do mes seguinte NAO existem: e o
 *   que o botao "Gerar mensalidades" demonstra;
 * - locacoes avulsas (pagas, ou aguardando pagamento dentro do prazo);
 * - inscricoes de torneio e algumas aulas experimentais;
 * - contas a pagar mensais (energia, agua, manutencao...), inclusive as do mes
 *   seguinte e uma atrasada;
 * - repasses dos professores fechados ate dois meses atras. O ultimo mes
 *   terminado fica sem fechamento, para a tela demonstrar "Fechar repasse".
 *
 * Os lancamentos de consumo e de fornecedor vem da semente do estoque.
 */

import { formatarDiaMes, somarDias } from "../../date";
import { HOJE } from "../constantes";
import { duracaoEmMinutos, rotuloDaQuadra } from "../regras/agenda";
import {
  emReais,
  mesCurto,
  precoDaLocacao,
  somarMesesNaCompetencia,
} from "../regras/financeiro";
import type {
  Aluno,
  Lancamento,
  Matricula,
  Ocupacao,
  OcupacaoAluno,
  Plano,
  Professor,
  Repasse,
  Torneio,
  TorneioInscrito,
} from "../tipos";
import { criarRng, doisDigitos, escolher, inteiro, type Sorteio } from "./aleatorio";
import { CONFIGURACOES_INICIAIS, PERFIL_POR_ALUNO } from "./cadastros";

/** Datas nunca depois de hoje (um pagamento nao pode estar no futuro). */
function ateHoje(data: string): string {
  return data > HOJE ? HOJE : data;
}

const FORMAS_RECEBIMENTO = ["Stone", "Stone", "Bradesco", "Bradesco", "Total Pass", "Dinheiro"];

function forma(rng: Sorteio, valor: number): Pick<Lancamento, "formaPagamento" | "valorConvenio"> {
  const escolhida = escolher(rng, FORMAS_RECEBIMENTO);
  return {
    formaPagamento: escolhida,
    valorConvenio:
      escolhida === "Total Pass" ? Math.round(valor * (rng() > 0.5 ? 0.7 : 0.6)) : undefined,
  };
}

/** Quem pagou: as vezes um responsavel (so para nomes com sobrenome, evitando confusao). */
function pagante(rng: Sorteio, aluno: Aluno): string {
  const sobrenome = PERFIL_POR_ALUNO.get(aluno.id)?.sobrenome;
  if (!sobrenome || rng() > 0.22) return aluno.nome;
  return escolher(rng, [
    `Marcos ${sobrenome}`,
    `Helena ${sobrenome}`,
    `${sobrenome} Participações LTDA`,
  ]);
}

export interface DadosParaFinanceiro {
  alunos: Aluno[];
  planos: Plano[];
  matriculas: Matricula[];
  ocupacoes: Ocupacao[];
  ocupacaoAlunos: OcupacaoAluno[];
  professores: Professor[];
  torneios: Torneio[];
  torneioInscritos: TorneioInscrito[];
}

export interface FinanceiroGerado {
  lancamentos: Lancamento[];
  repasses: Repasse[];
}

const DESPESAS_MENSAIS = [
  { item: "Energia elétrica", favorecido: "Companhia de energia", base: 1850, variacao: 250 },
  { item: "Água", favorecido: "Companhia de saneamento", base: 360, variacao: 60 },
  { item: "Internet", favorecido: "Provedor de internet", base: 189.9, variacao: 0 },
  { item: "Manutenção do saibro", favorecido: "Empreiteiro de quadras", base: 1200, variacao: 300 },
  { item: "Material de limpeza", favorecido: "Atacado de limpeza", base: 240, variacao: 60 },
  { item: "Contabilidade", favorecido: "Escritório de contabilidade", base: 650, variacao: 0 },
];

/** Despesa do mes passado que ficou sem pagar (mostra uma conta a pagar em atraso). */
const DESPESA_ATRASADA = "Manutenção do saibro";

export function gerarFinanceiro(dados: DadosParaFinanceiro): FinanceiroGerado {
  const lancamentos: Lancamento[] = [];
  const alunoPorId = new Map(dados.alunos.map((a) => [a.id, a]));
  const planoPorId = new Map(dados.planos.map((p) => [p.id, p]));
  const competenciaAtual = HOJE.slice(0, 7);
  // Contadas a partir do mes (e nao de HOJE): em 31/10, "um mes atras" pela
  // data cairia em 01/10 e setembro sumiria.
  const competencias = [5, 4, 3, 2, 1, 0].map((k) =>
    somarMesesNaCompetencia(competenciaAtual, -k),
  );
  const competenciaAnterior = somarMesesNaCompetencia(competenciaAtual, -1);
  const competenciaSeguinte = somarMesesNaCompetencia(competenciaAtual, 1);

  // --- Mensalidades -------------------------------------------------------------
  dados.matriculas.forEach((matricula, indice) => {
    const rng = criarRng(7700 + indice * 53);
    const aluno = alunoPorId.get(matricula.alunoId);
    const plano = planoPorId.get(matricula.planoId);
    if (!aluno || !plano) return;

    competencias.forEach((competencia) => {
      const vencimento = `${competencia}-${doisDigitos(matricula.diaVencimento)}`;
      if (vencimento < matricula.inicio) return;
      if (matricula.fim && vencimento > matricula.fim) return;

      let pagoEm: string | undefined;
      if (competencia !== competenciaAtual) {
        const atraso = rng() < 0.1 ? inteiro(rng, 5, 20) : inteiro(rng, -3, 3);
        pagoEm = ateHoje(somarDias(vencimento, atraso));
      } else if (vencimento < HOJE) {
        if (rng() < 0.8) pagoEm = ateHoje(somarDias(vencimento, inteiro(rng, -3, 5)));
      } else if (rng() < 0.3) {
        pagoEm = ateHoje(somarDias(vencimento, -inteiro(rng, 1, 5)));
      }

      lancamentos.push({
        id: `lc-m-${matricula.id}-${competencia}`,
        tipo: "receber",
        categoria: "Mensalidade",
        pessoaId: aluno.id,
        pessoaTipo: "aluno",
        nomePagante: pagante(rng, aluno),
        item: `Mensalidade ${mesCurto(competencia)} · ${plano.nome}`,
        valor: matricula.valorMensal,
        vencimento,
        pagoEm,
        ...(pagoEm ? forma(rng, matricula.valorMensal) : {}),
        competencia,
        matriculaId: matricula.id,
        criadoEm: `${competencia}-01T06:00:00`,
      });
    });
  });

  // --- Locacoes avulsas -----------------------------------------------------------
  const rngAvulsas = criarRng(4242);
  const titular = new Map<string, string>();
  dados.ocupacaoAlunos.forEach((p) => {
    if (!titular.has(p.ocupacaoId)) titular.set(p.ocupacaoId, p.alunoId);
  });

  dados.ocupacoes
    .filter((o) => o.tipo === "Locação Avulsa" && o.situacao !== "cancelada")
    .forEach((ocupacao) => {
      const aluno = alunoPorId.get(titular.get(ocupacao.id) ?? "");
      if (!aluno) return;
      const valor = precoDaLocacao(CONFIGURACOES_INICIAIS, ocupacao);
      const aguardando = ocupacao.situacao === "aguardando_pagamento";
      const vencimento = aguardando
        ? (ocupacao.prazoPagamento ?? ocupacao.data).slice(0, 10)
        : ocupacao.data < HOJE
          ? ocupacao.data
          : ocupacao.criadoEm.slice(0, 10);
      const pagoEm = aguardando ? undefined : vencimento;

      lancamentos.push({
        id: `lc-av-${ocupacao.id}`,
        tipo: "receber",
        categoria: "Locação",
        pessoaId: aluno.id,
        pessoaTipo: "aluno",
        nomePagante: aluno.nome,
        item: `Locação avulsa · ${rotuloDaQuadra(ocupacao.quadraId)} · ${formatarDiaMes(ocupacao.data)} ${ocupacao.horaInicio}`,
        valor,
        vencimento,
        pagoEm,
        ...(pagoEm ? forma(rngAvulsas, valor) : {}),
        ocupacaoId: ocupacao.id,
        criadoEm: ocupacao.criadoEm,
      });
    });

  // --- Inscricoes de torneio --------------------------------------------------------
  const rngTorneios = criarRng(9090);
  dados.torneioInscritos.forEach((inscricao) => {
    const torneio = dados.torneios.find((t) => t.id === inscricao.torneioId);
    if (!torneio) return;
    inscricao.alunosIds.forEach((alunoId) => {
      const aluno = alunoPorId.get(alunoId);
      if (!aluno) return;
      const vencimento = somarDias(torneio.data, -2);
      const pago = torneio.data < HOJE || rngTorneios() < 0.6;
      const pagoEm = pago
        ? ateHoje(somarDias(torneio.data < HOJE ? torneio.data : HOJE, -inteiro(rngTorneios, 2, 10)))
        : undefined;
      lancamentos.push({
        id: `lc-ti-${inscricao.id}-${alunoId}`,
        tipo: "receber",
        categoria: "Torneio",
        pessoaId: aluno.id,
        pessoaTipo: "aluno",
        nomePagante: aluno.nome,
        item: `Inscrição · ${torneio.nome}`,
        valor: 110,
        vencimento,
        pagoEm,
        ...(pagoEm ? forma(rngTorneios, 110) : {}),
        torneioId: torneio.id,
        criadoEm: torneio.criadoEm,
      });
    });
  });

  // --- Aulas experimentais ----------------------------------------------------------
  const rngExperimentais = criarRng(1357);
  const semPlano = dados.alunos.filter((a) => !a.inscritoRanking);
  for (let i = 0; i < 6; i += 1) {
    const aluno = escolher(rngExperimentais, semPlano);
    const dia = somarDias(HOJE, -inteiro(rngExperimentais, 1, 30));
    lancamentos.push({
      id: `lc-exp-${i + 1}`,
      tipo: "receber",
      categoria: "Aula avulsa",
      pessoaId: aluno.id,
      pessoaTipo: "aluno",
      nomePagante: aluno.nome,
      item: "Aula experimental",
      valor: 90,
      vencimento: dia,
      pagoEm: dia,
      ...forma(rngExperimentais, 90),
      criadoEm: `${dia}T09:00:00`,
    });
  }

  // --- Contas a pagar mensais ---------------------------------------------------------
  // Vencem no dia 10. Pagas as que ja venceram, menos a manutencao do saibro
  // do mes passado; as do mes seguinte ainda estao em aberto.
  const rngDespesas = criarRng(2468);
  [...competencias, competenciaSeguinte].forEach((competencia) => {
    DESPESAS_MENSAIS.forEach((despesa, i) => {
      const vencimento = `${competencia}-10`;
      const valor = emReais(despesa.base + (rngDespesas() - 0.5) * 2 * despesa.variacao);
      const atrasada = competencia === competenciaAnterior && despesa.item === DESPESA_ATRASADA;
      const pago = vencimento < HOJE && !atrasada;
      lancamentos.push({
        id: `lc-dp-${competencia}-${i + 1}`,
        tipo: "pagar",
        categoria: "Despesa",
        nomePagante: despesa.favorecido,
        item: `${despesa.item} · ${mesCurto(competencia)}`,
        valor,
        vencimento,
        pagoEm: pago ? ateHoje(somarDias(vencimento, -inteiro(rngDespesas, 0, 2))) : undefined,
        formaPagamento: pago ? "Bradesco" : undefined,
        competencia,
        // A conta do mes seguinte ja chegou: foi lancada no inicio deste mes.
        criadoEm: `${competencia > competenciaAtual ? competenciaAtual : competencia}-01T08:00:00`,
      });
    });
  });

  // --- Repasses dos professores (fechados ate dois meses atras) ------------------------
  // Tres e dois meses atras: o historico de aulas comeca no meio do mes mais
  // antigo. O mes passado fica sem fechamento, a espera do "Fechar repasse".
  const repasses: Repasse[] = [];
  [3, 2].forEach((mesesAtras) => {
    const competencia = somarMesesNaCompetencia(competenciaAtual, -mesesAtras);
    const mesSeguinte = somarMesesNaCompetencia(competencia, 1);

    dados.professores.forEach((professor) => {
      const aulas = dados.ocupacoes.filter(
        (o) =>
          o.professorId === professor.id &&
          o.situacao === "realizada" &&
          o.data.startsWith(competencia),
      );
      if (aulas.length === 0) return;
      const minutos = aulas.reduce((soma, o) => soma + duracaoEmMinutos(o), 0);
      const valorPrevisto =
        professor.repasse.modo === "por_hora"
          ? emReais((minutos / 60) * professor.repasse.valor)
          : 0;

      const repasse: Repasse = {
        id: `rep-${professor.id}-${competencia}`,
        professorId: professor.id,
        competencia,
        aulasDadas: aulas.length,
        minutosDados: minutos,
        valorPrevisto,
        fechadoEm: `${mesSeguinte}-03T10:00:00`,
      };
      repasses.push(repasse);

      const vencimento = `${mesSeguinte}-05`;
      lancamentos.push({
        id: `lc-rep-${professor.id}-${competencia}`,
        tipo: "pagar",
        categoria: "Repasse",
        pessoaId: professor.id,
        pessoaTipo: "professor",
        nomePagante: professor.nome,
        item: `Repasse ${mesCurto(competencia)} · ${aulas.length} aulas`,
        valor: valorPrevisto,
        vencimento,
        pagoEm: vencimento < HOJE ? vencimento : undefined,
        formaPagamento: vencimento < HOJE ? "Bradesco" : undefined,
        competencia,
        repasseId: repasse.id,
        criadoEm: repasse.fechadoEm,
      });
    });
  });

  return { lancamentos, repasses };
}

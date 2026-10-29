/**
 * Testes das operacoes do financeiro.
 * Os mesmos casos viram testes do banco real (pgTAP) quando o Supabase entrar.
 *
 * Quase todos usam um banco enxuto com datas fixas, para nao depender do dia
 * em que o teste roda. O ultimo bloco usa os dados de exemplo inteiros.
 */

import { describe, expect, it } from "vitest";
import {
  gerarCsv,
  indicadoresDoMes,
  listarLancamentos,
  previaDasMensalidades,
  recebidoPorForma,
  relatorioDeProfessores,
  totalizar,
} from "../../consultas/financeiro";
import { HOJE } from "../constantes";
import { executarOperacao, type ContextoOperacao, type Operacao } from "../executar";
import {
  precoDaLocacao,
  situacaoLancamento,
  somarMesesNaCompetencia,
} from "../regras/financeiro";
import { gerarBancoInicial } from "../semente";
import type { Banco, Lancamento, Matricula, Ocupacao } from "../tipos";
import {
  anularLancamento,
  criarLancamento,
  fecharRepasseDoMes,
  gerarMensalidades,
  registrarPagamento,
  type DadosNovoLancamento,
} from "./financeiro";

const semente = gerarBancoInicial();
const [dono, recepcao, professora] = semente.colaboradores;

function ctx(hoje: string, usuario = dono): ContextoOperacao {
  return { usuario, hoje, agora: `${hoje}T10:00:00` };
}

/** Cadastros da semente (alunos, professores, planos, configuracoes), sem movimento. */
function bancoLimpo(parcial: Partial<Banco> = {}): Banco {
  return {
    ...semente,
    auditoria: [],
    comentarios: [],
    matriculas: [],
    congelamentos: [],
    ocupacoes: [],
    ocupacaoAlunos: [],
    lancamentos: [],
    repasses: [],
    ...parcial,
  };
}

/** Executa e devolve o banco novo; falha o teste se a regra recusar. */
function gravar<D>(banco: Banco, operacao: Operacao<D>, dados: D, contexto: ContextoOperacao): Banco {
  const resultado = executarOperacao(banco, operacao, dados, contexto);
  if (!resultado.ok) throw new Error(`Recusada sem querer: ${resultado.erro}`);
  return resultado.banco;
}

/** Executa esperando a recusa; devolve a mensagem. */
function recusa<D>(banco: Banco, operacao: Operacao<D>, dados: D, contexto: ContextoOperacao): string {
  const resultado = executarOperacao(banco, operacao, dados, contexto);
  expect(resultado.ok).toBe(false);
  return resultado.ok ? "" : resultado.erro;
}

const AULA_AVULSA: DadosNovoLancamento = {
  tipo: "receber",
  categoria: "Aula avulsa",
  pessoaId: "a01",
  item: "Aula avulsa",
  valor: 90,
  vencimento: "2026-11-10",
};

function reservaAguardando(parcial: Partial<Ocupacao> = {}): Ocupacao {
  return {
    id: "oc-reserva",
    quadraId: "2",
    data: "2026-11-12",
    horaInicio: "10:00",
    horaFim: "11:00",
    tipo: "Locação Avulsa",
    situacao: "aguardando_pagamento",
    prazoPagamento: "2026-11-11T18:00:00",
    criadoEm: "2026-11-10T18:00:00",
    ...parcial,
  };
}

function cobrancaDaReserva(ocupacao: Ocupacao): Lancamento {
  return {
    id: "lc-reserva",
    tipo: "receber",
    categoria: "Locação",
    pessoaId: "a05",
    pessoaTipo: "aluno",
    nomePagante: "Igor",
    item: "Locação avulsa · Quadra 2",
    valor: precoDaLocacao(semente.configuracoes, ocupacao),
    vencimento: "2026-11-11",
    ocupacaoId: ocupacao.id,
    criadoEm: ocupacao.criadoEm,
  };
}

describe("situacao do lancamento", () => {
  it("fica pendente ate o vencimento e passa a em atraso no dia seguinte", () => {
    const banco = gravar(bancoLimpo(), criarLancamento, AULA_AVULSA, ctx("2026-11-01"));
    const [lancamento] = banco.lancamentos;
    expect(situacaoLancamento(lancamento, "2026-11-10")).toBe("pendente");
    expect(situacaoLancamento(lancamento, "2026-11-11")).toBe("em_atraso");

    const atrasados = { tipo: "receber", situacao: "em_atraso", mes: "todos" } as const;
    expect(listarLancamentos(banco, atrasados, "2026-11-10")).toHaveLength(0);
    const [linha] = listarLancamentos(banco, atrasados, "2026-11-13");
    expect(linha.lancamento.id).toBe(lancamento.id);
    expect(linha.diasEmAtraso).toBe(3);
  });
});

describe("novo lancamento", () => {
  it("valor zero, negativo ou invalido e recusado", () => {
    const banco = bancoLimpo();
    [0, -10, Number.NaN, 0.001].forEach((valor) => {
      expect(recusa(banco, criarLancamento, { ...AULA_AVULSA, valor }, ctx("2026-11-01"))).toBe(
        "O valor precisa ser maior que zero.",
      );
    });
  });

  it("recusa data invalida, item vazio e categoria do outro tipo", () => {
    const banco = bancoLimpo();
    const c = ctx("2026-11-01");
    expect(recusa(banco, criarLancamento, { ...AULA_AVULSA, vencimento: "2026-02-30" }, c)).toBe(
      "Informe uma data de vencimento válida.",
    );
    expect(recusa(banco, criarLancamento, { ...AULA_AVULSA, item: "   " }, c)).toBe(
      "Descreva o item do lançamento.",
    );
    expect(recusa(banco, criarLancamento, { ...AULA_AVULSA, categoria: "Despesa" }, c)).toBe(
      "Escolha uma categoria de conta a receber.",
    );
  });

  it("guarda quem pagou quando e outra pessoa, e o lancamento ja pago com comprovante", () => {
    const banco = gravar(
      bancoLimpo(),
      criarLancamento,
      {
        ...AULA_AVULSA,
        nomePagante: "Helena Lima",
        pagoEm: "2026-11-01",
        formaPagamento: "Stone",
        comprovante: "recibo.pdf",
      },
      ctx("2026-11-01", recepcao),
    );
    expect(banco.lancamentos[0]).toMatchObject({
      pessoaId: "a01",
      pessoaTipo: "aluno",
      nomePagante: "Helena Lima",
      pagoEm: "2026-11-01",
      formaPagamento: "Stone",
      comprovante: "recibo.pdf",
    });
    expect(banco.auditoria[0]).toMatchObject({
      tabela: "lancamentos",
      acao: "criar",
      usuarioId: recepcao.id,
      operacao: "Novo lançamento",
    });
  });

  it("conta a pagar exige o favorecido e so quem ve as contas a pagar lanca (H9)", () => {
    const despesa: DadosNovoLancamento = {
      tipo: "pagar",
      categoria: "Despesa",
      nomePagante: "Companhia de energia",
      item: "Energia elétrica",
      valor: 1850,
      vencimento: "2026-11-10",
    };
    expect(recusa(bancoLimpo(), criarLancamento, { ...despesa, nomePagante: "" }, ctx("2026-11-01"))).toBe(
      "Informe o favorecido (quem vai receber o pagamento).",
    );
    expect(recusa(bancoLimpo(), criarLancamento, despesa, ctx("2026-11-01", recepcao))).toBe(
      "Seu perfil não tem acesso às contas a pagar.",
    );
    expect(recusa(bancoLimpo(), criarLancamento, AULA_AVULSA, ctx("2026-11-01", professora))).toBe(
      "Seu perfil não tem acesso ao financeiro.",
    );
    expect(gravar(bancoLimpo(), criarLancamento, despesa, ctx("2026-11-01")).lancamentos).toHaveLength(1);
  });

  it("mensalidade a mao exige matricula vigente e nao duplica o mes", () => {
    const matricula: Matricula = {
      id: "mt-a01",
      alunoId: "a01",
      planoId: "pl-ind",
      valorMensal: 720,
      diaVencimento: 10,
      inicio: "2026-01-15",
    };
    const banco = bancoLimpo({ matriculas: [matricula] });
    const mensalidade: DadosNovoLancamento = {
      ...AULA_AVULSA,
      categoria: "Mensalidade",
      item: "Mensalidade nov/2026",
      valor: 720,
    };
    expect(
      recusa(banco, criarLancamento, { ...mensalidade, pessoaId: "a02" }, ctx("2026-11-01")),
    ).toMatch(/não tem matrícula vigente em 10\/11\/2026/);

    const comUma = gravar(banco, criarLancamento, mensalidade, ctx("2026-11-01"));
    expect(comUma.lancamentos[0]).toMatchObject({ matriculaId: "mt-a01", competencia: "2026-11" });
    expect(recusa(comUma, criarLancamento, mensalidade, ctx("2026-11-01"))).toMatch(
      /Já existe a mensalidade de novembro de 2026/,
    );
    // E "Gerar mensalidades" reconhece a que foi lancada a mao.
    const gerado = gravar(comUma, gerarMensalidades, { competencia: "2026-11" }, ctx("2026-11-01"));
    expect(gerado.lancamentos).toHaveLength(1);
  });
});

describe("registrar pagamento", () => {
  it("pagar a cobranca de uma reserva confirma a reserva na mesma operacao", () => {
    const reserva = reservaAguardando();
    const banco = bancoLimpo({ ocupacoes: [reserva], lancamentos: [cobrancaDaReserva(reserva)] });
    const pago = gravar(
      banco,
      registrarPagamento,
      { id: "lc-reserva", pagoEm: "2026-11-11", formaPagamento: "Dinheiro" },
      ctx("2026-11-11", recepcao),
    );
    expect(pago.ocupacoes[0].situacao).toBe("agendada");
    expect(pago.lancamentos[0]).toMatchObject({ pagoEm: "2026-11-11", formaPagamento: "Dinheiro" });
    expect(pago.auditoria.map((r) => r.tabela).sort()).toEqual(["lancamentos", "ocupacoes"]);
    expect(pago.auditoria.every((r) => r.operacao === "Registrar pagamento")).toBe(true);
  });

  it("nao mexe na reserva que nao esta aguardando pagamento", () => {
    const cancelada = reservaAguardando({ situacao: "cancelada", motivoCancelamento: "Desistiu" });
    const banco = bancoLimpo({ ocupacoes: [cancelada], lancamentos: [cobrancaDaReserva(cancelada)] });
    const pago = gravar(
      banco,
      registrarPagamento,
      { id: "lc-reserva", pagoEm: "2026-11-11", formaPagamento: "Stone" },
      ctx("2026-11-11"),
    );
    expect(pago.ocupacoes).toBe(banco.ocupacoes);
    expect(pago.ocupacoes[0].situacao).toBe("cancelada");
  });

  it("nao paga lancamento anulado nem lancamento ja pago", () => {
    const aberto = gravar(bancoLimpo(), criarLancamento, AULA_AVULSA, ctx("2026-11-01"));
    const id = aberto.lancamentos[0].id;
    const pagamento = { id, pagoEm: "2026-11-02", formaPagamento: "Stone" };

    const pago = gravar(aberto, registrarPagamento, pagamento, ctx("2026-11-02"));
    expect(recusa(pago, registrarPagamento, pagamento, ctx("2026-11-03"))).toBe(
      "Este lançamento já foi pago em 02/11/2026.",
    );

    const anulado = gravar(aberto, anularLancamento, { id, motivo: "Lançado em dobro" }, ctx("2026-11-02"));
    expect(recusa(anulado, registrarPagamento, pagamento, ctx("2026-11-02"))).toBe(
      "Este lançamento foi anulado e não pode ser pago.",
    );
  });

  it("confere a data, a forma de pagamento e a parte do convenio", () => {
    const banco = gravar(bancoLimpo(), criarLancamento, AULA_AVULSA, ctx("2026-11-01"));
    const id = banco.lancamentos[0].id;
    const c = ctx("2026-11-05");
    expect(recusa(banco, registrarPagamento, { id, pagoEm: "2026-11-06", formaPagamento: "Stone" }, c)).toBe(
      "A data do pagamento não pode ser depois de hoje.",
    );
    expect(recusa(banco, registrarPagamento, { id, pagoEm: "2026-11-05", formaPagamento: "" }, c)).toBe(
      "Escolha a forma de pagamento.",
    );
    expect(recusa(banco, registrarPagamento, { id, pagoEm: "2026-11-05", formaPagamento: "Cheque" }, c)).toBe(
      "Forma de pagamento desconhecida: Cheque.",
    );
    expect(
      recusa(banco, registrarPagamento, { id, pagoEm: "2026-11-05", formaPagamento: "Total Pass", valorConvenio: 91 }, c),
    ).toBe("A parte coberta pelo convênio não pode ser maior que o valor do lançamento.");

    const pago = gravar(
      banco,
      registrarPagamento,
      { id, pagoEm: "2026-11-05", formaPagamento: "Total Pass", valorConvenio: 63, nomePagante: "Empresa X" },
      c,
    );
    expect(pago.lancamentos[0]).toMatchObject({ valorConvenio: 63, nomePagante: "Empresa X" });
  });
});

describe("anular lancamento", () => {
  it("exige motivo e nunca apaga: o lancamento continua la, anulado", () => {
    const banco = gravar(bancoLimpo(), criarLancamento, AULA_AVULSA, ctx("2026-11-01"));
    const id = banco.lancamentos[0].id;
    expect(recusa(banco, anularLancamento, { id, motivo: "   " }, ctx("2026-11-02"))).toBe(
      "Escreva o motivo da anulação.",
    );

    const anulado = gravar(banco, anularLancamento, { id, motivo: "Aula remarcada" }, ctx("2026-11-02"));
    expect(anulado.lancamentos).toHaveLength(1);
    expect(anulado.lancamentos[0]).toMatchObject({
      canceladoEm: "2026-11-02T10:00:00",
      motivoCancelamento: "Aula remarcada",
    });
    expect(situacaoLancamento(anulado.lancamentos[0], "2026-11-20")).toBe("cancelado");
    expect(anulado.auditoria.at(-1)).toMatchObject({ acao: "alterar", operacao: "Anular lançamento" });
    // Anulado sai dos totais em aberto, mas aparece no filtro "anulado".
    expect(listarLancamentos(anulado, { tipo: "receber", situacao: "em_aberto" }, "2026-11-20")).toHaveLength(0);
    expect(listarLancamentos(anulado, { tipo: "receber", situacao: "cancelado" }, "2026-11-20")).toHaveLength(1);
    expect(recusa(anulado, anularLancamento, { id, motivo: "De novo" }, ctx("2026-11-03"))).toBe(
      "Este lançamento já foi anulado em 02/11/2026.",
    );
  });

  it("nao deixa uma reserva aguardando pagamento sem cobranca", () => {
    const reserva = reservaAguardando();
    const banco = bancoLimpo({ ocupacoes: [reserva], lancamentos: [cobrancaDaReserva(reserva)] });
    expect(recusa(banco, anularLancamento, { id: "lc-reserva", motivo: "Desistiu" }, ctx("2026-11-11"))).toMatch(
      /reserva que ainda aguarda pagamento/,
    );
  });
});

describe("gerar mensalidades do mes", () => {
  const matriculas: Matricula[] = [
    { id: "mt-vigente", alunoId: "a01", planoId: "pl-ind", valorMensal: 720, diaVencimento: 10, inicio: "2026-01-15" },
    { id: "mt-encerrada", alunoId: "a02", planoId: "pl-ind", valorMensal: 720, diaVencimento: 10, inicio: "2026-01-15", fim: "2026-10-31" },
    { id: "mt-futura", alunoId: "a03", planoId: "pl-dup", valorMensal: 520, diaVencimento: 10, inicio: "2026-12-01" },
    { id: "mt-comeca-depois", alunoId: "a04", planoId: "pl-lap", valorMensal: 380, diaVencimento: 5, inicio: "2026-11-20" },
    { id: "mt-congelada", alunoId: "a09", planoId: "pl-ind-ant", valorMensal: 640, diaVencimento: 15, inicio: "2025-01-01" },
  ];
  const congelamentos = [
    { id: "cg-a09", matriculaId: "mt-congelada", inicio: "2026-10-20", fimPrevisto: "2026-12-01", motivo: "Viagem" },
  ];
  const banco = bancoLimpo({ matriculas, congelamentos });

  it("cria so as das matriculas vigentes no vencimento e e idempotente", () => {
    const previa = previaDasMensalidades(banco, "2026-11");
    expect(previa.itens.map((i) => i.matriculaId).sort()).toEqual(["mt-congelada", "mt-vigente"]);
    expect(previa.total).toBe(1360);
    expect(previa.congeladas).toBe(1);

    const uma = gravar(banco, gerarMensalidades, { competencia: "2026-11" }, ctx("2026-10-29", recepcao));
    expect(uma.lancamentos).toHaveLength(2);
    expect(uma.lancamentos.find((l) => l.matriculaId === "mt-vigente")).toMatchObject({
      tipo: "receber",
      categoria: "Mensalidade",
      pessoaId: "a01",
      valor: 720,
      vencimento: "2026-11-10",
      competencia: "2026-11",
    });

    // Rodar de novo nao cria nada e nao grava nada.
    const resultado = executarOperacao(uma, gerarMensalidades, { competencia: "2026-11" }, ctx("2026-10-30"));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.banco.lancamentos).toHaveLength(2);
    expect(resultado.banco.auditoria).toHaveLength(uma.auditoria.length);
    expect(previaDasMensalidades(uma, "2026-11")).toMatchObject({ itens: [], jaGeradas: 2 });
  });

  it("congelado (H4) recebe a cobranca e a lista sinaliza", () => {
    const gerado = gravar(banco, gerarMensalidades, { competencia: "2026-11" }, ctx("2026-10-29"));
    const linhas = listarLancamentos(gerado, { tipo: "receber" }, "2026-10-29");
    const congelada = linhas.find((l) => l.lancamento.matriculaId === "mt-congelada");
    expect(congelada?.congelada).toBe(true);
    expect(linhas.find((l) => l.lancamento.matriculaId === "mt-vigente")?.congelada).toBe(false);
  });

  it("mensalidade anulada nao volta ao gerar de novo", () => {
    const gerado = gravar(banco, gerarMensalidades, { competencia: "2026-11" }, ctx("2026-10-29"));
    const id = gerado.lancamentos[0].id;
    const anulado = gravar(gerado, anularLancamento, { id, motivo: "Bolsa integral" }, ctx("2026-10-29"));
    const outraVez = gravar(anulado, gerarMensalidades, { competencia: "2026-11" }, ctx("2026-10-29"));
    expect(outraVez.lancamentos).toHaveLength(2);
  });

  it("recusa mes invalido", () => {
    expect(recusa(banco, gerarMensalidades, { competencia: "2026-13" }, ctx("2026-10-29"))).toBe(
      "Escolha um mês válido.",
    );
  });
});

describe("fechar repasse do mes", () => {
  const aula = (id: string, data: string, situacao: Ocupacao["situacao"] = "realizada"): Ocupacao => ({
    id,
    quadraId: "2",
    data,
    horaInicio: "10:00",
    horaFim: "11:00",
    tipo: "Individual",
    professorId: "prof-1",
    situacao,
    criadoEm: "2026-09-01T06:00:00",
  });
  const banco = bancoLimpo({
    ocupacoes: [
      aula("o1", "2026-10-05"),
      aula("o2", "2026-10-12"),
      aula("o3", "2026-10-19", "cancelada"),
      aula("o4", "2026-11-02"),
    ],
  });
  const dados = { competencia: "2026-10", vencimento: "2026-11-05" };

  it("cria o repasse e a conta a pagar, e nao fecha o mesmo mes duas vezes", () => {
    expect(recusa(banco, fecharRepasseDoMes, dados, ctx("2026-10-29"))).toBe(
      "Só dá para fechar o repasse de um mês que já terminou: outubro de 2026 ainda não acabou.",
    );

    const fechado = gravar(banco, fecharRepasseDoMes, dados, ctx("2026-11-03"));
    // Professor 1 cobra R$ 78 por hora: 2 aulas realizadas de 1h (a cancelada nao conta).
    expect(fechado.repasses).toHaveLength(1);
    expect(fechado.repasses[0]).toMatchObject({
      professorId: "prof-1",
      competencia: "2026-10",
      aulasDadas: 2,
      minutosDados: 120,
      valorPrevisto: 156,
      fechadoEm: "2026-11-03T10:00:00",
    });
    expect(fechado.lancamentos).toHaveLength(1);
    expect(fechado.lancamentos[0]).toMatchObject({
      tipo: "pagar",
      categoria: "Repasse",
      pessoaId: "prof-1",
      pessoaTipo: "professor",
      valor: 156,
      vencimento: "2026-11-05",
      competencia: "2026-10",
      repasseId: fechado.repasses[0].id,
    });

    expect(recusa(fechado, fecharRepasseDoMes, dados, ctx("2026-11-04"))).toBe(
      "O repasse de outubro de 2026 já foi fechado.",
    );

    const relatorio = relatorioDeProfessores(fechado, "2026-10", "2026-11-04");
    const linha = relatorio.linhas.find((l) => l.professor.id === "prof-1");
    expect(linha).toMatchObject({ situacao: "a_pagar", previsto: 156, pago: 0, emAberto: 156, diferenca: 156 });
    expect(relatorio.aFechar).toHaveLength(0);
  });

  it("depois de fechado, o previsto fica congelado no fechamento", () => {
    const fechado = gravar(banco, fecharRepasseDoMes, dados, ctx("2026-11-03"));
    // Uma aula de outubro marcada como realizada depois do fechamento...
    const comAulaAtrasada = { ...fechado, ocupacoes: [...fechado.ocupacoes, aula("o5", "2026-10-26")] };
    const linha = relatorioDeProfessores(comAulaAtrasada, "2026-10", "2026-11-04").linhas.find(
      (l) => l.professor.id === "prof-1",
    );
    // ...nao muda o que foi fechado.
    expect(linha).toMatchObject({ aulasDadas: 2, previsto: 156 });
  });

  it("desconta o adiantamento ja lancado e exige perfil com contas a pagar", () => {
    const adiantado = gravar(
      banco,
      criarLancamento,
      {
        tipo: "pagar",
        categoria: "Repasse",
        pessoaId: "prof-1",
        competencia: "2026-10",
        item: "Adiantamento",
        valor: 50,
        vencimento: "2026-10-20",
      },
      ctx("2026-10-20"),
    );
    expect(recusa(adiantado, fecharRepasseDoMes, dados, ctx("2026-11-03", recepcao))).toBe(
      "Seu perfil não tem acesso às contas a pagar.",
    );
    const fechado = gravar(adiantado, fecharRepasseDoMes, dados, ctx("2026-11-03"));
    const conta = fechado.lancamentos.find((l) => l.repasseId);
    expect(conta?.valor).toBe(106);
  });

  it("recusa mes sem aulas", () => {
    expect(recusa(banco, fecharRepasseDoMes, { ...dados, competencia: "2026-08" }, ctx("2026-11-03"))).toBe(
      "Nenhum professor deu aulas em agosto de 2026.",
    );
  });
});

describe("indicadores e lista (dados de exemplo inteiros)", () => {
  const banco = gerarBancoInicial();
  const mes = HOJE.slice(0, 7);
  const indicadores = indicadoresDoMes(banco, mes, HOJE);
  const soma = (lista: Lancamento[]) => lista.reduce((s, l) => s + l.valor, 0);

  it("os totais de cada indicador batem com a soma da lista do mesmo filtro", () => {
    (["recebido", "aReceber", "emAtraso", "aPagar"] as const).forEach((chave) => {
      const linhas = listarLancamentos(banco, indicadores[chave].filtro, HOJE);
      expect(indicadores[chave].quantidade, chave).toBe(linhas.length);
      expect(indicadores[chave].valor, chave).toBeCloseTo(soma(linhas.map((l) => l.lancamento)), 2);
      expect(totalizar(linhas), chave).toEqual({
        quantidade: indicadores[chave].quantidade,
        valor: indicadores[chave].valor,
      });
    });
  });

  it("e batem com a conta feita direto nas tabelas, sem a consulta", () => {
    const aReceber = banco.lancamentos.filter((l) => l.tipo === "receber" && !l.canceladoEm);
    const atrasados = aReceber.filter((l) => !l.pagoEm && l.vencimento < HOJE);
    const recebidos = aReceber.filter((l) => l.pagoEm?.startsWith(mes));

    expect(atrasados.length).toBeGreaterThan(0);
    expect(indicadores.emAtraso.quantidade).toBe(atrasados.length);
    expect(indicadores.emAtraso.valor).toBeCloseTo(soma(atrasados), 2);
    expect(indicadores.recebido.quantidade).toBe(recebidos.length);
    expect(indicadores.recebido.valor).toBeCloseTo(soma(recebidos), 2);
    // O relatorio por forma de pagamento reparte o mesmo recebido.
    expect(recebidoPorForma(banco, mes, HOJE).total).toBeCloseTo(indicadores.recebido.valor, 2);
  });

  it("os dados de exemplo deixam um mes terminado para fechar e uma conta a pagar atrasada", () => {
    const anterior = relatorioDeProfessores(banco, somarMesesNaCompetencia(mes, -1), HOJE);
    expect(anterior.aFechar.length).toBeGreaterThan(0);
    const contasAtrasadas = listarLancamentos(banco, { tipo: "pagar", situacao: "em_atraso" }, HOJE);
    expect(contasAtrasadas.length).toBeGreaterThan(0);
    // "A pagar" do mes inclui a conta que atrasou num mes anterior.
    expect(indicadores.aPagar.vencidas).toBe(contasAtrasadas.length);
  });
});

describe("planilha (CSV)", () => {
  it("abre no Excel: marca UTF-8, separador ponto e virgula e formato brasileiro", () => {
    const banco = gravar(
      bancoLimpo(),
      criarLancamento,
      {
        ...AULA_AVULSA,
        item: 'Aula; "especial"',
        nomePagante: "=SOMA(A1)",
        valor: 1234.5,
        pagoEm: "2026-11-01",
        formaPagamento: "Total Pass",
        valorConvenio: 864.15,
      },
      ctx("2026-11-01"),
    );
    const csv = gerarCsv(listarLancamentos(banco, { tipo: "receber" }, "2026-11-01"));
    expect(csv.startsWith("﻿")).toBe(true);
    const [cabecalho, linha] = csv.slice(1).split("\r\n");
    expect(cabecalho.split(";")).toHaveLength(15);
    expect(cabecalho.startsWith("Tipo;Situação;Vencimento;Pago em")).toBe(true);
    expect(linha).toContain("A receber;Pago;10/11/2026;01/11/2026;Guilherme Lima;'=SOMA(A1)");
    expect(linha).toContain('"Aula; ""especial"""');
    expect(linha).toContain(";1.234,50;864,15;");
  });
});

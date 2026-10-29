/**
 * Testes das consultas do Painel: os numeros dos cartoes tem de bater com as
 * listas e com os dados (o MVP mostrava 12 atrasadas no cartao e 6 na lista).
 */

import { describe, expect, it } from "vitest";
import { HOJE } from "../banco/constantes";
import { saldoDoProduto } from "../banco/regras/estoque";
import { extratoReposicao } from "../banco/regras/reposicao";
import { gerarBancoInicial } from "../banco/semente";
import type {
  Banco,
  Colaborador,
  LancamentoReposicao,
  Ocupacao,
  OcupacaoAluno,
  Perfil,
} from "../banco/tipos";
import { somarDias } from "../date";
import {
  buscarAlunosRapido,
  alunosDoProfessor,
  descricaoDaArena,
  ocupacaoDasQuadras,
  precisaDeAtencao,
  proximosHorarios,
  resumoDoDia,
  type GrupoDeAtencao,
  type PrecisaDeAtencao,
} from "./painel";

const banco = gerarBancoInicial();

function colaborador(perfil: Perfil): Colaborador {
  const encontrado = banco.colaboradores.find((c) => c.perfil === perfil);
  if (!encontrado) throw new Error(`Sem colaborador com perfil ${perfil}.`);
  return encontrado;
}

const dono = colaborador("dono");
const recepcao = colaborador("recepcao");

function grupo<T extends GrupoDeAtencao["tipo"]>(
  atencao: PrecisaDeAtencao,
  tipo: T,
): Extract<GrupoDeAtencao, { tipo: T }> {
  const encontrado = atencao.grupos.find((g) => g.tipo === tipo);
  if (!encontrado) throw new Error(`Grupo ${tipo} ausente.`);
  return encontrado as Extract<GrupoDeAtencao, { tipo: T }>;
}

describe("precisa de atencao: contagem coerente com os dados", () => {
  const atencao = precisaDeAtencao(banco, dono, HOJE, "12:00");

  it("cada grupo tem exatamente os registros que pedem ação", () => {
    const reservas = banco.ocupacoes.filter((o) => o.situacao === "aguardando_pagamento");
    const mensalidades = banco.lancamentos.filter(
      (l) =>
        l.tipo === "receber" &&
        l.categoria === "Mensalidade" &&
        !l.pagoEm &&
        !l.canceladoEm &&
        l.vencimento < HOJE,
    );
    const produtos = banco.produtos.filter(
      (p) => p.ativo && saldoDoProduto(banco.movimentosEstoque, p.id) < p.estoqueMinimo,
    );
    const limite = somarDias(HOJE, 30);
    const alunosComCreditoAVencer = banco.alunos.filter(
      (a) =>
        a.ativo &&
        extratoReposicao(banco.reposicoes, a.id, HOJE).creditos.some(
          (c) => !c.vencido && c.restante > 0 && (c.credito.validade ?? "") <= limite,
        ),
    );

    // Os dados de exemplo tem casos de todos os grupos; sem isso o teste nao prova nada.
    [reservas, mensalidades, produtos, alunosComCreditoAVencer].forEach((lista) =>
      expect(lista.length).toBeGreaterThan(0),
    );

    expect(grupo(atencao, "reservas").itens.map((r) => r.ocupacao.id).sort()).toEqual(
      reservas.map((o) => o.id).sort(),
    );
    expect(grupo(atencao, "mensalidades").itens.map((m) => m.lancamento.id).sort()).toEqual(
      mensalidades.map((l) => l.id).sort(),
    );
    expect(grupo(atencao, "produtos").itens.map((p) => p.produto.id).sort()).toEqual(
      produtos.map((p) => p.id).sort(),
    );
    expect(grupo(atencao, "reposicoes").itens.map((r) => r.aluno.id).sort()).toEqual(
      alunosComCreditoAVencer.map((a) => a.id).sort(),
    );
  });

  it("o total do cartão é a soma das listas, e o valor em atraso é a soma das mensalidades", () => {
    const soma = atencao.grupos.reduce((total, g) => total + g.itens.length, 0);
    expect(atencao.total).toBe(soma);
    const mensalidades = grupo(atencao, "mensalidades");
    expect(mensalidades.valorTotal).toBe(
      mensalidades.itens.reduce((total, m) => total + m.lancamento.valor, 0),
    );
  });

  it("pagar ou anular uma mensalidade tira ela da lista e do total", () => {
    const [primeira, segunda] = grupo(atencao, "mensalidades").itens.map((m) => m.lancamento.id);
    const atualizado: Banco = {
      ...banco,
      lancamentos: banco.lancamentos.map((l) =>
        l.id === primeira
          ? { ...l, pagoEm: HOJE, formaPagamento: "Dinheiro" }
          : l.id === segunda
            ? { ...l, canceladoEm: `${HOJE}T10:00:00`, motivoCancelamento: "Lançado em dobro" }
            : l,
      ),
    };
    const depois = precisaDeAtencao(atualizado, dono, HOJE, "12:00");
    expect(grupo(depois, "mensalidades").itens).toHaveLength(
      grupo(atencao, "mensalidades").itens.length - 2,
    );
    expect(depois.total).toBe(atencao.total - 2);
  });

  it("uma entrada de estoque que passa do mínimo tira o produto da lista", () => {
    const { produto, saldo } = grupo(atencao, "produtos").itens[0];
    const atualizado: Banco = {
      ...banco,
      movimentosEstoque: [
        ...banco.movimentosEstoque,
        {
          id: "mv-teste",
          produtoId: produto.id,
          data: `${HOJE}T10:00:00`,
          tipo: "entrada",
          quantidade: produto.estoqueMinimo - saldo,
          responsavel: "Teste",
        },
      ],
    };
    const depois = precisaDeAtencao(atualizado, dono, HOJE, "12:00");
    expect(grupo(depois, "produtos").itens.some((p) => p.produto.id === produto.id)).toBe(false);
    expect(depois.total).toBe(atencao.total - 1);
  });

  it("quem não vê uma área não recebe o grupo dela, e o total acompanha", () => {
    const deRecepcao = precisaDeAtencao(banco, recepcao, HOJE, "12:00");
    expect(deRecepcao.total).toBe(atencao.total);

    const semEstoque: Banco = {
      ...banco,
      configuracoes: {
        ...banco.configuracoes,
        permissoes: {
          ...banco.configuracoes.permissoes,
          recepcao: banco.configuracoes.permissoes.recepcao.filter((m) => m !== "estoque"),
        },
      },
    };
    const depois = precisaDeAtencao(semEstoque, recepcao, HOJE, "12:00");
    expect(depois.grupos.map((g) => g.tipo)).not.toContain("produtos");
    expect(depois.total).toBe(atencao.total - grupo(atencao, "produtos").itens.length);
  });
});

describe("reservas sem pagamento (H5)", () => {
  const data = somarDias(HOJE, 2);
  const reserva = (id: string, prazo: string): Ocupacao => ({
    id,
    quadraId: "2",
    data,
    horaInicio: id === "r1" ? "08:00" : "09:00",
    horaFim: id === "r1" ? "09:00" : "10:00",
    tipo: "Locação Avulsa",
    situacao: "aguardando_pagamento",
    prazoPagamento: prazo,
    criadoEm: `${HOJE}T08:00:00`,
  });
  const apenasEstas: Banco = {
    ...banco,
    ocupacoes: [
      reserva("r1", `${somarDias(HOJE, 1)}T18:00:00`),
      reserva("r2", `${HOJE}T10:00:00`),
    ],
    ocupacaoAlunos: [],
  };

  it("vencida depois do prazo, e as vencidas vêm primeiro", () => {
    const antes = grupo(precisaDeAtencao(apenasEstas, dono, HOJE, "09:00"), "reservas").itens;
    expect(antes.map((r) => [r.ocupacao.id, r.vencida])).toEqual([
      ["r2", false],
      ["r1", false],
    ]);
    const depois = grupo(precisaDeAtencao(apenasEstas, dono, HOJE, "10:30"), "reservas").itens;
    expect(depois.map((r) => [r.ocupacao.id, r.vencida])).toEqual([
      ["r2", true],
      ["r1", false],
    ]);
  });

  it("sem lançamento ligado, o valor vem do preço da locação das Configurações", () => {
    const [primeira] = grupo(precisaDeAtencao(apenasEstas, dono, HOJE, "09:00"), "reservas").itens;
    expect(primeira.valor).toBe(apenasEstas.configuracoes.precoLocacaoHora);
  });
});

describe("reposicoes a vencer", () => {
  const alunoId = banco.alunos[0].id;
  const credito = (id: string, minutos: number, validade: string): LancamentoReposicao => ({
    id,
    alunoId,
    minutos,
    sigla: "CH",
    validade,
    criadoEm: `${somarDias(HOJE, -60)}T08:00:00`,
  });

  it("entra quem tem crédito com validade em até 30 dias; vencido, usado ou distante não", () => {
    const comCreditos = (reposicoes: LancamentoReposicao[]): Banco => ({ ...banco, reposicoes });
    const itens = (reposicoes: LancamentoReposicao[]) =>
      grupo(precisaDeAtencao(comCreditos(reposicoes), dono, HOJE, "12:00"), "reposicoes").itens;

    expect(itens([credito("c1", 60, somarDias(HOJE, 10))])).toMatchObject([
      { aluno: { id: alunoId }, minutos: 60, diasParaVencer: 10 },
    ]);
    expect(itens([credito("c1", 60, somarDias(HOJE, 31))])).toEqual([]);
    expect(itens([credito("c1", 60, somarDias(HOJE, -1))])).toEqual([]);
    expect(
      itens([
        credito("c1", 60, somarDias(HOJE, 10)),
        { id: "u1", alunoId, minutos: -60, criadoEm: `${somarDias(HOJE, -5)}T08:00:00` },
      ]),
    ).toEqual([]);
  });
});

describe("ocupacao das quadras e indicadores do dia", () => {
  const data = "2030-01-07";
  const ocupacao = (parcial: Partial<Ocupacao>): Ocupacao => ({
    id: "x",
    quadraId: "1",
    data,
    horaInicio: "08:00",
    horaFim: "10:00",
    tipo: "Individual",
    situacao: "agendada",
    criadoEm: "2030-01-01T08:00:00",
    ...parcial,
  });
  const participante = (ocupacaoId: string, alunoId: string, presenca: OcupacaoAluno["presenca"]) => ({
    id: `pa-${ocupacaoId}-${alunoId}`,
    ocupacaoId,
    alunoId,
    presenca,
  });
  const dia: Banco = {
    ...banco,
    ocupacoes: [
      ocupacao({ id: "aula" }),
      ocupacao({ id: "cancelada", horaInicio: "10:00", horaFim: "11:00", situacao: "cancelada", motivoCancelamento: "CH" }),
      ocupacao({ id: "bloqueio", horaInicio: "11:00", horaFim: "12:00", tipo: "Bloqueio", descricao: "Manutenção" }),
      ocupacao({ id: "locacao", quadraId: "2", horaInicio: "18:00", horaFim: "19:00", tipo: "Locação Avulsa" }),
    ],
    ocupacaoAlunos: [
      participante("aula", "a01", "a_marcar"),
      participante("locacao", "a02", "a_marcar"),
      participante("locacao", "a03", "falta_avisada"),
      participante("cancelada", "a04", "a_marcar"),
    ],
  };

  it("a taxa conta aulas e bloqueios ativos; cancelada libera a faixa", () => {
    const [quadra1] = ocupacaoDasQuadras(dia, data, "10:30");
    expect(quadra1.rotulo).toBe("Quadra 1");
    expect(quadra1.minutosOcupados).toBe(180);
    expect(quadra1.taxa).toBeCloseTo(180 / 900);
    expect(quadra1.emAndamento).toBeUndefined();
    expect(quadra1.livreAgora).toBe(true);
    expect(quadra1.proximaFaixaLivre).toBe("10:00");
    expect(quadra1.proxima?.id).toBe("bloqueio");
  });

  it("durante uma aula, mostra a aula e a próxima faixa livre depois dela", () => {
    const [quadra1] = ocupacaoDasQuadras(dia, data, "08:15");
    expect(quadra1.emAndamento?.id).toBe("aula");
    expect(quadra1.livreAgora).toBe(false);
    expect(quadra1.proximaFaixaLivre).toBe("10:00");
  });

  it("sem saber a hora, olha o dia todo; depois das 22h, a arena está fechada", () => {
    expect(ocupacaoDasQuadras(dia, data, null)[0].proximaFaixaLivre).toBe("07:00");
    const [quadra1] = ocupacaoDasQuadras(dia, data, "22:30");
    expect(quadra1.encerrado).toBe(true);
    expect(quadra1.proximaFaixaLivre).toBeNull();
  });

  it("indicadores: bloqueio e cancelada fora do total; quem avisou a falta fora dos alunos", () => {
    const quadras = ocupacaoDasQuadras(dia, data, "07:00");
    const resumo = resumoDoDia(dia, quadras);
    expect(resumo).toMatchObject({ total: 2, aulas: 1, locacoes: 1, partidas: 0, alunosEmQuadra: 2 });
    expect(resumo.quadraMaisCheia).toBe("Quadra 1");
    expect(resumo.ocupacaoMedia).toBeCloseTo((180 / 900 + 60 / 900) / quadras.length);
  });

  it("próximos horários incluem o que está acontecendo; depois do fim do dia, os últimos", () => {
    const quadras = ocupacaoDasQuadras(dia, data, "08:30");
    const agora = proximosHorarios(dia, quadras, "08:30");
    expect(agora.modo).toBe("proximos");
    expect(agora.itens.map((h) => [h.ocupacao.id, h.emAndamento])).toEqual([
      ["aula", true],
      ["bloqueio", false],
      ["locacao", false],
    ]);
    expect(agora.itens[0].alunos.map((a) => a.id)).toEqual(["a01"]);

    const noite = proximosHorarios(dia, ocupacaoDasQuadras(dia, data, "21:00"), "21:00", 2);
    expect(noite.modo).toBe("ultimos");
    expect(noite.itens.map((h) => h.ocupacao.id)).toEqual(["bloqueio", "locacao"]);
  });
});

describe("busca rapida de aluno", () => {
  const nomes = (termo: string, professorId?: string) =>
    buscarAlunosRapido(banco, termo, { hoje: HOJE, professorId }).itens.map((r) => r.aluno.nome);

  it("ignora acentos e maiúsculas e aceita pedaços do nome", () => {
    expect(nomes("joao")[0]).toBe("João Xuxa");
    expect(nomes("GUI LIM")[0]).toBe("Guilherme Lima");
    expect(nomes("")).toEqual([]);
  });

  it("encontra pelo telefone", () => {
    const aluno = banco.alunos.find((a) => a.id === "a02")!;
    const ultimos = aluno.telefone.replace(/\D/g, "").slice(-4);
    expect(nomes(ultimos)).toContain(aluno.nome);
  });

  it("o professor só encontra os próprios alunos (H9)", () => {
    const renata = banco.colaboradores.find((c) => c.perfil === "professor")!;
    const deles = alunosDoProfessor(banco, renata.professorId!, HOJE);
    const resultado = buscarAlunosRapido(banco, "a", { hoje: HOJE, professorId: renata.professorId, limite: 200 });
    expect(resultado.itens.length).toBeGreaterThan(0);
    resultado.itens.forEach((r) => expect(deles.has(r.aluno.id)).toBe(true));
    expect(resultado.total).toBeLessThan(buscarAlunosRapido(banco, "a", { hoje: HOJE }).total);
  });

  it("limita a lista, mas informa quantos combinam", () => {
    const resultado = buscarAlunosRapido(banco, "a", { hoje: HOJE, limite: 5 });
    expect(resultado.itens).toHaveLength(5);
    expect(resultado.total).toBeGreaterThan(5);
  });
});

it("descreve a arena a partir das quadras", () => {
  expect(descricaoDaArena(banco)).toBe("3 quadras de saibro · 1 de cimento · paredão");
});

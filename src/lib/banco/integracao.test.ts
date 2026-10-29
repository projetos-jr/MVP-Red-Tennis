/**
 * Fluxos que atravessam modulos: cada modulo testa as proprias operacoes,
 * aqui se confere que elas conversam entre si como combinado no plano.
 */

import { describe, expect, it } from "vitest";
import { somarDias } from "../date";
import { precisaDeAtencao } from "../consultas/painel";
import { HOJE } from "./constantes";
import { executarOperacao, type ContextoOperacao, type Operacao } from "./executar";
import { criarHorarioAvulso, liberarReserva } from "./operacoes/agenda";
import { congelarPlano } from "./operacoes/alunos";
import { lancarConsumo } from "./operacoes/estoque";
import { anularLancamento, registrarPagamento } from "./operacoes/financeiro";
import { marcarPartida } from "./operacoes/ranking";
import { ocupacaoAtiva } from "./regras/agenda";
import { situacaoLancamento } from "./regras/financeiro";
import { gerarBancoInicial } from "./semente";
import type { Banco } from "./tipos";

const inicial = gerarBancoInicial();
const dono = inicial.colaboradores.find((c) => c.perfil === "dono")!;

function ctx(agora = `${HOJE}T10:00:00`): ContextoOperacao {
  return { usuario: dono, agora, hoje: agora.slice(0, 10) };
}

function rodar<D>(banco: Banco, operacao: Operacao<D>, dados: D, contexto = ctx()): Banco {
  const resultado = executarOperacao(banco, operacao, dados, contexto);
  if (!resultado.ok) throw new Error(`${operacao.nome}: ${resultado.erro}`);
  return resultado.banco;
}

/** Primeiro horario livre (1h) numa quadra, a partir de uma data. */
function horarioLivre(banco: Banco, data: string) {
  for (const quadraId of ["1", "2", "3", "4"] as const) {
    for (let h = 7; h < 22; h += 1) {
      const horaInicio = `${String(h).padStart(2, "0")}:00`;
      const horaFim = `${String(h + 1).padStart(2, "0")}:00`;
      const ocupado = banco.ocupacoes.some(
        (o) =>
          ocupacaoAtiva(o) &&
          o.quadraId === quadraId &&
          o.data === data &&
          o.horaInicio < horaFim &&
          horaInicio < o.horaFim,
      );
      if (!ocupado) return { quadraId, data, horaInicio, horaFim };
    }
  }
  throw new Error("sem horário livre");
}

describe("agenda + financeiro: reserva avulsa", () => {
  const amanha = somarDias(HOJE, 1);
  const livre = horarioLivre(inicial, amanha);
  const comReserva = rodar(inicial, criarHorarioAvulso, {
    ...livre,
    tipo: "Locação Avulsa",
    alunosIds: ["a20"],
  });
  const reserva = comReserva.ocupacoes.at(-1)!;
  const cobranca = comReserva.lancamentos.find((l) => l.ocupacaoId === reserva.id)!;

  it("nasce aguardando pagamento, com a cobrança ligada", () => {
    expect(reserva.situacao).toBe("aguardando_pagamento");
    expect(cobranca).toMatchObject({ tipo: "receber", categoria: "Locação", pessoaId: "a20" });
  });

  it("pagar no financeiro confirma a reserva na agenda", () => {
    const pago = rodar(comReserva, registrarPagamento, {
      id: cobranca.id,
      pagoEm: HOJE,
      formaPagamento: "Dinheiro",
    });
    expect(pago.ocupacoes.find((o) => o.id === reserva.id)?.situacao).toBe("agendada");
    expect(situacaoLancamento(pago.lancamentos.find((l) => l.id === cobranca.id)!, HOJE)).toBe("pago");
  });

  it("o financeiro não anula a cobrança enquanto a reserva aguarda", () => {
    const resultado = executarOperacao(
      comReserva,
      anularLancamento,
      { id: cobranca.id, motivo: "teste" },
      ctx(),
    );
    expect(resultado.ok).toBe(false);
  });

  it("liberar a reserva vencida na agenda anula a cobrança", () => {
    const depoisDoPrazo = `${somarDias(amanha, 1)}T10:00:00`;
    const liberada = rodar(comReserva, liberarReserva, { id: reserva.id }, ctx(depoisDoPrazo));
    expect(liberada.ocupacoes.find((o) => o.id === reserva.id)?.situacao).toBe("cancelada");
    expect(liberada.lancamentos.find((l) => l.id === cobranca.id)?.canceladoEm).toBeTruthy();
  });

  it("a reserva aparece no painel e some de lá depois de paga", () => {
    const antes = precisaDeAtencao(comReserva, dono, HOJE, "10:00");
    const pago = rodar(comReserva, registrarPagamento, {
      id: cobranca.id,
      pagoEm: HOJE,
      formaPagamento: "Dinheiro",
    });
    const depois = precisaDeAtencao(pago, dono, HOJE, "10:00");
    expect(depois.total).toBe(antes.total - 1);
  });
});

describe("estoque + financeiro: consumo no balcão", () => {
  it("o consumo vira cobrança que o financeiro pode receber", () => {
    const comConsumo = rodar(inicial, lancarConsumo, {
      pessoaId: "a01",
      pessoaTipo: "aluno",
      produtoId: "p01",
      quantidade: 2,
    });
    const consumo = comConsumo.consumos.at(-1)!;
    const cobranca = comConsumo.lancamentos.find((l) => l.consumoId === consumo.id)!;
    expect(cobranca).toMatchObject({ categoria: "Consumo", valor: 10, pessoaId: "a01" });
    const pago = rodar(comConsumo, registrarPagamento, {
      id: cobranca.id,
      pagoEm: HOJE,
      formaPagamento: "Stone",
    });
    expect(pago.lancamentos.find((l) => l.id === cobranca.id)?.pagoEm).toBe(HOJE);
  });
});

describe("ranking + agenda: reserva de quadra para partida", () => {
  it("a reserva da partida ocupa a quadra e respeita conflito", () => {
    const data = somarDias(HOJE, 2);
    const livre = horarioLivre(inicial, data);
    const reserva = { quadraId: livre.quadraId, horaInicio: livre.horaInicio, horaFim: livre.horaFim };
    const comPartida = rodar(inicial, marcarPartida, {
      jogadorA: "a01",
      jogadorB: "a02",
      data,
      reserva,
    });
    const ocupacao = comPartida.ocupacoes.at(-1)!;
    expect(ocupacao).toMatchObject({ tipo: "Ranking", data, quadraId: livre.quadraId });

    // A mesma quadra no mesmo horario, agora pela agenda: recusado.
    const conflito = executarOperacao(
      comPartida,
      criarHorarioAvulso,
      { ...livre, tipo: "Locação Avulsa", alunosIds: ["a20"] },
      ctx(),
    );
    expect(conflito.ok).toBe(false);
  });
});

describe("alunos + agenda: congelamento", () => {
  it("congelar cancela as aulas fixas do período sem gerar crédito", () => {
    const aluno = "a01";
    const inicio = somarDias(HOJE, 1);
    const fim = somarDias(HOJE, 21);
    const congelado = rodar(inicial, congelarPlano, {
      alunoId: aluno,
      inicio,
      fimPrevisto: fim,
      motivo: "Viagem",
    });
    const minhasDepois = congelado.ocupacaoAlunos.filter((p) => p.alunoId === aluno);
    const aulasNoPeriodo = congelado.ocupacoes.filter(
      (o) =>
        o.horarioFixoId &&
        o.data >= inicio &&
        o.data <= fim &&
        ocupacaoAtiva(o) &&
        minhasDepois.some((p) => p.ocupacaoId === o.id),
    );
    expect(aulasNoPeriodo).toHaveLength(0);
    expect(congelado.reposicoes.length).toBe(inicial.reposicoes.length);
  });
});

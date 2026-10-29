/**
 * Testes das regras do banco de exemplo.
 * Os mesmos casos viram testes do banco real (pgTAP) quando o Supabase entrar.
 */

import { describe, expect, it } from "vitest";
import { adicionarComentario, apagarComentario, alterarConfiguracoes } from "../operacoes/base";
import { executarOperacao, type ContextoOperacao } from "../executar";
import { gerarBancoInicial } from "../semente";
import type { Banco, LancamentoReposicao, Ocupacao } from "../tipos";
import { conflitosNaQuadra, garantirQuadraLivre } from "./agenda";
import { ErroDeRegra } from "./comum";
import { situacaoLancamento } from "./financeiro";
import { extratoReposicao } from "./reposicao";

function ocupacao(parcial: Partial<Ocupacao>): Ocupacao {
  return {
    id: "x",
    quadraId: "1",
    data: "2026-11-10",
    horaInicio: "10:00",
    horaFim: "11:00",
    tipo: "Individual",
    situacao: "agendada",
    criadoEm: "2026-11-01T10:00:00",
    ...parcial,
  };
}

describe("conflito de quadra", () => {
  const existente = ocupacao({ id: "a" });

  it("recusa 10:30-11:30 quando ja existe 10:00-11:00 na mesma quadra", () => {
    const alvo = { quadraId: "1" as const, data: "2026-11-10", horaInicio: "10:30", horaFim: "11:30" };
    expect(conflitosNaQuadra([existente], alvo)).toHaveLength(1);
  });

  it("aceita 11:00-12:00 (uma termina quando a outra comeca)", () => {
    const alvo = { quadraId: "1" as const, data: "2026-11-10", horaInicio: "11:00", horaFim: "12:00" };
    expect(conflitosNaQuadra([existente], alvo)).toHaveLength(0);
  });

  it("aceita o mesmo horario em outra quadra ou em outra data", () => {
    expect(
      conflitosNaQuadra([existente], { quadraId: "2", data: "2026-11-10", horaInicio: "10:00", horaFim: "11:00" }),
    ).toHaveLength(0);
    expect(
      conflitosNaQuadra([existente], { quadraId: "1", data: "2026-11-11", horaInicio: "10:00", horaFim: "11:00" }),
    ).toHaveLength(0);
  });

  it("ignora ocupacoes canceladas", () => {
    const cancelada = ocupacao({ id: "c", situacao: "cancelada", motivoCancelamento: "CH" });
    expect(
      conflitosNaQuadra([cancelada], { quadraId: "1", data: "2026-11-10", horaInicio: "10:00", horaFim: "11:00" }),
    ).toHaveLength(0);
  });

  it("bloqueio segue a mesma regra e a mensagem diz quem ocupa", () => {
    const banco = { ...gerarBancoInicial(), ocupacoes: [ocupacao({ id: "b", tipo: "Bloqueio", descricao: "Manutenção" })] };
    expect(() =>
      garantirQuadraLivre(banco, { quadraId: "1", data: "2026-11-10", horaInicio: "10:30", horaFim: "11:00" }),
    ).toThrowError(/Quadra 1 já está ocupada em 10\/11 das 10:00 às 11:00 \(Bloqueio · Manutenção\)/);
  });
});

describe("extrato de reposicao", () => {
  const credito = (id: string, minutos: number, criadoEm: string, validade: string): LancamentoReposicao => ({
    id,
    alunoId: "a1",
    minutos,
    validade,
    criadoEm,
  });
  const uso = (id: string, minutos: number, criadoEm: string): LancamentoReposicao => ({
    id,
    alunoId: "a1",
    minutos: -minutos,
    criadoEm,
  });

  it("credito de 60 em 1/11 e uso de 30 em 10/11 deixam saldo de 30", () => {
    const extrato = extratoReposicao(
      [credito("c1", 60, "2026-11-01T08:00:00", "2027-02-01"), uso("u1", 30, "2026-11-10T08:00:00")],
      "a1",
      "2026-11-15",
    );
    expect(extrato.saldo).toBe(30);
  });

  it("credito vencido nao conta no saldo", () => {
    const extrato = extratoReposicao(
      [credito("c1", 60, "2026-07-01T08:00:00", "2026-10-01")],
      "a1",
      "2026-11-15",
    );
    expect(extrato.saldo).toBe(0);
    expect(extrato.creditos[0].vencido).toBe(true);
  });

  it("o uso consome primeiro o credito que vence antes", () => {
    const extrato = extratoReposicao(
      [
        credito("tarde", 60, "2026-10-01T08:00:00", "2027-01-20"),
        credito("cedo", 60, "2026-10-02T08:00:00", "2026-12-01"),
        uso("u1", 60, "2026-10-05T08:00:00"),
      ],
      "a1",
      "2026-10-10",
    );
    const restante = Object.fromEntries(extrato.creditos.map((c) => [c.credito.id, c.restante]));
    expect(restante).toEqual({ cedo: 0, tarde: 60 });
    expect(extrato.proximoVencimento).toEqual({ data: "2027-01-20", minutos: 60 });
  });
});

describe("situacao do lancamento", () => {
  const base = {
    id: "l",
    tipo: "receber" as const,
    categoria: "Mensalidade" as const,
    item: "Mensalidade",
    valor: 100,
    vencimento: "2026-11-10",
    criadoEm: "2026-11-01T00:00:00",
  };

  it("pendente antes do vencimento, em atraso depois, pago quando tem data de pagamento", () => {
    expect(situacaoLancamento(base, "2026-11-10")).toBe("pendente");
    expect(situacaoLancamento(base, "2026-11-11")).toBe("em_atraso");
    expect(situacaoLancamento({ ...base, pagoEm: "2026-11-12" }, "2026-11-20")).toBe("pago");
    expect(situacaoLancamento({ ...base, canceladoEm: "2026-11-02" }, "2026-11-20")).toBe("cancelado");
  });
});

describe("operacoes e auditoria", () => {
  const banco: Banco = gerarBancoInicial();
  const [dono, recepcao] = banco.colaboradores;
  const ctx = (usuario = recepcao): ContextoOperacao => ({
    usuario,
    agora: "2026-11-10T09:00:00",
    hoje: "2026-11-10",
  });

  it("grava a operacao e registra a auditoria com usuario e operacao", () => {
    const resultado = executarOperacao(
      banco,
      adicionarComentario,
      { entidade: "aluno", entidadeId: "a01", texto: "Teste" },
      ctx(),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const novo = resultado.banco.comentarios.at(-1);
    expect(novo?.autorNome).toBe(recepcao.nome);
    expect(resultado.banco.auditoria).toHaveLength(1);
    expect(resultado.banco.auditoria[0]).toMatchObject({
      tabela: "comentarios",
      acao: "criar",
      usuarioId: recepcao.id,
      operacao: "Adicionar comentário",
    });
  });

  it("regra violada nao grava nada e devolve a mensagem", () => {
    const resultado = executarOperacao(
      banco,
      adicionarComentario,
      { entidade: "aluno", entidadeId: "a01", texto: "   " },
      ctx(),
    );
    expect(resultado).toEqual({ ok: false, erro: "Escreva o comentário antes de salvar." });
  });

  it("so o autor apaga o proprio comentario", () => {
    const deOutro = banco.comentarios.find((c) => c.autorId !== recepcao.id);
    expect(deOutro).toBeDefined();
    const resultado = executarOperacao(banco, apagarComentario, { id: deOutro!.id }, ctx());
    expect(resultado.ok).toBe(false);
  });

  it("so o dono altera configuracoes", () => {
    expect(executarOperacao(banco, alterarConfiguracoes, { pontosVitoria: 3 }, ctx()).ok).toBe(false);
    const doDono = executarOperacao(banco, alterarConfiguracoes, { pontosVitoria: 3 }, ctx(dono));
    expect(doDono.ok && doDono.banco.configuracoes.pontosVitoria).toBe(3);
    expect(doDono.ok && doDono.banco.auditoria[0].tabela).toBe("configuracoes");
  });

  it("erro que nao e de regra continua sendo lancado (e defeito, nao recusa)", () => {
    const quebrada = {
      nome: "Quebrada",
      aplicar: () => {
        throw new Error("defeito");
      },
    };
    expect(() => executarOperacao(banco, quebrada, {}, ctx())).toThrowError("defeito");
    expect(new ErroDeRegra("x")).toBeInstanceOf(Error);
  });
});

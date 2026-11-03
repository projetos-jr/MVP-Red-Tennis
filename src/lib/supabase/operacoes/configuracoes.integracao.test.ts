import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  alterarPermissoes,
  apagarPlano,
  desativarPlano,
  desativarSigla,
  editarPlano,
  editarSigla,
  incluirPlano,
  incluirSigla,
  reativarPlano,
  reativarSigla,
  salvarParametros,
} from "@/lib/banco/operacoes/configuracoes";
import type { Configuracoes } from "@/lib/banco/tipos";
import { carregarTabelas } from "../carregar";
import { EXECUCAO, SEM_BANCO_DE_TESTE, entrar, executar, type Sessao } from "../integracao/ambiente";

/**
 * Configuracoes gravando no banco real. A linha de `configuracoes` e uma so,
 * dividida com os testes dos outros modulos: cada teste muda pouco, confere e
 * devolve o valor anterior logo em seguida. Siglas incluidas aqui saem no fim.
 */

async function comPaciencia<T>(fazer: () => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa += 1) {
    try {
      return await fazer();
    } catch (erro) {
      if (tentativa >= 6 || !String(erro).includes("Timed out acquiring connection")) throw erro;
      await new Promise((pronto) => setTimeout(pronto, 2000 * tentativa));
    }
  }
}

describe.skipIf(SEM_BANCO_DE_TESTE)("configurações no banco real", { timeout: 60_000 }, () => {
  let dono: Sessao;
  let recepcao: Sessao;
  // Codigo de sigla: ate 6 letras ou numeros, unico por execucao.
  const sufixo = EXECUCAO.slice(-5).toUpperCase();
  const codigos = [`T${sufixo}`, `U${sufixo}`];

  /** Le a configuracao atual do banco (para nao sobrescrever com valor velho). */
  async function configuracoesAtuais(sessao: Sessao): Promise<Configuracoes> {
    const { configuracoes } = await comPaciencia(() => carregarTabelas(sessao.cliente, ["configuracoes"]));
    sessao.banco = { ...sessao.banco, configuracoes: configuracoes! };
    return configuracoes!;
  }

  beforeAll(async () => {
    dono = await comPaciencia(() => entrar("dono"));
    recepcao = await comPaciencia(() => entrar("recepcao"));
  }, 180_000);

  afterAll(async () => {
    if (!dono) return;
    // Nao ha operacao para apagar sigla: tira as do teste direto na linha.
    const { siglas } = await configuracoesAtuais(dono);
    if (!siglas.some((s) => codigos.includes(s.codigo))) return;
    await dono.cliente
      .from("configuracoes")
      .update({ siglas: siglas.filter((s) => !codigos.includes(s.codigo)) })
      .eq("id", 1);
  });

  it("salva um parâmetro (e devolve o valor anterior)", async () => {
    const { formasPagamento: anteriores } = await configuracoesAtuais(dono);
    const nova = `Pix ${EXECUCAO}`;
    try {
      const salvo = await executar(dono, salvarParametros, { formasPagamento: [...anteriores, `  ${nova} `] });
      expect(salvo.ok).toBe(true);
      expect(dono.banco.configuracoes.formasPagamento).toEqual([...anteriores, nova]);
    } finally {
      await configuracoesAtuais(dono);
      await executar(dono, salvarParametros, { formasPagamento: anteriores });
    }
    expect((await configuracoesAtuais(dono)).formasPagamento).toEqual(anteriores);
  });

  it("o banco confere os parâmetros e só o dono altera", async () => {
    const antes = await configuracoesAtuais(dono);
    const { error } = await dono.cliente.rpc("salvar_parametros", { p_pontos_vitoria: 0, p_pontos_derrota: 5 });
    expect(error?.message).toBe("A vitória precisa valer pelo menos tanto quanto a derrota.");

    const pelaTela = await executar(recepcao, salvarParametros, { precoLocacaoHora: 1 });
    expect(pelaTela).toMatchObject({ ok: false, erro: "Só o dono pode alterar as configurações." });
    const direto = await recepcao.cliente.rpc("salvar_parametros", { p_preco_locacao_hora: 1 });
    expect(direto.error?.code).toBe("42501");

    const depois = await configuracoesAtuais(dono);
    expect(depois.pontosVitoria).toBe(antes.pontosVitoria);
    expect(depois.precoLocacaoHora).toBe(antes.precoLocacaoHora);
  });

  it("siglas: inclui, edita (código ainda sem uso), desativa e reativa", async () => {
    await configuracoesAtuais(dono);
    const [codigo, novoCodigo] = codigos;
    const incluida = await executar(dono, incluirSigla, {
      codigo,
      nome: `Teste ${EXECUCAO}`,
      descricao: "Sigla criada pelo teste.",
      geraCredito: true,
      aplicaA: "aluno",
    });
    expect(incluida.ok).toBe(true);
    expect(dono.banco.configuracoes.siglas.find((s) => s.codigo === codigo)).toMatchObject({
      nome: `Teste ${EXECUCAO}`,
      geraCredito: true,
      aplicaA: "aluno",
    });

    await configuracoesAtuais(dono);
    const editada = await executar(dono, editarSigla, {
      codigoAtual: codigo,
      sigla: { codigo: novoCodigo, nome: `Teste editada ${EXECUCAO}`, descricao: "", geraCredito: false, aplicaA: "ambos" },
    });
    expect(editada.ok).toBe(true);
    expect(dono.banco.configuracoes.siglas.some((s) => s.codigo === codigo)).toBe(false);
    expect(dono.banco.configuracoes.siglas.find((s) => s.codigo === novoCodigo)).toMatchObject({
      nome: `Teste editada ${EXECUCAO}`,
      geraCredito: false,
      aplicaA: "ambos",
    });

    await configuracoesAtuais(dono);
    expect((await executar(dono, desativarSigla, { codigo: novoCodigo })).ok).toBe(true);
    expect(dono.banco.configuracoes.siglas.find((s) => s.codigo === novoCodigo)?.desativada).toBe(true);
    await configuracoesAtuais(dono);
    expect((await executar(dono, reativarSigla, { codigo: novoCodigo })).ok).toBe(true);
    expect(dono.banco.configuracoes.siglas.find((s) => s.codigo === novoCodigo)?.desativada).toBe(false);

    // O banco nao deixa mudar o codigo de uma sigla ja usada (CH esta em aulas antigas).
    const { error } = await dono.cliente.rpc("editar_sigla", {
      p_codigo_atual: "CH",
      p_sigla: { codigo: "CHX", nome: "Chuva", descricao: "", geraCredito: true, aplicaA: "ocupacao" },
    });
    expect(error?.message).toMatch(/^A sigla CH já foi usada/);
  });

  it("planos: inclui (id do banco), edita, desativa, reativa e apaga", async () => {
    const nome = `Plano teste ${EXECUCAO}`;
    const dados = {
      nome,
      tipo: "Individual" as const,
      valorMensal: 199.9,
      aulasPorSemana: 2,
      duracaoMinutos: 60,
      tabela: "nova" as const,
      ativo: true,
    };
    const incluido = await executar(dono, incluirPlano, dados);
    expect(incluido.ok).toBe(true);
    const id = (incluido as { id: string }).id;
    expect(dono.banco.planos.find((p) => p.id === id)).toMatchObject({ ...dados, id });

    const editado = await executar(dono, editarPlano, { ...dados, id, tipo: "Dupla", valorMensal: 210 });
    expect(editado.ok).toBe(true);
    expect(dono.banco.planos.find((p) => p.id === id)).toMatchObject({ tipo: "Dupla", valorMensal: 210 });

    expect((await executar(dono, desativarPlano, { id })).ok).toBe(true);
    expect(dono.banco.planos.find((p) => p.id === id)?.ativo).toBe(false);
    expect((await executar(dono, reativarPlano, { id })).ok).toBe(true);
    expect(dono.banco.planos.find((p) => p.id === id)?.ativo).toBe(true);

    expect((await executar(dono, apagarPlano, { id })).ok).toBe(true);
    expect(dono.banco.planos.some((p) => p.id === id)).toBe(false);
  });

  it("o banco protege os planos com matrícula e só o dono mexe no catálogo", async () => {
    const plano = dono.banco.planos.find((p) => p.id === "pl-ind")!;
    const apagar = await dono.cliente.rpc("apagar_plano", { p_id: plano.id });
    expect(apagar.error?.message).toMatch(/não pode ser apagado/);

    const mudarTipo = await dono.cliente.rpc("editar_plano", {
      p_id: plano.id,
      p_nome: plano.nome,
      p_tipo: "Dupla",
      p_valor_mensal: plano.valorMensal,
      p_aulas_por_semana: plano.aulasPorSemana,
      p_duracao_minutos: plano.duracaoMinutos,
      p_tabela: plano.tabela,
      p_ativo: plano.ativo,
    });
    expect(mudarTipo.error?.message).toMatch(/o tipo não pode mudar/);

    // Desativar e gravacao direta: a RLS barra a recepcao.
    const pelaTela = await executar(recepcao, desativarPlano, { id: plano.id });
    expect(pelaTela).toMatchObject({ ok: false, erro: "Só o dono pode alterar as configurações." });
    const direto = await recepcao.cliente.from("planos").update({ ativo: false }).eq("id", plano.id).select("id");
    expect(direto.error !== null || direto.data?.length === 0).toBe(true);
    const incluir = await recepcao.cliente.rpc("incluir_plano", {
      p_nome: `Invasor ${EXECUCAO}`,
      p_tipo: "Individual",
      p_valor_mensal: 1,
      p_aulas_por_semana: 1,
      p_duracao_minutos: 60,
      p_tabela: "nova",
    });
    expect(incluir.error?.code).toBe("42501");
  });

  it("permissões: grava as mesmas permissões e o banco recusa tirar o acesso do dono", async () => {
    const { permissoes } = await configuracoesAtuais(dono);
    const salvo = await executar(dono, alterarPermissoes, { permissoes });
    expect(salvo.ok).toBe(true);
    expect(dono.banco.configuracoes.permissoes).toEqual(permissoes);

    const semConfiguracoes = {
      ...permissoes,
      dono: permissoes.dono.filter((modulo) => modulo !== "configuracoes"),
    };
    const { error } = await dono.cliente.rpc("alterar_permissoes", { p_permissoes: semConfiguracoes });
    expect(error?.message).toBe("O dono não pode tirar o próprio acesso às Configurações.");

    const pelaRecepcao = await recepcao.cliente.rpc("alterar_permissoes", { p_permissoes: permissoes });
    expect(pelaRecepcao.error?.code).toBe("42501");
    expect((await configuracoesAtuais(dono)).permissoes).toEqual(permissoes);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { HOJE } from "@/lib/banco/constantes";
import {
  ajustarInventario,
  cadastrarProduto,
  editarProduto,
  fecharContaDeConsumo,
  inativarProduto,
  lancarConsumo,
  reativarProduto,
  registrarEntrada,
  registrarPerda,
  type DadosDoProduto,
} from "@/lib/banco/operacoes/estoque";
import { saldoDoProduto } from "@/lib/banco/regras/estoque";
import { somarDias } from "@/lib/date";
import { EXECUCAO, SEM_BANCO_DE_TESTE, entrar, executar, reler, type Sessao } from "../integracao/ambiente";

describe.skipIf(SEM_BANCO_DE_TESTE)("estoque no banco real", () => {
  let dono: Sessao;
  let recepcao: Sessao;
  let professor: Sessao;
  let alunoId: string;

  beforeAll(async () => {
    dono = await entrar("dono");
    recepcao = await entrar("recepcao");
    professor = await entrar("professor");

    // Aluno proprio deste teste: "fechar a conta" paga todos os consumos dele.
    const { data, error } = await dono.cliente
      .from("alunos")
      .insert({ nome: `Aluno Estoque ${EXECUCAO}` })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    alunoId = (data as { id: string }).id;
    await reler(recepcao);
  });

  function produtoDeTeste(sufixo: string): DadosDoProduto {
    return {
      nome: `Produto EXECUCAO ${EXECUCAO} ${sufixo}`,
      categoria: "Bebidas",
      unidade: "garrafa 500ml",
      precoCusto: 2.5,
      precoVenda: 6,
      estoqueMinimo: 3,
    };
  }

  /** Cadastra pela tela e devolve o id que o banco deu ao produto. */
  async function cadastrar(sessao: Sessao, sufixo: string): Promise<string> {
    const criado = await executar(sessao, cadastrarProduto, produtoDeTeste(sufixo));
    expect(criado).toMatchObject({ ok: true });
    const id = criado.ok ? criado.id : undefined;
    expect(sessao.banco.produtos.some((p) => p.id === id)).toBe(true);
    return id!;
  }

  const saldo = (sessao: Sessao, produtoId: string) =>
    saldoDoProduto(sessao.banco.movimentosEstoque, produtoId);

  it("cadastra, edita, inativa e reativa um produto", async () => {
    const criado = await executar(recepcao, cadastrarProduto, {
      ...produtoDeTeste("A"),
      nome: `  Água   EXECUCAO ${EXECUCAO} `,
    });
    expect(criado).toMatchObject({ ok: true });
    const id = criado.ok ? criado.id! : "";
    expect(recepcao.banco.produtos.find((p) => p.id === id)).toMatchObject({
      nome: `Água EXECUCAO ${EXECUCAO}`,
      categoria: "Bebidas",
      precoVenda: 6,
      ativo: true,
    });

    // Nome repetido (sem acento e com outra caixa): o banco recusa mesmo burlando a tela.
    const repetido = await recepcao.cliente.rpc("cadastrar_produto", {
      p_nome: `agua execucao ${EXECUCAO}`,
      p_categoria: "Bebidas",
      p_unidade: "lata",
      p_preco_custo: 1,
      p_preco_venda: 2,
      p_estoque_minimo: 0,
    });
    expect(repetido.error?.message).toBe(`Já existe um produto chamado "Água EXECUCAO ${EXECUCAO}".`);

    const editado = await executar(recepcao, editarProduto, {
      ...produtoDeTeste("A"),
      nome: `Água EXECUCAO ${EXECUCAO}`,
      precoVenda: 7.5,
      id,
    });
    expect(editado.ok).toBe(true);
    expect(recepcao.banco.produtos.find((p) => p.id === id)?.precoVenda).toBe(7.5);

    expect((await executar(recepcao, inativarProduto, { id })).ok).toBe(true);
    expect(recepcao.banco.produtos.find((p) => p.id === id)?.ativo).toBe(false);
    expect((await executar(recepcao, reativarProduto, { id })).ok).toBe(true);
    expect(recepcao.banco.produtos.find((p) => p.id === id)?.ativo).toBe(true);

    const deNovo = await recepcao.cliente.rpc("reativar_produto", { p_id: id });
    expect(deNovo.error?.message).toBe(`Água EXECUCAO ${EXECUCAO} já está ativo.`);
  });

  it("entrada, perda, inventário, consumo e fechamento da conta", async () => {
    const produtoId = await cadastrar(recepcao, "B");
    const nome = produtoDeTeste("B").nome;

    // Entrada (sem conta a pagar).
    const entrada = await executar(recepcao, registrarEntrada, {
      produtoId,
      quantidade: 10,
      observacao: "NF 123",
    });
    expect(entrada).toMatchObject({ ok: true });
    expect(recepcao.banco.movimentosEstoque.find((m) => m.id === (entrada.ok && entrada.id))).toMatchObject({
      produtoId,
      tipo: "entrada",
      quantidade: 10,
      responsavel: "Recepção Local",
      observacao: "NF 123",
    });
    expect(saldo(recepcao, produtoId)).toBe(10);

    // Perda.
    expect((await executar(recepcao, registrarPerda, { produtoId, quantidade: 2, motivo: "Quebra" })).ok).toBe(true);
    expect(saldo(recepcao, produtoId)).toBe(8);
    const demais = await recepcao.cliente.rpc("registrar_perda", {
      p_produto_id: produtoId,
      p_quantidade: 999,
      p_motivo: "Teste",
    });
    expect(demais.error?.message).toBe(`Só há 8 unidade(s) de ${nome} em estoque.`);

    // Inventario: o saldo passa a ser o contado.
    const ajuste = await executar(recepcao, ajustarInventario, {
      produtoId,
      saldoContado: 5,
      observacao: "Contagem de sexta",
    });
    expect(ajuste).toMatchObject({ ok: true });
    expect(recepcao.banco.movimentosEstoque.find((m) => m.id === (ajuste.ok && ajuste.id))).toMatchObject({
      tipo: "ajuste",
      quantidade: -3,
      observacao: "Contagem: 5 (sistema: 8) · Contagem de sexta",
    });
    expect(saldo(recepcao, produtoId)).toBe(5);

    // Consumo: consumo + baixa no estoque + conta a receber.
    const consumo = await executar(recepcao, lancarConsumo, {
      pessoaId: alunoId,
      pessoaTipo: "aluno",
      produtoId,
      quantidade: 2,
    });
    expect(consumo).toMatchObject({ ok: true });
    const consumoId = consumo.ok ? consumo.id : undefined;
    expect(recepcao.banco.consumos.find((c) => c.id === consumoId)).toMatchObject({
      pessoaId: alunoId,
      produtoNome: nome,
      quantidade: 2,
      valorUnitario: 6,
    });
    expect(recepcao.banco.movimentosEstoque.find((m) => m.consumoId === consumoId)).toMatchObject({
      tipo: "venda",
      quantidade: 2,
    });
    expect(recepcao.banco.lancamentos.find((l) => l.consumoId === consumoId)).toMatchObject({
      tipo: "receber",
      categoria: "Consumo",
      pessoaId: alunoId,
      valor: 12,
      vencimento: somarDias(HOJE, recepcao.banco.configuracoes.prazoPagamentoConsumoDias),
    });
    expect(saldo(recepcao, produtoId)).toBe(3);

    // Venda acima do saldo: o banco recusa e nada e gravado.
    const semSaldo = await recepcao.cliente.rpc("lancar_consumo", {
      p_pessoa_id: alunoId,
      p_pessoa_tipo: "aluno",
      p_produto_id: produtoId,
      p_quantidade: 99,
    });
    expect(semSaldo.error?.message).toBe(`Só há 3 unidade(s) de ${nome} em estoque.`);

    // Fechar a conta: paga todos os consumos em aberto do aluno.
    expect(
      (await executar(recepcao, lancarConsumo, { pessoaId: alunoId, pessoaTipo: "aluno", produtoId, quantidade: 1 })).ok,
    ).toBe(true);
    const fechado = await executar(recepcao, fecharContaDeConsumo, {
      pessoaId: alunoId,
      pagoEm: HOJE,
      formaPagamento: "Stone",
    });
    expect(fechado.ok).toBe(true);
    const doAluno = recepcao.banco.lancamentos.filter(
      (l) => l.categoria === "Consumo" && l.pessoaId === alunoId,
    );
    expect(doAluno).toHaveLength(2);
    for (const l of doAluno) expect(l).toMatchObject({ pagoEm: HOJE, formaPagamento: "Stone" });
    const vazio = await recepcao.cliente.rpc("fechar_conta_de_consumo", {
      p_pessoa_id: alunoId,
      p_pago_em: HOJE,
      p_forma_pagamento: "Stone",
    });
    expect(vazio.error?.message).toBe("Não há consumo em aberto nesta conta.");

    // Produto inativo nao vende nem recebe entrada (o banco recusa).
    expect((await executar(recepcao, inativarProduto, { id: produtoId })).ok).toBe(true);
    const inativo = await recepcao.cliente.rpc("lancar_consumo", {
      p_pessoa_id: alunoId,
      p_pessoa_tipo: "aluno",
      p_produto_id: produtoId,
      p_quantidade: 1,
    });
    expect(inativo.error?.message).toBe(`${nome} está inativo e não pode ser vendido.`);
    const entradaInativo = await recepcao.cliente.rpc("registrar_entrada", {
      p_produto_id: produtoId,
      p_quantidade: 1,
    });
    expect(entradaInativo.error?.message).toContain("está inativo");
  });

  it("entrada com conta a pagar: o dono lança; a recepção é recusada pelo banco", async () => {
    const produtoId = await cadastrar(dono, "C");
    const nome = produtoDeTeste("C").nome;
    const conta = { favorecido: `Distribuidora ${EXECUCAO}`, valor: 30, vencimento: somarDias(HOJE, 10) };

    const entrada = await executar(dono, registrarEntrada, { produtoId, quantidade: 6, contaAPagar: conta });
    expect(entrada).toMatchObject({ ok: true });
    const movimentoId = entrada.ok ? entrada.id : undefined;
    expect(dono.banco.movimentosEstoque.find((m) => m.id === movimentoId)).toMatchObject({
      produtoId,
      tipo: "entrada",
      quantidade: 6,
      responsavel: "Dono Local",
    });
    expect(dono.banco.lancamentos.find((l) => l.movimentoEstoqueId === movimentoId)).toMatchObject({
      tipo: "pagar",
      categoria: "Fornecedor",
      nomePagante: conta.favorecido,
      item: `Compra: 6× ${nome}`,
      valor: 30,
      vencimento: conta.vencimento,
    });
    const { data: historico } = await dono.cliente
      .from("auditoria")
      .select("operacao")
      .eq("registro_id", movimentoId!);
    expect(historico).toEqual([{ operacao: "Registrar entrada de mercadoria" }]);

    // A recepcao registra entradas, mas nao lanca conta a pagar: a tela
    // aceita (regra do modo demonstracao), o banco recusa e nada e gravado.
    await reler(recepcao);
    const daRecepcao = await executar(recepcao, registrarEntrada, { produtoId, quantidade: 4, contaAPagar: conta });
    expect(daRecepcao).toMatchObject({
      ok: false,
      erro: "Seu perfil não tem permissão para esta operação.",
    });
    await reler(recepcao);
    expect(recepcao.banco.movimentosEstoque.filter((m) => m.produtoId === produtoId)).toHaveLength(1);
    expect(saldo(recepcao, produtoId)).toBe(6);
  });

  it("o professor não mexe no estoque", async () => {
    expect((await executar(professor, cadastrarProduto, produtoDeTeste("D"))).ok).toBe(false);
    const direto = await professor.cliente.rpc("cadastrar_produto", {
      p_nome: produtoDeTeste("D").nome,
      p_categoria: "Bebidas",
      p_unidade: "lata",
      p_preco_custo: 1,
      p_preco_venda: 2,
      p_estoque_minimo: 0,
    });
    expect(direto.error).not.toBeNull();
    const { count } = await dono.cliente
      .from("produtos")
      .select("id", { count: "exact", head: true })
      .eq("nome", produtoDeTeste("D").nome);
    expect(count).toBe(0);
  });
});

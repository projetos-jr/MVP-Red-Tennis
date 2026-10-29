/**
 * Testes das operacoes do estoque e do consumo no balcao.
 * Os mesmos casos viram testes do banco real (pgTAP) quando o Supabase entrar.
 *
 * Usa os dados de exemplo: Agua mineral sem gas (p01) tem 96 unidades,
 * Cerveja sem alcool (p12) esta zerada e Munhequeira (p22) tem 4.
 */

import { describe, expect, it } from "vitest";
import {
  consumosDaPessoa,
  filtrarProdutos,
  listaDeCompras,
  nivelDoEstoque,
  produtosComSaldo,
  resumoDaConta,
} from "../../consultas/estoque";
import { somarDias } from "../../date";
import { HOJE } from "../constantes";
import { executarOperacao, type ContextoOperacao, type Operacao } from "../executar";
import { saldoDoProduto, vendaAbaixoDoCusto } from "../regras/estoque";
import { gerarBancoInicial } from "../semente";
import type { Banco, Colaborador } from "../tipos";
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
} from "./estoque";

const BANCO = gerarBancoInicial();
const [, RECEPCAO, PROFESSORA] = BANCO.colaboradores;
const AGORA = `${HOJE}T15:30:00`;

function contexto(usuario: Colaborador = RECEPCAO): ContextoOperacao {
  return { usuario, agora: AGORA, hoje: HOJE };
}

/** Executa a operacao e devolve o banco novo; o teste falha se a regra recusar. */
function gravar<Dados>(banco: Banco, operacao: Operacao<Dados>, dados: Dados): Banco {
  const resultado = executarOperacao(banco, operacao, dados, contexto());
  if (!resultado.ok) throw new Error(`Recusado sem querer: ${resultado.erro}`);
  return resultado.banco;
}

/** Executa esperando a recusa e devolve a mensagem da regra. */
function recusa<Dados>(
  banco: Banco,
  operacao: Operacao<Dados>,
  dados: Dados,
  usuario: Colaborador = RECEPCAO,
): string {
  const resultado = executarOperacao(banco, operacao, dados, contexto(usuario));
  expect(resultado.ok, "a operacao deveria ter sido recusada").toBe(false);
  return resultado.ok ? "" : resultado.erro;
}

const saldo = (banco: Banco, produtoId: string) =>
  saldoDoProduto(banco.movimentosEstoque, produtoId);

const consumoDeAgua = {
  pessoaId: "a01",
  pessoaTipo: "aluno" as const,
  produtoId: "p01",
  quantidade: 2,
};

const PICOLE: DadosDoProduto = {
  nome: "Picolé de fruta",
  categoria: "Lanches",
  unidade: "unidade",
  precoCusto: 2.5,
  precoVenda: 6,
  estoqueMinimo: 10,
};

describe("lançar consumo", () => {
  it("grava o consumo, a venda no estoque e o lançamento a receber juntos", () => {
    const banco = gravar(BANCO, lancarConsumo, consumoDeAgua);

    expect(banco.consumos).toHaveLength(BANCO.consumos.length + 1);
    expect(banco.movimentosEstoque).toHaveLength(BANCO.movimentosEstoque.length + 1);
    expect(banco.lancamentos).toHaveLength(BANCO.lancamentos.length + 1);

    const consumo = banco.consumos.at(-1)!;
    expect(consumo).toMatchObject({
      pessoaId: "a01",
      pessoaTipo: "aluno",
      produtoId: "p01",
      produtoNome: "Água mineral sem gás",
      quantidade: 2,
      valorUnitario: 5,
      data: AGORA,
    });
    expect(banco.movimentosEstoque.find((m) => m.consumoId === consumo.id)).toMatchObject({
      tipo: "venda",
      produtoId: "p01",
      quantidade: 2,
      responsavel: RECEPCAO.nome,
    });
    const cobranca = banco.lancamentos.find((l) => l.consumoId === consumo.id);
    expect(cobranca).toMatchObject({
      tipo: "receber",
      categoria: "Consumo",
      pessoaId: "a01",
      pessoaTipo: "aluno",
      nomePagante: "Guilherme Lima",
      item: "2× Água mineral sem gás",
      valor: 10,
      vencimento: somarDias(HOJE, BANCO.configuracoes.prazoPagamentoConsumoDias),
    });
    expect(cobranca?.pagoEm).toBeUndefined();
    expect(saldo(banco, "p01")).toBe(94);
  });

  it("registra a auditoria das tres tabelas com o nome da operação", () => {
    const banco = gravar(BANCO, lancarConsumo, consumoDeAgua);
    const tabelas = banco.auditoria.map((r) => r.tabela).sort();
    expect(tabelas).toEqual(["consumos", "lancamentos", "movimentosEstoque"]);
    banco.auditoria.forEach((r) =>
      expect(r).toMatchObject({ acao: "criar", operacao: "Lançar consumo", usuarioId: RECEPCAO.id }),
    );
  });

  it("se o saldo não basta, nada é gravado", () => {
    const resultado = executarOperacao(
      BANCO,
      lancarConsumo,
      { ...consumoDeAgua, produtoId: "p22", quantidade: 5 },
      contexto(),
    );
    expect(resultado).toEqual({
      ok: false,
      erro: "Só há 4 unidade(s) de Munhequeira em estoque.",
    });
    expect(saldo(BANCO, "p22")).toBe(4);
  });

  it("estoque zerado recusa a venda", () => {
    expect(recusa(BANCO, lancarConsumo, { ...consumoDeAgua, produtoId: "p12", quantidade: 1 })).toBe(
      "Cerveja sem álcool está esgotado.",
    );
  });

  it("produto inativo recusa a venda", () => {
    const banco = gravar(BANCO, inativarProduto, { id: "p01" });
    expect(recusa(banco, lancarConsumo, consumoDeAgua)).toBe(
      "Água mineral sem gás está inativo e não pode ser vendido.",
    );
  });

  it("quantidade zero, negativa ou quebrada é recusada", () => {
    [0, -1, 1.5].forEach((quantidade) =>
      expect(recusa(BANCO, lancarConsumo, { ...consumoDeAgua, quantidade })).toBe(
        "A quantidade precisa ser um número inteiro maior que zero.",
      ),
    );
  });

  it("pessoa que não está no cadastro é recusada", () => {
    expect(recusa(BANCO, lancarConsumo, { ...consumoDeAgua, pessoaId: "ninguem" })).toBe(
      "Pessoa não encontrada no cadastro.",
    );
  });

  it("professor também tem conta de consumo", () => {
    const banco = gravar(BANCO, lancarConsumo, {
      ...consumoDeAgua,
      pessoaId: "prof-1",
      pessoaTipo: "professor",
    });
    expect(banco.lancamentos.at(-1)).toMatchObject({
      pessoaId: "prof-1",
      pessoaTipo: "professor",
      nomePagante: "Alexandre Pires",
    });
  });

  it("o vencimento segue o prazo das Configurações (H13)", () => {
    const comPrazoDe10Dias: Banco = {
      ...BANCO,
      configuracoes: { ...BANCO.configuracoes, prazoPagamentoConsumoDias: 10 },
    };
    const banco = gravar(comPrazoDe10Dias, lancarConsumo, consumoDeAgua);
    expect(banco.lancamentos.at(-1)?.vencimento).toBe(somarDias(HOJE, 10));
  });

  it("o perfil de professor não grava no estoque (H9)", () => {
    expect(recusa(BANCO, lancarConsumo, consumoDeAgua, PROFESSORA)).toBe(
      "Seu perfil não tem permissão para mexer no estoque.",
    );
    expect(recusa(BANCO, registrarEntrada, { produtoId: "p01", quantidade: 1 }, PROFESSORA)).toBe(
      "Seu perfil não tem permissão para mexer no estoque.",
    );
  });
});

describe("entrada de mercadoria", () => {
  const vencimento = somarDias(HOJE, 15);

  it("com conta a pagar, cria o movimento e o lançamento, ligados", () => {
    const banco = gravar(BANCO, registrarEntrada, {
      produtoId: "p22",
      quantidade: 10,
      observacao: " NF 991 ",
      contaAPagar: { favorecido: "Loja de artigos esportivos", valor: 120, vencimento },
    });

    const entrada = banco.movimentosEstoque.at(-1)!;
    expect(entrada).toMatchObject({
      tipo: "entrada",
      produtoId: "p22",
      quantidade: 10,
      observacao: "NF 991",
      responsavel: RECEPCAO.nome,
    });
    expect(banco.lancamentos).toHaveLength(BANCO.lancamentos.length + 1);
    const conta = banco.lancamentos.at(-1);
    expect(conta).toMatchObject({
      tipo: "pagar",
      categoria: "Fornecedor",
      nomePagante: "Loja de artigos esportivos",
      item: "Compra: 10× Munhequeira",
      valor: 120,
      vencimento,
      movimentoEstoqueId: entrada.id,
    });
    expect(conta?.pagoEm).toBeUndefined();
    expect(saldo(banco, "p22")).toBe(14);
  });

  it("sem conta a pagar, grava só o movimento", () => {
    const banco = gravar(BANCO, registrarEntrada, { produtoId: "p12", quantidade: 24 });
    expect(banco.lancamentos).toBe(BANCO.lancamentos);
    expect(saldo(banco, "p12")).toBe(24);
  });

  it("conta a pagar incompleta recusa a entrada inteira", () => {
    const base = { produtoId: "p22", quantidade: 10 };
    const conta = { favorecido: "Loja", valor: 120, vencimento };
    expect(recusa(BANCO, registrarEntrada, { ...base, contaAPagar: { ...conta, favorecido: " " } })).toBe(
      "Informe o fornecedor que vai receber a conta a pagar.",
    );
    expect(recusa(BANCO, registrarEntrada, { ...base, contaAPagar: { ...conta, valor: 0 } })).toBe(
      "O valor da conta a pagar precisa ser maior que zero.",
    );
    expect(
      recusa(BANCO, registrarEntrada, { ...base, contaAPagar: { ...conta, vencimento: "2026-02-31" } }),
    ).toBe("Informe o vencimento da conta a pagar.");
  });

  it("produto inativo não recebe entrada", () => {
    const banco = gravar(BANCO, inativarProduto, { id: "p22" });
    expect(recusa(banco, registrarEntrada, { produtoId: "p22", quantidade: 1 })).toBe(
      "Munhequeira está inativo. Reative o produto antes de registrar a entrada.",
    );
  });
});

describe("perda e ajuste de inventário", () => {
  it("perda grava o motivo e baixa o saldo", () => {
    const banco = gravar(BANCO, registrarPerda, { produtoId: "p22", quantidade: 1, motivo: "Rasgou" });
    expect(banco.movimentosEstoque.at(-1)).toMatchObject({
      tipo: "perda",
      quantidade: 1,
      observacao: "Rasgou",
    });
    expect(saldo(banco, "p22")).toBe(3);
  });

  it("perda maior que o saldo ou sem motivo é recusada", () => {
    expect(recusa(BANCO, registrarPerda, { produtoId: "p22", quantidade: 5, motivo: "Rasgou" })).toBe(
      "Só há 4 unidade(s) de Munhequeira em estoque.",
    );
    expect(recusa(BANCO, registrarPerda, { produtoId: "p12", quantidade: 1, motivo: "Vencido" })).toBe(
      "Cerveja sem álcool está esgotado.",
    );
    expect(recusa(BANCO, registrarPerda, { produtoId: "p22", quantidade: 1, motivo: "  " })).toBe(
      "Informe o motivo da perda.",
    );
  });

  it("o ajuste deixa o saldo igual ao contado, para menos e para mais", () => {
    const menos = gravar(BANCO, ajustarInventario, { produtoId: "p01", saldoContado: 90 });
    expect(menos.movimentosEstoque.at(-1)).toMatchObject({
      tipo: "ajuste",
      quantidade: -6,
      observacao: "Contagem: 90 (sistema: 96)",
    });
    expect(saldo(menos, "p01")).toBe(90);

    const mais = gravar(menos, ajustarInventario, {
      produtoId: "p01",
      saldoContado: 100,
      observacao: "Caixa achada no depósito",
    });
    expect(mais.movimentosEstoque.at(-1)?.quantidade).toBe(10);
    expect(saldo(mais, "p01")).toBe(100);

    const doZero = gravar(BANCO, ajustarInventario, { produtoId: "p12", saldoContado: 5 });
    expect(saldo(doZero, "p12")).toBe(5);
  });

  it("contagem igual ao sistema ou negativa é recusada", () => {
    expect(recusa(BANCO, ajustarInventario, { produtoId: "p01", saldoContado: 96 })).toBe(
      "O saldo contado é igual ao do sistema (96): não há o que ajustar.",
    );
    expect(recusa(BANCO, ajustarInventario, { produtoId: "p01", saldoContado: -1 })).toBe(
      "O saldo contado precisa ser um número inteiro, zero ou maior.",
    );
  });
});

describe("cadastro de produto", () => {
  it("cadastra o produto ativo e sem saldo", () => {
    const banco = gravar(BANCO, cadastrarProduto, { ...PICOLE, precoVenda: 5.999 });
    const novo = banco.produtos.at(-1)!;
    expect(novo).toMatchObject({ ...PICOLE, precoVenda: 6, ativo: true });
    expect(saldo(banco, novo.id)).toBe(0);
    expect(banco.auditoria[0]).toMatchObject({ tabela: "produtos", acao: "criar" });
  });

  it("preço negativo é recusado", () => {
    expect(recusa(BANCO, cadastrarProduto, { ...PICOLE, precoCusto: -1 })).toBe(
      "O preço de custo não pode ser negativo.",
    );
    expect(recusa(BANCO, cadastrarProduto, { ...PICOLE, precoVenda: -0.5 })).toBe(
      "O preço de venda não pode ser negativo.",
    );
    expect(recusa(BANCO, editarProduto, { ...PICOLE, id: "p01", nome: "Água mineral sem gás", precoVenda: -5 })).toBe(
      "O preço de venda não pode ser negativo.",
    );
  });

  it("venda abaixo do custo só gera aviso: o cadastro é aceito", () => {
    expect(vendaAbaixoDoCusto(10, 8)).toBe(true);
    expect(vendaAbaixoDoCusto(4, 8)).toBe(false);
    const banco = gravar(BANCO, cadastrarProduto, { ...PICOLE, precoCusto: 10, precoVenda: 8 });
    expect(banco.produtos.at(-1)?.precoVenda).toBe(8);
  });

  it("nome duplicado é recusado, sem diferença de acentos e maiúsculas", () => {
    expect(recusa(BANCO, cadastrarProduto, { ...PICOLE, nome: "  agua mineral  SEM GAS " })).toBe(
      'Já existe um produto chamado "Água mineral sem gás".',
    );
  });

  it("o nome de um produto inativo também conta", () => {
    const banco = gravar(BANCO, inativarProduto, { id: "p12" });
    expect(recusa(banco, cadastrarProduto, { ...PICOLE, nome: "Cerveja sem álcool" })).toBe(
      'Já existe um produto inativo chamado "Cerveja sem álcool". Reative-o em vez de cadastrar outro.',
    );
  });

  it("na edição, o próprio nome pode ficar e o de outro produto não", () => {
    const p01 = BANCO.produtos.find((p) => p.id === "p01")!;
    const banco = gravar(BANCO, editarProduto, { ...p01, precoVenda: 5.5 });
    expect(banco.produtos.find((p) => p.id === "p01")?.precoVenda).toBe(5.5);
    expect(recusa(BANCO, editarProduto, { ...p01, id: "p02" })).toBe(
      'Já existe um produto chamado "Água mineral sem gás".',
    );
  });

  it("editar sem mudar nada não grava nem audita", () => {
    const p01 = BANCO.produtos.find((p) => p.id === "p01")!;
    const resultado = executarOperacao(BANCO, editarProduto, { ...p01 }, contexto());
    expect(resultado.ok && resultado.banco).toBe(BANCO);
  });

  it("estoque mínimo precisa ser inteiro, zero ou maior", () => {
    [-1, 2.5].forEach((estoqueMinimo) =>
      expect(recusa(BANCO, cadastrarProduto, { ...PICOLE, estoqueMinimo })).toBe(
        "O estoque mínimo precisa ser um número inteiro, zero ou maior.",
      ),
    );
  });

  it("mudar nome e preço não reescreve o consumo já lançado", () => {
    const comConsumo = gravar(BANCO, lancarConsumo, consumoDeAgua);
    const p01 = comConsumo.produtos.find((p) => p.id === "p01")!;
    const editado = gravar(comConsumo, editarProduto, { ...p01, nome: "Água 500ml", precoVenda: 6 });
    expect(editado.consumos.at(-1)).toMatchObject({
      produtoNome: "Água mineral sem gás",
      valorUnitario: 5,
    });
    expect(editado.lancamentos.at(-1)?.valor).toBe(10);
  });

  it("inativar tira o produto da venda, mas mantém o histórico; reativar devolve", () => {
    const inativo = gravar(BANCO, inativarProduto, { id: "p01" });
    expect(inativo.produtos.find((p) => p.id === "p01")?.ativo).toBe(false);
    expect(inativo.movimentosEstoque).toBe(BANCO.movimentosEstoque);
    expect(saldo(inativo, "p01")).toBe(96);
    expect(recusa(inativo, inativarProduto, { id: "p01" })).toBe("Água mineral sem gás já está inativo.");

    const ativo = gravar(inativo, reativarProduto, { id: "p01" });
    expect(ativo.produtos.find((p) => p.id === "p01")?.ativo).toBe(true);
    expect(recusa(ativo, reativarProduto, { id: "p01" })).toBe("Água mineral sem gás já está ativo.");
  });
});

describe("fechar conta de consumo", () => {
  /** a01 com dois consumos novos e uma cobranca anulada; a02 com um consumo novo. */
  function cenario(): Banco {
    let banco = gravar(BANCO, lancarConsumo, consumoDeAgua);
    banco = gravar(banco, lancarConsumo, { ...consumoDeAgua, produtoId: "p05", quantidade: 1 });
    banco = gravar(banco, lancarConsumo, { ...consumoDeAgua, pessoaId: "a02" });
    banco = gravar(banco, lancarConsumo, { ...consumoDeAgua, produtoId: "p08", quantidade: 1 });
    // O financeiro anulou a ultima cobranca de a01 (lancamentos nunca se apagam).
    const anulada = banco.lancamentos.at(-1)!;
    return {
      ...banco,
      lancamentos: banco.lancamentos.map((l) =>
        l.id === anulada.id ? { ...l, canceladoEm: AGORA, motivoCancelamento: "Lançado por engano" } : l,
      ),
    };
  }

  it("paga só os consumos em aberto daquela pessoa", () => {
    const antes = cenario();
    const abertosDeA01 = antes.lancamentos.filter(
      (l) => l.categoria === "Consumo" && l.pessoaId === "a01" && !l.pagoEm && !l.canceladoEm,
    );
    expect(abertosDeA01.length).toBeGreaterThanOrEqual(2);

    const depois = gravar(antes, fecharContaDeConsumo, {
      pessoaId: "a01",
      pagoEm: HOJE,
      formaPagamento: "Dinheiro",
    });

    const idsPagos = new Set(abertosDeA01.map((l) => l.id));
    const porId = new Map(antes.lancamentos.map((l) => [l.id, l]));
    depois.lancamentos.forEach((l) => {
      if (idsPagos.has(l.id)) {
        expect(l).toMatchObject({ pagoEm: HOJE, formaPagamento: "Dinheiro" });
      } else {
        // Ja pagos, anulados, de outras pessoas e que nao sao consumo: intactos.
        expect(l).toBe(porId.get(l.id));
      }
    });

    expect(depois.auditoria.filter((r) => r.operacao === "Fechar conta de consumo")).toHaveLength(
      abertosDeA01.length,
    );
    expect(resumoDaConta(consumosDaPessoa(depois, "a01", HOJE)).emAberto).toBe(0);
    expect(resumoDaConta(consumosDaPessoa(depois, "a02", HOJE)).emAberto).toBeGreaterThan(0);
  });

  it("sem nada em aberto, recusa", () => {
    const fechada = gravar(cenario(), fecharContaDeConsumo, {
      pessoaId: "a01",
      pagoEm: HOJE,
      formaPagamento: "Stone",
    });
    expect(
      recusa(fechada, fecharContaDeConsumo, { pessoaId: "a01", pagoEm: HOJE, formaPagamento: "Stone" }),
    ).toBe("Não há consumo em aberto nesta conta.");
  });

  it("data no futuro, antes do último consumo ou forma desconhecida são recusadas", () => {
    const banco = cenario();
    const dados = { pessoaId: "a01", pagoEm: HOJE, formaPagamento: "Stone" };
    expect(recusa(banco, fecharContaDeConsumo, { ...dados, pagoEm: somarDias(HOJE, 1) })).toBe(
      "A data do pagamento não pode ser depois de hoje.",
    );
    expect(recusa(banco, fecharContaDeConsumo, { ...dados, pagoEm: somarDias(HOJE, -1) })).toMatch(
      /^A data do pagamento não pode ser antes do último consumo em aberto/,
    );
    expect(recusa(banco, fecharContaDeConsumo, { ...dados, formaPagamento: "Cheque" })).toBe(
      "Escolha a forma de pagamento.",
    );
  });
});

describe("consultas do estoque e da conta", () => {
  it("nível: esgotado, repor já (abaixo do mínimo), atenção e em dia", () => {
    expect(nivelDoEstoque(0, 10)).toBe("esgotado");
    expect(nivelDoEstoque(5, 10)).toBe("critico");
    expect(nivelDoEstoque(12, 10)).toBe("atencao");
    expect(nivelDoEstoque(14, 10)).toBe("saudavel");
  });

  it("situação do consumo vem do lançamento: em aberto, em atraso, pago e anulado", () => {
    const banco = gravar(BANCO, lancarConsumo, consumoDeAgua);
    const idDoConsumo = banco.consumos.at(-1)!.id;
    const situacao = (b: Banco, hoje: string) =>
      consumosDaPessoa(b, "a01", hoje).find((c) => c.consumo.id === idDoConsumo)?.situacao;

    expect(situacao(banco, HOJE)).toBe("em_aberto");
    expect(situacao(banco, somarDias(HOJE, 8))).toBe("em_atraso");
    const paga = gravar(banco, fecharContaDeConsumo, {
      pessoaId: "a01",
      pagoEm: HOJE,
      formaPagamento: "Stone",
    });
    expect(situacao(paga, HOJE)).toBe("pago");
    const anulada: Banco = {
      ...banco,
      lancamentos: banco.lancamentos.map((l) =>
        l.consumoId === idDoConsumo ? { ...l, canceladoEm: AGORA } : l,
      ),
    };
    expect(situacao(anulada, HOJE)).toBe("anulado");
  });

  it("lista de compras começa pelo esgotado e ignora inativos; busca ignora acentos", () => {
    const produtos = produtosComSaldo(BANCO);
    expect(listaDeCompras(produtos)[0].produto.id).toBe("p12");

    const semP12 = produtosComSaldo(gravar(BANCO, inativarProduto, { id: "p12" }));
    expect(listaDeCompras(semP12).some((i) => i.produto.id === "p12")).toBe(false);

    const filtro = { categoria: "todas" as const, busca: "agua", apenasRepor: false, incluirInativos: false };
    expect(filtrarProdutos(produtos, filtro).map((i) => i.produto.id)).toEqual(
      expect.arrayContaining(["p01", "p02", "p04"]),
    );
    expect(filtrarProdutos(semP12, { ...filtro, busca: "sem alcool" })).toHaveLength(0);
    expect(filtrarProdutos(semP12, { ...filtro, busca: "sem alcool", incluirInativos: true })).toHaveLength(1);
  });
});

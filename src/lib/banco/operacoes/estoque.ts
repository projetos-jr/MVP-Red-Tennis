/**
 * Operacoes do estoque e do consumo no balcao.
 *
 *  - cadastro, edicao, inativacao e reativacao de produto;
 *  - entrada de mercadoria, com conta a pagar ao fornecedor (opcional);
 *  - perda e ajuste de inventario;
 *  - consumo no balcao: consumo + baixa no estoque + lancamento a receber;
 *  - fechar a conta de consumo de uma pessoa.
 *
 * Todas sao "tudo ou nada": se uma regra falha, nada e gravado. Ninguem
 * grava saldo: cada operacao grava movimentos, e o saldo e a soma deles.
 */

import { formatarData, paraData, paraISO, somarDias } from "../../date";
import { definirOperacao } from "../executar";
import { exigir, novoId } from "../regras/comum";
import {
  CATEGORIAS_PRODUTO,
  garantirAcessoAoEstoque,
  garantirNomeDeProdutoUnico,
  garantirPrecosValidos,
  garantirProdutoVendavel,
  garantirQuantidadeValida,
  garantirSaldoDeEstoque,
  lancamentosDeConsumoEmAberto,
  saldoDoProduto,
} from "../regras/estoque";
import type {
  Banco,
  CategoriaProduto,
  Consumo,
  Lancamento,
  MovimentoEstoque,
  Produto,
} from "../tipos";

function emReais(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** "YYYY-MM-DD" de um dia que existe (recusa "2026-02-31"). */
function dataValida(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && paraISO(paraData(iso)) === iso;
}

function buscarProdutoOuRecusar(banco: Banco, id: string): Produto {
  const produto = banco.produtos.find((p) => p.id === id);
  exigir(produto, "Produto não encontrado.");
  return produto;
}

// ---------------------------------------------------------------------------
// Cadastro de produto
// ---------------------------------------------------------------------------

export interface DadosDoProduto {
  nome: string;
  categoria: CategoriaProduto;
  /** "lata 350ml", "unidade", "pacote 45g"... */
  unidade: string;
  precoCusto: number;
  precoVenda: number;
  estoqueMinimo: number;
}

/** Confere e limpa os campos do cadastro (vale para cadastrar e para editar). */
function camposDoProduto(banco: Banco, dados: DadosDoProduto, ignorarId?: string): DadosDoProduto {
  const nome = dados.nome.replace(/\s+/g, " ").trim();
  exigir(nome, "Informe o nome do produto.");
  exigir(CATEGORIAS_PRODUTO.includes(dados.categoria), "Escolha a categoria do produto.");
  const unidade = dados.unidade.trim();
  exigir(unidade, "Informe a unidade (lata 350ml, unidade, pacote…).");
  garantirPrecosValidos(dados.precoCusto, dados.precoVenda);
  exigir(
    Number.isInteger(dados.estoqueMinimo) && dados.estoqueMinimo >= 0,
    "O estoque mínimo precisa ser um número inteiro, zero ou maior.",
  );
  garantirNomeDeProdutoUnico(banco.produtos, nome, ignorarId);
  return {
    nome,
    categoria: dados.categoria,
    unidade,
    precoCusto: emReais(dados.precoCusto),
    precoVenda: emReais(dados.precoVenda),
    estoqueMinimo: dados.estoqueMinimo,
  };
}

/** Produto novo comeca ativo e sem saldo: o saldo vem da primeira entrada. */
export const cadastrarProduto = definirOperacao(
  "Cadastrar produto",
  (banco, dados: DadosDoProduto, ctx) => {
    garantirAcessoAoEstoque(banco.configuracoes, ctx.usuario);
    const campos = camposDoProduto(banco, dados);
    return {
      ...banco,
      produtos: [...banco.produtos, { id: novoId("pr"), ...campos, ativo: true }],
    };
  },
);

/**
 * Mudar nome ou preco nao reescreve o historico: cada consumo guarda o nome
 * e o preco do momento da venda.
 */
export const editarProduto = definirOperacao(
  "Editar produto",
  (banco, dados: DadosDoProduto & { id: string }, ctx) => {
    garantirAcessoAoEstoque(banco.configuracoes, ctx.usuario);
    const atual = buscarProdutoOuRecusar(banco, dados.id);
    const campos = camposDoProduto(banco, dados, atual.id);
    const mudou = (Object.keys(campos) as Array<keyof DadosDoProduto>).some(
      (campo) => campos[campo] !== atual[campo],
    );
    if (!mudou) return banco;
    return {
      ...banco,
      produtos: banco.produtos.map((p) => (p.id === atual.id ? { ...p, ...campos } : p)),
    };
  },
);

/**
 * Produto inativo sai das listas de venda, mas continua no historico (nos
 * consumos, nos movimentos e no financeiro). O saldo que sobrou continua
 * contado e pode receber perda ou ajuste.
 */
export const inativarProduto = definirOperacao(
  "Inativar produto",
  (banco, dados: { id: string }, ctx) => {
    garantirAcessoAoEstoque(banco.configuracoes, ctx.usuario);
    const produto = buscarProdutoOuRecusar(banco, dados.id);
    exigir(produto.ativo, `${produto.nome} já está inativo.`);
    return {
      ...banco,
      produtos: banco.produtos.map((p) => (p.id === produto.id ? { ...p, ativo: false } : p)),
    };
  },
);

export const reativarProduto = definirOperacao(
  "Reativar produto",
  (banco, dados: { id: string }, ctx) => {
    garantirAcessoAoEstoque(banco.configuracoes, ctx.usuario);
    const produto = buscarProdutoOuRecusar(banco, dados.id);
    exigir(!produto.ativo, `${produto.nome} já está ativo.`);
    return {
      ...banco,
      produtos: banco.produtos.map((p) => (p.id === produto.id ? { ...p, ativo: true } : p)),
    };
  },
);

// ---------------------------------------------------------------------------
// Movimentos: entrada, perda e ajuste de inventario
// ---------------------------------------------------------------------------

export interface ContaAPagarDaEntrada {
  /** Fornecedor que vai receber. */
  favorecido: string;
  valor: number;
  vencimento: string;
}

export interface DadosDaEntrada {
  produtoId: string;
  quantidade: number;
  observacao?: string;
  /** Preenchido quando a compra tambem gera a conta a pagar ao fornecedor. */
  contaAPagar?: ContaAPagarDaEntrada;
}

/**
 * Entrada de mercadoria. Com `contaAPagar`, grava na mesma operacao o
 * lancamento a pagar ao fornecedor, ligado ao movimento (`movimentoEstoqueId`).
 */
export const registrarEntrada = definirOperacao(
  "Registrar entrada de mercadoria",
  (banco, dados: DadosDaEntrada, ctx) => {
    garantirAcessoAoEstoque(banco.configuracoes, ctx.usuario);
    const produto = buscarProdutoOuRecusar(banco, dados.produtoId);
    exigir(
      produto.ativo,
      `${produto.nome} está inativo. Reative o produto antes de registrar a entrada.`,
    );
    garantirQuantidadeValida(dados.quantidade);

    const entrada: MovimentoEstoque = {
      id: novoId("mv"),
      produtoId: produto.id,
      data: ctx.agora,
      tipo: "entrada",
      quantidade: dados.quantidade,
      responsavel: ctx.usuario.nome,
      observacao: dados.observacao?.trim() || undefined,
    };
    const comEntrada: Banco = {
      ...banco,
      movimentosEstoque: [...banco.movimentosEstoque, entrada],
    };
    if (!dados.contaAPagar) return comEntrada;

    const conta = dados.contaAPagar;
    const favorecido = conta.favorecido.trim();
    exigir(favorecido, "Informe o fornecedor que vai receber a conta a pagar.");
    exigir(
      Number.isFinite(conta.valor) && conta.valor > 0,
      "O valor da conta a pagar precisa ser maior que zero.",
    );
    exigir(dataValida(conta.vencimento), "Informe o vencimento da conta a pagar.");

    const lancamento: Lancamento = {
      id: novoId("lc"),
      tipo: "pagar",
      categoria: "Fornecedor",
      nomePagante: favorecido,
      item: `Compra: ${dados.quantidade}× ${produto.nome}`,
      valor: emReais(conta.valor),
      vencimento: conta.vencimento,
      movimentoEstoqueId: entrada.id,
      criadoEm: ctx.agora,
    };
    return { ...comEntrada, lancamentos: [...banco.lancamentos, lancamento] };
  },
);

/** Quebra, vencimento, cortesia... A saida nunca passa do saldo. */
export const registrarPerda = definirOperacao(
  "Registrar perda",
  (banco, dados: { produtoId: string; quantidade: number; motivo: string }, ctx) => {
    garantirAcessoAoEstoque(banco.configuracoes, ctx.usuario);
    const produto = buscarProdutoOuRecusar(banco, dados.produtoId);
    garantirQuantidadeValida(dados.quantidade);
    const motivo = dados.motivo.trim();
    exigir(motivo, "Informe o motivo da perda.");
    garantirSaldoDeEstoque(banco.movimentosEstoque, produto.id, produto.nome, dados.quantidade);
    return {
      ...banco,
      movimentosEstoque: [
        ...banco.movimentosEstoque,
        {
          id: novoId("mv"),
          produtoId: produto.id,
          data: ctx.agora,
          tipo: "perda",
          quantidade: dados.quantidade,
          responsavel: ctx.usuario.nome,
          observacao: motivo,
        },
      ],
    };
  },
);

/**
 * Ajuste de inventario: a pessoa conta o que ha na prateleira e informa o
 * total. Grava um movimento "ajuste" com a diferenca (positiva ou negativa),
 * e o saldo passa a ser exatamente o contado.
 */
export const ajustarInventario = definirOperacao(
  "Ajustar inventário",
  (
    banco,
    dados: { produtoId: string; saldoContado: number; observacao?: string },
    ctx,
  ) => {
    garantirAcessoAoEstoque(banco.configuracoes, ctx.usuario);
    const produto = buscarProdutoOuRecusar(banco, dados.produtoId);
    exigir(
      Number.isInteger(dados.saldoContado) && dados.saldoContado >= 0,
      "O saldo contado precisa ser um número inteiro, zero ou maior.",
    );
    const saldo = saldoDoProduto(banco.movimentosEstoque, produto.id);
    const diferenca = dados.saldoContado - saldo;
    exigir(
      diferenca !== 0,
      `O saldo contado é igual ao do sistema (${saldo}): não há o que ajustar.`,
    );
    const observacao = [
      `Contagem: ${dados.saldoContado} (sistema: ${saldo})`,
      dados.observacao?.trim(),
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      ...banco,
      movimentosEstoque: [
        ...banco.movimentosEstoque,
        {
          id: novoId("mv"),
          produtoId: produto.id,
          data: ctx.agora,
          tipo: "ajuste",
          quantidade: diferenca,
          responsavel: ctx.usuario.nome,
          observacao,
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Consumo no balcao
// ---------------------------------------------------------------------------

export interface DadosDoConsumo {
  pessoaId: string;
  pessoaTipo: "aluno" | "professor";
  produtoId: string;
  quantidade: number;
}

/**
 * Lanca o consumo na conta da pessoa. Numa operacao so grava o consumo, a
 * baixa no estoque (movimento "venda") e o lancamento a receber no
 * financeiro. Se o produto esta inativo ou o saldo nao basta, nada e gravado.
 */
export const lancarConsumo = definirOperacao(
  "Lançar consumo",
  (banco, dados: DadosDoConsumo, ctx) => {
    garantirAcessoAoEstoque(banco.configuracoes, ctx.usuario);
    const pessoa =
      dados.pessoaTipo === "aluno"
        ? banco.alunos.find((a) => a.id === dados.pessoaId)
        : banco.professores.find((p) => p.id === dados.pessoaId);
    exigir(pessoa, "Pessoa não encontrada no cadastro.");
    const produto = buscarProdutoOuRecusar(banco, dados.produtoId);
    garantirQuantidadeValida(dados.quantidade);
    garantirProdutoVendavel(banco.movimentosEstoque, produto, dados.quantidade);

    const consumo: Consumo = {
      id: novoId("cs"),
      pessoaId: pessoa.id,
      pessoaTipo: dados.pessoaTipo,
      data: ctx.agora,
      produtoId: produto.id,
      // Nome e preco do momento da venda: mudar o cadastro nao reescreve a conta.
      produtoNome: produto.nome,
      quantidade: dados.quantidade,
      valorUnitario: produto.precoVenda,
    };
    const venda: MovimentoEstoque = {
      id: novoId("mv"),
      produtoId: produto.id,
      data: ctx.agora,
      tipo: "venda",
      quantidade: dados.quantidade,
      responsavel: ctx.usuario.nome,
      observacao: "Consumo no balcão",
      consumoId: consumo.id,
    };
    const cobranca: Lancamento = {
      id: novoId("lc"),
      tipo: "receber",
      categoria: "Consumo",
      pessoaId: pessoa.id,
      pessoaTipo: dados.pessoaTipo,
      nomePagante: pessoa.nome,
      item: `${dados.quantidade}× ${produto.nome}`,
      valor: emReais(dados.quantidade * produto.precoVenda),
      // Hipotese H13: prazo para pagar o consumo (valor de teste nas Configuracoes).
      vencimento: somarDias(ctx.hoje, banco.configuracoes.prazoPagamentoConsumoDias),
      consumoId: consumo.id,
      criadoEm: ctx.agora,
    };

    return {
      ...banco,
      consumos: [...banco.consumos, consumo],
      movimentosEstoque: [...banco.movimentosEstoque, venda],
      lancamentos: [...banco.lancamentos, cobranca],
    };
  },
);

export interface DadosDoFechamento {
  pessoaId: string;
  /** Dia em que a pessoa pagou ("YYYY-MM-DD"). */
  pagoEm: string;
  formaPagamento: string;
}

/**
 * Fechar a conta: registra de uma vez o pagamento de todos os consumos em
 * aberto da pessoa (pendentes e em atraso), atualizando os lancamentos.
 * Consumos ja pagos ou anulados e os de outras pessoas nao mudam.
 */
export const fecharContaDeConsumo = definirOperacao(
  "Fechar conta de consumo",
  (banco, dados: DadosDoFechamento, ctx) => {
    garantirAcessoAoEstoque(banco.configuracoes, ctx.usuario);
    exigir(dataValida(dados.pagoEm), "Informe a data do pagamento.");
    exigir(dados.pagoEm <= ctx.hoje, "A data do pagamento não pode ser depois de hoje.");
    exigir(
      banco.configuracoes.formasPagamento.includes(dados.formaPagamento),
      "Escolha a forma de pagamento.",
    );

    const abertos = lancamentosDeConsumoEmAberto(banco.lancamentos, dados.pessoaId);
    exigir(abertos.length > 0, "Não há consumo em aberto nesta conta.");
    const ultimoConsumo = abertos.reduce(
      (maior, l) => (l.criadoEm.slice(0, 10) > maior ? l.criadoEm.slice(0, 10) : maior),
      "",
    );
    exigir(
      dados.pagoEm >= ultimoConsumo,
      `A data do pagamento não pode ser antes do último consumo em aberto (${formatarData(ultimoConsumo)}).`,
    );

    const ids = new Set(abertos.map((l) => l.id));
    return {
      ...banco,
      lancamentos: banco.lancamentos.map((l) =>
        ids.has(l.id) ? { ...l, pagoEm: dados.pagoEm, formaPagamento: dados.formaPagamento } : l,
      ),
    };
  },
);

/**
 * Dados de exemplo: estoque do balcao.
 *
 * O saldo de cada produto e a soma dos movimentos, entao os movimentos sao
 * montados para chegar ao saldo que o MVP mostrava: um inventario inicial
 * (ajuste), as entradas do fornecedor, as vendas (uma por consumo) e algumas
 * perdas. Cada consumo gera tambem o seu lancamento a receber, e cada entrada
 * do fornecedor, uma conta a pagar.
 */

import { somarDias } from "../../date";
import { HOJE } from "../constantes";
import { CATEGORIAS_PRODUTO } from "../regras/estoque";
import type {
  CategoriaProduto,
  Consumo,
  Lancamento,
  MovimentoEstoque,
  Produto,
} from "../tipos";
import { criarRng, doisDigitos, escolher, inteiro } from "./aleatorio";
import { DIAS_COM_CHUVA } from "./agenda";
import { CONFIGURACOES_INICIAIS, PERFIS_DE_SEMENTE, PROFESSORES } from "./cadastros";

// A lista mora nas regras; continua exportada daqui para quem ja a usava.
export { CATEGORIAS_PRODUTO };

interface ProdutoDoMvp extends Omit<Produto, "ativo"> {
  /** Saldo que o produto deve ter hoje (o que o MVP mostrava). */
  saldoHoje: number;
}

/**
 * Catalogo vendido no balcao. Alguns itens ficam zerados ou abaixo do minimo
 * de proposito, para demonstrar o alerta de reposicao.
 */
const PRODUTOS_DO_MVP: ProdutoDoMvp[] = [
  { id: "p01", nome: "Água mineral sem gás", categoria: "Bebidas", unidade: "garrafa 500ml", precoCusto: 1.9, precoVenda: 5, saldoHoje: 96, estoqueMinimo: 40 },
  { id: "p02", nome: "Água mineral com gás", categoria: "Bebidas", unidade: "garrafa 500ml", precoCusto: 2.2, precoVenda: 6, saldoHoje: 34, estoqueMinimo: 24 },
  { id: "p03", nome: "Isotônico", categoria: "Bebidas", unidade: "garrafa 500ml", precoCusto: 4.5, precoVenda: 10, saldoHoje: 18, estoqueMinimo: 24 },
  { id: "p04", nome: "Água de coco", categoria: "Bebidas", unidade: "caixa 200ml", precoCusto: 3.2, precoVenda: 8, saldoHoje: 41, estoqueMinimo: 20 },
  { id: "p05", nome: "Refrigerante", categoria: "Bebidas", unidade: "lata 350ml", precoCusto: 2.8, precoVenda: 7, saldoHoje: 62, estoqueMinimo: 36 },
  { id: "p06", nome: "Suco natural de laranja", categoria: "Bebidas", unidade: "copo 300ml", precoCusto: 3.5, precoVenda: 9, saldoHoje: 12, estoqueMinimo: 15 },
  { id: "p07", nome: "Energético", categoria: "Bebidas", unidade: "lata 250ml", precoCusto: 5.4, precoVenda: 12, saldoHoje: 27, estoqueMinimo: 12 },
  { id: "p08", nome: "Café expresso", categoria: "Bebidas", unidade: "dose", precoCusto: 1.2, precoVenda: 5, saldoHoje: 120, estoqueMinimo: 50 },
  { id: "p09", nome: "Cerveja pilsen long neck", categoria: "Cervejas", unidade: "garrafa 330ml", precoCusto: 4.2, precoVenda: 11, saldoHoje: 78, estoqueMinimo: 48 },
  { id: "p10", nome: "Cerveja puro malte", categoria: "Cervejas", unidade: "lata 350ml", precoCusto: 3.6, precoVenda: 9, saldoHoje: 54, estoqueMinimo: 48 },
  { id: "p11", nome: "Cerveja IPA artesanal", categoria: "Cervejas", unidade: "garrafa 600ml", precoCusto: 9.5, precoVenda: 22, saldoHoje: 9, estoqueMinimo: 12 },
  { id: "p12", nome: "Cerveja sem álcool", categoria: "Cervejas", unidade: "lata 350ml", precoCusto: 3.9, precoVenda: 10, saldoHoje: 0, estoqueMinimo: 12 },
  { id: "p13", nome: "Salgadinho de pacote", categoria: "Lanches", unidade: "pacote 45g", precoCusto: 2.4, precoVenda: 7, saldoHoje: 44, estoqueMinimo: 20 },
  { id: "p14", nome: "Amendoim torrado", categoria: "Lanches", unidade: "pacote 50g", precoCusto: 1.8, precoVenda: 6, saldoHoje: 31, estoqueMinimo: 15 },
  { id: "p15", nome: "Barra de cereal", categoria: "Lanches", unidade: "unidade", precoCusto: 1.6, precoVenda: 5, saldoHoje: 7, estoqueMinimo: 20 },
  { id: "p16", nome: "Biscoito de polvilho", categoria: "Lanches", unidade: "pacote 100g", precoCusto: 3.1, precoVenda: 8, saldoHoje: 22, estoqueMinimo: 12 },
  { id: "p17", nome: "Sanduíche natural", categoria: "Lanches", unidade: "unidade", precoCusto: 6.5, precoVenda: 15, saldoHoje: 6, estoqueMinimo: 8 },
  { id: "p18", nome: "Chocolate", categoria: "Lanches", unidade: "barra 90g", precoCusto: 4.2, precoVenda: 10, saldoHoje: 25, estoqueMinimo: 12 },
  { id: "p19", nome: "Tubo de bolas", categoria: "Acessórios", unidade: "tubo com 3", precoCusto: 34, precoVenda: 65, saldoHoje: 23, estoqueMinimo: 15 },
  { id: "p20", nome: "Overgrip", categoria: "Acessórios", unidade: "unidade", precoCusto: 9, precoVenda: 20, saldoHoje: 48, estoqueMinimo: 20 },
  { id: "p21", nome: "Corda para raquete", categoria: "Acessórios", unidade: "jogo", precoCusto: 45, precoVenda: 95, saldoHoje: 11, estoqueMinimo: 8 },
  { id: "p22", nome: "Munhequeira", categoria: "Acessórios", unidade: "par", precoCusto: 12, precoVenda: 28, saldoHoje: 4, estoqueMinimo: 10 },
  { id: "p23", nome: "Antivibrador", categoria: "Acessórios", unidade: "unidade", precoCusto: 6, precoVenda: 15, saldoHoje: 30, estoqueMinimo: 10 },
  { id: "p24", nome: "Viseira Red Tennis", categoria: "Acessórios", unidade: "unidade", precoCusto: 22, precoVenda: 55, saldoHoje: 14, estoqueMinimo: 6 },
];

const FORNECEDOR_POR_CATEGORIA: Record<CategoriaProduto, string> = {
  Bebidas: "Distribuidora de bebidas",
  Cervejas: "Distribuidora de bebidas",
  Lanches: "Atacado de alimentos",
  Acessórios: "Loja de artigos esportivos",
};

const RESPONSAVEIS = ["Lucas Ferreira", "Francisco Menezes"];

function emReais(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export interface EstoqueGerado {
  produtos: Produto[];
  movimentosEstoque: MovimentoEstoque[];
  consumos: Consumo[];
  /** Lancamentos a receber dos consumos e contas a pagar dos fornecedores. */
  lancamentos: Lancamento[];
}

export function gerarEstoque(): EstoqueGerado {
  const produtos: Produto[] = PRODUTOS_DO_MVP.map(({ saldoHoje, ...produto }) => {
    void saldoHoje;
    return { ...produto, ativo: true };
  });
  const porId = new Map(produtos.map((p) => [p.id, p]));

  // --- Consumos (ultimos 30 dias) ---------------------------------------------
  const rng = criarRng(55501);
  const deBalcao = produtos.filter((p) => p.categoria !== "Acessórios");
  const clientes = PERFIS_DE_SEMENTE.filter((p) => !p.congelado);
  const consumos: Consumo[] = [];
  const emAberto = new Set<string>();
  const lancamentos: Lancamento[] = [];

  for (let diasAtras = 29; diasAtras >= 0; diasAtras -= 1) {
    const data = somarDias(HOJE, -diasAtras);
    if (DIAS_COM_CHUVA.includes(data)) continue; // arena fechada

    const quantidadeNoDia = inteiro(rng, 8, 18);
    for (let i = 0; i < quantidadeNoDia; i += 1) {
      const ehProfessor = rng() > 0.82;
      const pessoa = ehProfessor
        ? { id: escolher(rng, PROFESSORES).id }
        : { id: escolher(rng, clientes).alunoId };
      const produto = escolher(rng, deBalcao);
      // Hoje so ha vendas de manha: nenhuma venda de exemplo fica "no futuro"
      // e o consumo lancado na demonstracao aparece no topo das movimentacoes.
      const hora = inteiro(rng, 8, diasAtras === 0 ? 11 : 21);
      const consumo: Consumo = {
        id: `cs-${diasAtras}-${i}`,
        pessoaId: pessoa.id,
        pessoaTipo: ehProfessor ? "professor" : "aluno",
        data: `${data}T${doisDigitos(hora)}:${escolher(rng, ["04", "13", "27", "35", "48", "56"])}:00`,
        produtoId: produto.id,
        produtoNome: produto.nome,
        quantidade: rng() > 0.78 ? 2 : 1,
        valorUnitario: produto.precoVenda,
      };
      consumos.push(consumo);

      // Consumo recente costuma ficar em aberto ate o fechamento da conta;
      // alguns mais antigos ficaram esquecidos (aparecem em atraso).
      const aberto =
        (diasAtras <= 6 && rng() > 0.45) || (diasAtras >= 8 && diasAtras <= 14 && rng() < 0.05);
      if (aberto) emAberto.add(consumo.id);
    }
  }

  const nomeDaPessoa = new Map<string, string>([
    ...PERFIS_DE_SEMENTE.map((p) => [p.alunoId, p.nome] as [string, string]),
    ...PROFESSORES.map((p) => [p.id, p.nome] as [string, string]),
  ]);

  consumos.forEach((consumo) => {
    const dia = consumo.data.slice(0, 10);
    const pago = !emAberto.has(consumo.id);
    lancamentos.push({
      id: `lc-${consumo.id}`,
      tipo: "receber",
      categoria: "Consumo",
      pessoaId: consumo.pessoaId,
      pessoaTipo: consumo.pessoaTipo,
      nomePagante: nomeDaPessoa.get(consumo.pessoaId),
      item: `${consumo.quantidade}× ${consumo.produtoNome}`,
      valor: emReais(consumo.quantidade * consumo.valorUnitario),
      vencimento: somarDias(dia, CONFIGURACOES_INICIAIS.prazoPagamentoConsumoDias),
      pagoEm: pago ? dia : undefined,
      formaPagamento: pago ? escolher(rng, ["Dinheiro", "Bradesco", "Stone"]) : undefined,
      consumoId: consumo.id,
      criadoEm: consumo.data,
    });
  });

  // --- Movimentos -----------------------------------------------------------------
  const movimentos: MovimentoEstoque[] = consumos.map((consumo) => ({
    id: `mv-${consumo.id}`,
    produtoId: consumo.produtoId,
    data: consumo.data,
    tipo: "venda",
    quantidade: consumo.quantidade,
    responsavel: "Lucas Ferreira",
    observacao: "Consumo no balcão",
    consumoId: consumo.id,
  }));

  const rngPerdas = criarRng(6420);
  ["p11", "p17", "p06"].forEach((produtoId, i) => {
    movimentos.push({
      id: `mv-perda-${produtoId}`,
      produtoId,
      data: `${somarDias(HOJE, -(3 + i * 5))}T16:${20 + i}:00`,
      tipo: "perda",
      quantidade: inteiro(rngPerdas, 1, 3),
      responsavel: RESPONSAVEIS[i % 2],
      observacao: i === 0 ? "Garrafa quebrada" : "Vencimento",
    });
  });

  // Entradas do fornecedor e inventario inicial, calculados para fechar o saldo de hoje.
  const inicioDoInventario = somarDias(HOJE, -31);
  PRODUTOS_DO_MVP.forEach((produto, indice) => {
    const rngProduto = criarRng(8800 + indice * 13);
    const saidas = movimentos
      .filter((m) => m.produtoId === produto.id)
      .reduce((soma, m) => soma + m.quantidade, 0);

    let entrada = rngProduto() < 0.45 ? inteiro(rngProduto, 12, 60) : 0;
    let inventario = produto.saldoHoje + saidas - entrada;
    if (inventario < 0) {
      entrada += inventario;
      inventario = 0;
    }

    movimentos.push({
      id: `mv-inv-${produto.id}`,
      produtoId: produto.id,
      data: `${inicioDoInventario}T08:00:00`,
      tipo: "ajuste",
      quantidade: inventario,
      responsavel: "Francisco Menezes",
      observacao: "Inventário inicial (contagem)",
    });

    if (entrada > 0) {
      const dia = somarDias(HOJE, -inteiro(rngProduto, 1, 26));
      const movimento: MovimentoEstoque = {
        id: `mv-ent-${produto.id}`,
        produtoId: produto.id,
        data: `${dia}T${doisDigitos(inteiro(rngProduto, 8, 17))}:${escolher(rngProduto, ["10", "25", "40"])}:00`,
        tipo: "entrada",
        quantidade: entrada,
        responsavel: RESPONSAVEIS[indice % 2],
        observacao: "Reposição do fornecedor",
      };
      movimentos.push(movimento);

      const vencimento = somarDias(dia, 15);
      const base = porId.get(produto.id);
      lancamentos.push({
        id: `lc-fn-${produto.id}`,
        tipo: "pagar",
        categoria: "Fornecedor",
        nomePagante: FORNECEDOR_POR_CATEGORIA[produto.categoria],
        item: `Compra: ${entrada}× ${base?.nome ?? produto.nome}`,
        valor: emReais(entrada * produto.precoCusto),
        vencimento,
        pagoEm: vencimento < HOJE ? vencimento : undefined,
        formaPagamento: vencimento < HOJE ? "Bradesco" : undefined,
        movimentoEstoqueId: movimento.id,
        criadoEm: movimento.data,
      });
    }
  });

  return {
    produtos,
    movimentosEstoque: movimentos.sort((a, b) => b.data.localeCompare(a.data)),
    consumos: consumos.sort((a, b) => b.data.localeCompare(a.data)),
    lancamentos,
  };
}

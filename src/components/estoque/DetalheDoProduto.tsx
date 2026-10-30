"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ComentariosDoRegistro } from "@/components/registro/ComentariosDoRegistro";
import { HistoricoDoRegistro } from "@/components/registro/HistoricoDoRegistro";
import { Badge } from "@/components/ui/Badge";
import { LinkDeVolta } from "@/components/ui/CabecalhoDaPagina";
import { Card, CardHeader } from "@/components/ui/Card";
import { MostrarMais } from "@/components/ui/MostrarMais";
import { StatCard } from "@/components/ui/StatCard";
import {
  IconeAlerta,
  IconeEntrada,
  IconeEstoque,
  IconeFinanceiro,
  IconeLixeira,
  IconeSubiu,
} from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import { reativarProduto } from "@/lib/banco/operacoes/estoque";
import { vendaAbaixoDoCusto } from "@/lib/banco/regras/estoque";
import { podeAcessar } from "@/lib/consultas/base";
import { detalheDoProduto } from "@/lib/consultas/estoque";
import { formatarDiaMes } from "@/lib/date";
import { ESTILO_CATEGORIA_PRODUTO, formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { LinhaDeMovimento } from "./CartoesLaterais";
import { IconeArquivar, IconeContagem, IconeEditar } from "./Icones";
import { ModaisDoEstoque, type AcaoDoEstoque } from "./ModaisDoEstoque";
import { BarraDoNivel, SaldoEmDestaque, SeloDoNivel } from "./NivelDoEstoque";
import { SemAcessoAoEstoque } from "./SemAcessoAoEstoque";

/** Nomes dos campos do produto no historico de alteracoes. */
const ROTULOS_DO_PRODUTO: Record<string, string> = {
  nome: "Nome",
  categoria: "Categoria",
  unidade: "Unidade",
  precoCusto: "Preço de custo",
  precoVenda: "Preço de venda",
  estoqueMinimo: "Estoque mínimo",
  ativo: "Ativo",
};

/** Quantos movimentos aparecem de cada vez (o resto vem em "Mostrar mais"). */
const MOVIMENTOS_VISIVEIS = 15;

/**
 * Detalhe de um produto: cadastro, saldo, todos os movimentos (com o saldo
 * de cada momento), comentarios e historico de alteracoes.
 */
export function DetalheDoProduto({ produtoId }: { produtoId: string }) {
  const { banco, colaborador } = useApp();
  const gravar = useGravar();
  const [acao, setAcao] = useState<AcaoDoEstoque | null>(null);
  const [limite, setLimite] = useState(MOVIMENTOS_VISIVEIS);
  const detalhe = useMemo(() => detalheDoProduto(banco, produtoId, HOJE), [banco, produtoId]);

  if (!podeAcessar(banco, colaborador, "estoque")) return <SemAcessoAoEstoque />;

  if (!detalhe) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-areia-600">Produto não encontrado.</p>
        <Link href="/estoque" className="btn-secundario mt-4">
          Voltar para o estoque
        </Link>
      </Card>
    );
  }

  const { produto, saldo, nivel, extrato, vendidos30Dias, perdas30Dias, ultimaEntrada } = detalhe;
  const categoria = ESTILO_CATEGORIA_PRODUTO[produto.categoria];
  const margem = produto.precoVenda - produto.precoCusto;
  const linhas = extrato.slice(0, limite);

  return (
    <>
      <div className="space-y-6">
        <LinkDeVolta href="/estoque">Estoque</LinkDeVolta>

        {/* Cabeçalho */}
        <section className="card p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge cor={categoria.cor} fundo={categoria.fundo} borda={categoria.borda}>
                  {produto.categoria}
                </Badge>
                {!produto.ativo && <Badge>Inativo · fora das listas de venda</Badge>}
              </div>
              <h1 className="mt-2 text-2xl font-bold text-areia-900">{produto.nome}</h1>
              <p className="mt-0.5 text-sm text-areia-600">Vendido por {produto.unidade}</p>
              <p className="mt-3 text-sm text-areia-700">
                Venda <strong className="font-semibold">{formatarMoeda(produto.precoVenda)}</strong>
                <span className="text-areia-500">
                  {" "}
                  · custo {formatarMoeda(produto.precoCusto)} · margem {formatarMoeda(margem)}
                  {produto.precoCusto > 0 && ` (${Math.round((margem / produto.precoCusto) * 100)}%)`}
                </span>
              </p>
              {vendaAbaixoDoCusto(produto.precoCusto, produto.precoVenda) && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
                  <IconeAlerta className="h-3.5 w-3.5" />
                  Venda abaixo do custo
                </p>
              )}
            </div>

            <div className="w-full shrink-0 rounded-xl border border-areia-200 bg-areia-50 p-4 lg:w-72">
              <div className="flex items-end justify-between gap-2">
                <SaldoEmDestaque
                  saldo={saldo}
                  estoqueMinimo={produto.estoqueMinimo}
                  nivel={nivel}
                  tamanho="lg"
                />
                {produto.ativo ? (
                  <SeloDoNivel nivel={nivel} className="text-[11px]" />
                ) : (
                  <Badge className="text-[11px]">Inativo</Badge>
                )}
              </div>
              <BarraDoNivel
                saldo={saldo}
                estoqueMinimo={produto.estoqueMinimo}
                nivel={nivel}
                className="mt-3"
              />
              <p className="mt-2 text-xs text-areia-500">
                Saldo = soma dos movimentos abaixo.
              </p>
            </div>
          </div>

          {/* No celular, os botões ficam em duas colunas; a entrada ocupa a linha toda. */}
          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-areia-200 pt-4 sm:flex sm:flex-wrap">
            {produto.ativo && (
              <button
                type="button"
                onClick={() => setAcao({ tipo: "entrada", produtoId: produto.id })}
                className="btn-primario col-span-2"
              >
                <IconeEntrada className="h-4 w-4" />
                Entrada de mercadoria
              </button>
            )}
            <button
              type="button"
              onClick={() => setAcao({ tipo: "perda", produtoId: produto.id })}
              disabled={saldo <= 0}
              className="btn-secundario"
            >
              <IconeLixeira className="h-4 w-4" />
              Perda
            </button>
            <button
              type="button"
              onClick={() => setAcao({ tipo: "inventario", produtoId: produto.id })}
              className="btn-secundario"
              title="Ajuste de inventário: informe quanto há na prateleira"
            >
              <IconeContagem className="h-4 w-4" />
              Contagem
            </button>
            <button
              type="button"
              onClick={() => setAcao({ tipo: "editar", produtoId: produto.id })}
              className="btn-secundario"
              aria-label="Editar cadastro"
            >
              <IconeEditar className="h-4 w-4" />
              <span className="sm:hidden">Editar</span>
              <span className="hidden sm:inline">Editar cadastro</span>
            </button>
            {produto.ativo ? (
              <button
                type="button"
                onClick={() => setAcao({ tipo: "inativar", produtoId: produto.id })}
                className="btn-fantasma text-tijolo-700 hover:text-tijolo-800 sm:ml-auto"
              >
                <IconeArquivar className="h-4 w-4" />
                Inativar
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  gravar(
                    reativarProduto,
                    { id: produto.id },
                    `${produto.nome} voltou para o catálogo e para as listas de venda.`,
                  )
                }
                className="btn-secundario sm:ml-auto"
              >
                Reativar produto
              </button>
            )}
          </div>
        </section>

        {/* Indicadores */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            rotulo="Vendidos em 30 dias"
            rotuloCurto="Vendidos"
            valor={String(vendidos30Dias.unidades)}
            detalhe={`${formatarMoeda(vendidos30Dias.total)} em consumo`}
            icone={<IconeSubiu className="h-5 w-5" />}
            tom="saibro"
          />
          <StatCard
            rotulo="Valor em estoque"
            rotuloCurto="Valor"
            valor={formatarMoeda(Math.max(saldo, 0) * produto.precoVenda)}
            detalhe={`Custo ${formatarMoeda(Math.max(saldo, 0) * produto.precoCusto)}`}
            icone={<IconeFinanceiro className="h-5 w-5" />}
          />
          <StatCard
            rotulo="Última entrada"
            rotuloCurto="Últ. entrada"
            valor={ultimaEntrada ? formatarDiaMes(ultimaEntrada.data) : "—"}
            detalhe={
              ultimaEntrada
                ? `+${ultimaEntrada.quantidade} · ${ultimaEntrada.responsavel}`
                : "Nenhuma entrada registrada"
            }
            icone={<IconeEntrada className="h-5 w-5" />}
          />
          <StatCard
            rotulo="Perdas em 30 dias"
            rotuloCurto="Perdas"
            valor={String(perdas30Dias)}
            detalhe={
              perdas30Dias > 0
                ? `${formatarMoeda(perdas30Dias * produto.precoCusto)} de custo perdido`
                : "Nenhuma perda"
            }
            icone={<IconeLixeira className="h-5 w-5" />}
            tom={perdas30Dias > 0 ? "alerta" : "neutro"}
          />
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              titulo="Movimentos do produto"
              descricao="Entradas, vendas, perdas e ajustes, com quem registrou e o saldo depois de cada um."
              icone={<IconeEstoque className="h-5 w-5" />}
            />
            <ul className="divide-y divide-areia-100">
              {linhas.map((linha) => (
                <li key={linha.movimento.id} className="px-5 py-3">
                  <LinhaDeMovimento item={linha} mostrarProduto={false} saldoApos={linha.saldoApos} />
                  {linha.contaAPagar && (
                    <p className="mt-1 text-xs text-areia-600">
                      Conta a pagar: {formatarMoeda(linha.contaAPagar.valor)} para{" "}
                      {linha.contaAPagar.nomePagante} · vence{" "}
                      {formatarDiaMes(linha.contaAPagar.vencimento)}
                      {linha.contaAPagar.pagoEm && " · paga"}
                    </p>
                  )}
                </li>
              ))}
              {extrato.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-areia-500">
                  Nenhum movimento ainda. Registre a primeira entrada de mercadoria.
                </li>
              )}
            </ul>
            <MostrarMais
              mostrando={linhas.length}
              total={extrato.length}
              passo={MOVIMENTOS_VISIVEIS}
              aoMostrarMais={() => setLimite((atual) => atual + MOVIMENTOS_VISIVEIS)}
            />
          </Card>

          <div className="min-w-0 space-y-6">
            <ComentariosDoRegistro
              entidade="produto"
              entidadeId={produto.id}
              descricao="Notas da equipe sobre este produto."
            />
            <HistoricoDoRegistro
              tabela="produtos"
              registroId={produto.id}
              rotulos={ROTULOS_DO_PRODUTO}
            />
          </div>
        </div>
      </div>

      {/* Fora do space-y-6: a margem entre filhos deslocaria o fundo fixo do modal. */}
      <ModaisDoEstoque acao={acao} aoFechar={() => setAcao(null)} />
    </>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ComentariosDoRegistro } from "@/components/registro/ComentariosDoRegistro";
import { HistoricoDoRegistro } from "@/components/registro/HistoricoDoRegistro";
import { Badge } from "@/components/ui/Badge";
import { LinkDeVolta } from "@/components/ui/CabecalhoDaPagina";
import { Card, CardHeader } from "@/components/ui/Card";
import { EstadoVazio } from "@/components/ui/EstadoVazio";
import { MostrarMais } from "@/components/ui/MostrarMais";
import { BotaoMaisOpcoes, PainelDeOpcoes } from "@/components/ui/MaisOpcoes";
import { BotaoGrande } from "@/components/ui/BotaoGrande";
import {
  IconeAlerta,
  IconeBusca,
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
import { LinhaDeMovimento } from "./MaisInformacoes";
import { IconeArquivar, IconeContagem, IconeEditar } from "./Icones";
import { ModaisDoEstoque, type AcaoDoEstoque } from "./ModaisDoEstoque";
import { BarraDoNivel, SaldoEmDestaque, SeloDoNivel } from "./NivelDoEstoque";
import { NumeroGrande } from "./NumerosDoEstoque";
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

const ID_DAS_OPCOES = "opcoes-do-produto";

/** Rodapé "Mostrar mais" em letra maior (o componente comum é compacto). */
const RODAPE_GRANDE =
  "[&_footer]:px-4 [&_footer]:py-3.5 [&_footer]:text-base sm:[&_footer]:px-5 [&_footer_button]:px-4 [&_footer_button]:py-2.5 [&_footer_button]:text-base";

/**
 * Detalhe de um produto: cadastro, saldo, todos os movimentos (com o saldo
 * de cada momento), comentarios e historico de alteracoes.
 */
export function DetalheDoProduto({ produtoId }: { produtoId: string }) {
  const { banco, colaborador } = useApp();
  const gravar = useGravar();
  const [acao, setAcao] = useState<AcaoDoEstoque | null>(null);
  const [limite, setLimite] = useState(MOVIMENTOS_VISIVEIS);
  const [opcoesAbertas, setOpcoesAbertas] = useState(false);
  const detalhe = useMemo(() => detalheDoProduto(banco, produtoId, HOJE), [banco, produtoId]);

  if (!podeAcessar(banco, colaborador, "estoque")) return <SemAcessoAoEstoque />;

  if (!detalhe) {
    return (
      <EstadoVazio
        className="mx-auto max-w-lg"
        icone={<IconeBusca className="h-6 w-6" />}
        titulo="Produto não encontrado"
        tituloDaPagina
        acoes={
          <Link href="/estoque" className="btn-secundario">
            Voltar para o estoque
          </Link>
        }
      />
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

        {/* Cabeçalho: nome, saldo grande e as três ações do dia a dia; editar e inativar em "Mais opções". */}
        <section className="card p-4 sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge cor={categoria.cor} fundo={categoria.fundo} borda={categoria.borda} className="text-sm">
                  {produto.categoria}
                </Badge>
                {!produto.ativo && <Badge className="text-sm">Inativo · fora das listas de venda</Badge>}
              </div>
              <h1 className="mt-2 font-display text-4xl font-bold leading-tight text-areia-900">{produto.nome}</h1>
              <p className="mt-0.5 text-base text-areia-600">Vendido por {produto.unidade}</p>
              <p className="mt-3 text-base text-areia-700">
                Venda <strong className="font-semibold text-areia-900">{formatarMoeda(produto.precoVenda)}</strong>
                <span className="text-areia-600">
                  {" "}
                  · custo {formatarMoeda(produto.precoCusto)} · margem {formatarMoeda(margem)}
                  {produto.precoCusto > 0 && ` (${Math.round((margem / produto.precoCusto) * 100)}%)`}
                </span>
              </p>
              {vendaAbaixoDoCusto(produto.precoCusto, produto.precoVenda) && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900">
                  <IconeAlerta className="h-4 w-4" />
                  Venda abaixo do custo
                </p>
              )}
            </div>

            <div className="w-full shrink-0 rounded-xl border border-areia-200 bg-areia-50 p-4 lg:w-80">
              <div className="flex items-end justify-between gap-2">
                <SaldoEmDestaque
                  saldo={saldo}
                  estoqueMinimo={produto.estoqueMinimo}
                  nivel={nivel}
                  tamanho="lg"
                />
                {produto.ativo ? (
                  <SeloDoNivel nivel={nivel} className="shrink-0 text-sm" />
                ) : (
                  <Badge className="shrink-0 text-sm">Inativo</Badge>
                )}
              </div>
              <BarraDoNivel
                saldo={saldo}
                estoqueMinimo={produto.estoqueMinimo}
                nivel={nivel}
                className="mt-3"
              />
              <p className="mt-2 text-sm text-areia-600">
                Saldo = soma dos movimentos abaixo.
              </p>
            </div>
          </div>

          {/* No celular, os botões ficam em duas colunas; a entrada ocupa a linha toda. */}
          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-areia-200 pt-4 sm:flex sm:flex-wrap sm:items-center">
            {produto.ativo && (
              <button
                type="button"
                onClick={() => setAcao({ tipo: "entrada", produtoId: produto.id })}
                className="btn-primario col-span-2 px-5 py-3 text-base"
              >
                <IconeEntrada className="h-5 w-5" />
                Entrada de mercadoria
              </button>
            )}
            <button
              type="button"
              onClick={() => setAcao({ tipo: "perda", produtoId: produto.id })}
              disabled={saldo <= 0}
              className="btn-secundario px-5 py-3 text-base"
            >
              <IconeLixeira className="h-5 w-5" />
              Perda
            </button>
            <button
              type="button"
              onClick={() => setAcao({ tipo: "inventario", produtoId: produto.id })}
              className="btn-secundario px-5 py-3 text-base"
              title="Ajuste de inventário: informe quanto há na prateleira"
            >
              <IconeContagem className="h-5 w-5" />
              Contagem
            </button>
            {!produto.ativo && (
              <button
                type="button"
                onClick={async () => {
                  await gravar(
                    reativarProduto,
                    { id: produto.id },
                    `${produto.nome} voltou para o catálogo e para as listas de venda.`,
                  );
                }}
                className="btn-secundario col-span-2 px-5 py-3 text-base"
              >
                Reativar produto
              </button>
            )}
            <BotaoMaisOpcoes
              aberto={opcoesAbertas}
              aoAlternar={() => setOpcoesAbertas((atual) => !atual)}
              controla={ID_DAS_OPCOES}
              className="col-span-2 py-3 sm:ml-auto"
            />
          </div>

          {/* A grade fica num div de dentro: classe de display no painel venceria o `hidden`. */}
          <PainelDeOpcoes id={ID_DAS_OPCOES} aberto={opcoesAbertas}>
            <div className="mt-3 grid gap-3 rounded-xl border border-areia-200 bg-areia-50 p-3 sm:grid-cols-2 sm:p-4">
            <BotaoGrande
              icone={<IconeEditar className="h-6 w-6" />}
              titulo="Editar cadastro"
              descricao="Nome, categoria, unidade, preços e estoque mínimo."
              aoClicar={() => {
                setOpcoesAbertas(false);
                setAcao({ tipo: "editar", produtoId: produto.id });
              }}
            />
            {produto.ativo && (
              <BotaoGrande
                icone={<IconeArquivar className="h-6 w-6" />}
                titulo="Inativar"
                descricao="Sai do catálogo e das listas de venda; o histórico fica."
                aoClicar={() => {
                  setOpcoesAbertas(false);
                  setAcao({ tipo: "inativar", produtoId: produto.id });
                }}
              />
            )}
            </div>
          </PainelDeOpcoes>
        </section>

        {/* Indicadores */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <NumeroGrande
            rotulo="Vendidos em 30 dias"
            valor={String(vendidos30Dias.unidades)}
            detalhe={`${formatarMoeda(vendidos30Dias.total)} em consumo`}
            icone={<IconeSubiu className="h-6 w-6" />}
            tom="saibro"
          />
          <NumeroGrande
            rotulo="Valor em estoque"
            valor={formatarMoeda(Math.max(saldo, 0) * produto.precoVenda)}
            detalhe={`Custo ${formatarMoeda(Math.max(saldo, 0) * produto.precoCusto)}`}
            icone={<IconeFinanceiro className="h-6 w-6" />}
            tom="neutro"
          />
          <NumeroGrande
            rotulo="Última entrada"
            valor={ultimaEntrada ? formatarDiaMes(ultimaEntrada.data) : "—"}
            detalhe={
              ultimaEntrada
                ? `+${ultimaEntrada.quantidade} · ${ultimaEntrada.responsavel}`
                : "Nenhuma entrada registrada"
            }
            icone={<IconeEntrada className="h-6 w-6" />}
            tom="neutro"
          />
          <NumeroGrande
            rotulo="Perdas em 30 dias"
            valor={String(perdas30Dias)}
            detalhe={
              perdas30Dias > 0
                ? `${formatarMoeda(perdas30Dias * produto.precoCusto)} de custo perdido`
                : "Nenhuma perda"
            }
            icone={<IconeLixeira className="h-6 w-6" />}
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
                <li key={linha.movimento.id} className="px-4 py-3 sm:px-5">
                  <LinhaDeMovimento item={linha} mostrarProduto={false} saldoApos={linha.saldoApos} />
                  {linha.contaAPagar && (
                    <p className="mt-1 text-sm text-areia-600">
                      Conta a pagar: {formatarMoeda(linha.contaAPagar.valor)} para{" "}
                      {linha.contaAPagar.nomePagante} · vence{" "}
                      {formatarDiaMes(linha.contaAPagar.vencimento)}
                      {linha.contaAPagar.pagoEm && " · paga"}
                    </p>
                  )}
                </li>
              ))}
              {extrato.length === 0 && (
                <li className="px-5 py-8 text-center text-base text-areia-600">
                  Nenhum movimento ainda. Registre a primeira entrada de mercadoria.
                </li>
              )}
            </ul>
            <div className={RODAPE_GRANDE}>
              <MostrarMais
                mostrando={linhas.length}
                total={extrato.length}
                passo={MOVIMENTOS_VISIVEIS}
                aoMostrarMais={() => setLimite((atual) => atual + MOVIMENTOS_VISIVEIS)}
              />
            </div>
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

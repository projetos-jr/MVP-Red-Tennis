"use client";

import { useMemo, useState } from "react";
import { ModalConsumo } from "@/components/consumo/ModalConsumo";
import { CardProduto } from "@/components/estoque/CardProduto";
import { ListaDeCompras } from "@/components/estoque/ListaDeCompras";
import { MaisInformacoes } from "@/components/estoque/MaisInformacoes";
import { ModaisDoEstoque, type AcaoDoEstoque } from "@/components/estoque/ModaisDoEstoque";
import { ModalMovimentar } from "@/components/estoque/ModalMovimentar";
import { NumerosDoEstoque } from "@/components/estoque/NumerosDoEstoque";
import { SemAcessoAoEstoque } from "@/components/estoque/SemAcessoAoEstoque";
import { BotaoGrande } from "@/components/financeiro/BotaoGrande";
import { BotaoFiltro } from "@/components/ui/BotaoFiltro";
import { CabecalhoDaPagina } from "@/components/ui/CabecalhoDaPagina";
import { InterruptorBola } from "@/components/ui/InterruptorBola";
import { BotaoMaisOpcoes, PainelDeOpcoes } from "@/components/ui/MaisOpcoes";
import { IconeBusca, IconeCopo, IconeMais } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import { reativarProduto } from "@/lib/banco/operacoes/estoque";
import { podeAcessar } from "@/lib/consultas/base";
import {
  CATEGORIAS_PRODUTO,
  filtrarProdutos,
  listaDeCompras,
  maisVendidos,
  movimentacoesRecentes,
  produtoComSaldo,
  produtosComSaldo,
  resumoDoEstoque,
  type FiltroEstoque,
  type ProdutoComSaldo,
} from "@/lib/consultas/estoque";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";

const FILTRO_INICIAL: FiltroEstoque = {
  categoria: "todas",
  busca: "",
  apenasRepor: false,
  incluirInativos: false,
};

const ID_DAS_OPCOES = "opcoes-do-estoque";

/** Pílulas de categoria grandes (o BotaoFiltro comum é compacto). */
const CATEGORIAS_GRANDES =
  "[&>button]:px-4 [&>button]:py-2 [&>button]:text-base [&>button]:font-semibold";

export default function PaginaEstoque() {
  const { banco, colaborador } = useApp();
  const gravar = useGravar();
  const [filtro, setFiltro] = useState<FiltroEstoque>(FILTRO_INICIAL);
  const [acao, setAcao] = useState<AcaoDoEstoque | null>(null);
  const [movimentando, setMovimentando] = useState<string | null>(null);
  const [lancandoConsumo, setLancandoConsumo] = useState(false);
  const [opcoesAbertas, setOpcoesAbertas] = useState(false);

  // O saldo de cada produto e a soma dos movimentos: calculado uma vez por gravacao.
  const produtos = useMemo(() => produtosComSaldo(banco), [banco]);
  const resumo = useMemo(() => resumoDoEstoque(banco, produtos, HOJE), [banco, produtos]);
  const lista = useMemo(() => filtrarProdutos(produtos, filtro), [produtos, filtro]);
  const compras = useMemo(() => listaDeCompras(produtos), [produtos]);
  const campeoes = useMemo(() => maisVendidos(banco, HOJE), [banco]);
  const recentes = useMemo(() => movimentacoesRecentes(banco), [banco]);
  // Relido do banco: a janela "Movimentar" mostra sempre o saldo de agora.
  const itemMovimentando = movimentando ? produtoComSaldo(banco, movimentando) : undefined;

  if (!podeAcessar(banco, colaborador, "estoque")) return <SemAcessoAoEstoque />;

  function mudarFiltro(parcial: Partial<FiltroEstoque>) {
    setFiltro((atual) => ({ ...atual, ...parcial }));
  }

  async function reativar(item: ProdutoComSaldo) {
    await gravar(
      reativarProduto,
      { id: item.produto.id },
      `${item.produto.nome} voltou para o catálogo e para as listas de venda.`,
    );
  }

  const opcoesLigadas = [filtro.apenasRepor, filtro.incluirInativos].filter(Boolean).length;
  const descricaoDasOpcoes = [
    filtro.apenasRepor ? "só o que precisa repor" : "",
    filtro.incluirInativos ? "com os inativos" : "",
  ].filter(Boolean);

  return (
    <>
      <div className="space-y-6">
        <CabecalhoDaPagina
          titulo="Estoque"
          descricao={
            <span className="text-base">
              Bebidas, cervejas, lanches e acessórios vendidos no balcão da arena.
            </span>
          }
          acoes={
            <button
              type="button"
              onClick={() => setLancandoConsumo(true)}
              className="btn-primario px-5 py-3 text-base"
            >
              <IconeCopo className="h-5 w-5" />
              Lançar consumo
            </button>
          }
        />

        <NumerosDoEstoque resumo={resumo} />

        <ListaDeCompras
          itens={compras}
          aoDarEntrada={(item) =>
            setAcao({
              tipo: "entrada",
              produtoId: item.produto.id,
              quantidadeSugerida: item.sugerido,
            })
          }
        />

        {/* Catálogo */}
        <section className="card" aria-labelledby="titulo-produtos">
          <header className="space-y-3 border-b border-areia-200 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="titulo-produtos" className="font-display text-2xl font-bold text-areia-900">
                Produtos
              </h2>
              <p className="text-base text-areia-600">
                Toque num produto para dar entrada, perda ou contagem.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <IconeBusca className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-areia-500" />
                <input
                  type="search"
                  value={filtro.busca}
                  onChange={(e) => mudarFiltro({ busca: e.target.value })}
                  placeholder="Buscar produto…"
                  aria-label="Buscar produto"
                  className="campo py-3 pl-11 text-base"
                />
              </div>
              <BotaoMaisOpcoes
                aberto={opcoesAbertas}
                aoAlternar={() => setOpcoesAbertas((atual) => !atual)}
                controla={ID_DAS_OPCOES}
                contagem={opcoesLigadas}
                className="py-3 text-base"
              />
            </div>

            <div
              className={`flex flex-wrap items-center gap-2 ${CATEGORIAS_GRANDES}`}
              role="group"
              aria-label="Categoria"
            >
              {(["todas", ...CATEGORIAS_PRODUTO] as const).map((c) => (
                <BotaoFiltro
                  key={c}
                  ativo={filtro.categoria === c}
                  aoClicar={() => mudarFiltro({ categoria: c })}
                >
                  {c === "todas" ? "Todas" : c}
                </BotaoFiltro>
              ))}
            </div>

            {!opcoesAbertas && descricaoDasOpcoes.length > 0 && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-areia-700">
                <span>
                  Mostrando:{" "}
                  <strong className="font-semibold text-areia-900">{descricaoDasOpcoes.join(" · ")}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => mudarFiltro({ apenasRepor: false, incluirInativos: false })}
                  className="link-acao alvo-de-toque"
                >
                  Voltar ao normal
                </button>
              </p>
            )}

            {/* O layout fica num div de dentro: classe de display no painel venceria o `hidden`. */}
            <PainelDeOpcoes id={ID_DAS_OPCOES} aberto={opcoesAbertas}>
              <div className="flex flex-col gap-3 rounded-xl border border-areia-200 bg-areia-50 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <InterruptorBola
                  ligado={filtro.apenasRepor}
                  aoMudar={(apenasRepor) => mudarFiltro({ apenasRepor })}
                  rotulo="Só o que precisa repor"
                  className="text-base"
                />
                <InterruptorBola
                  ligado={filtro.incluirInativos}
                  aoMudar={(incluirInativos) => mudarFiltro({ incluirInativos })}
                  rotulo={`Mostrar inativos${resumo.produtosInativos > 0 ? ` (${resumo.produtosInativos})` : ""}`}
                  className="text-base"
                />
              </div>
              <BotaoGrande
                icone={<IconeMais className="h-6 w-6" />}
                titulo="Novo produto"
                descricao="Cadastrar um produto que a arena passou a vender."
                aoClicar={() => {
                  setOpcoesAbertas(false);
                  setAcao({
                    tipo: "novo",
                    categoria: filtro.categoria === "todas" ? undefined : filtro.categoria,
                  });
                }}
                className="lg:w-auto"
              />
              </div>
            </PainelDeOpcoes>
          </header>

          <div className="grid gap-4 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-4">
            {lista.map((item) => (
              <CardProduto
                key={item.produto.id}
                item={item}
                aoMovimentar={(escolhido) => setMovimentando(escolhido.produto.id)}
                aoReativar={reativar}
              />
            ))}

            {lista.length === 0 && (
              <p className="col-span-full py-10 text-center text-base text-areia-600">
                Nenhum produto encontrado com os filtros atuais.
              </p>
            )}
          </div>
        </section>

        <MaisInformacoes maisVendidos={campeoes} movimentacoes={recentes} />
      </div>

      {/* Fora do space-y-6: a margem entre filhos deslocaria o fundo fixo do modal. */}
      {itemMovimentando && (
        <ModalMovimentar
          key={itemMovimentando.produto.id}
          item={itemMovimentando}
          aoFechar={() => setMovimentando(null)}
          aoEscolher={(tipo) => {
            setMovimentando(null);
            setAcao({ tipo, produtoId: itemMovimentando.produto.id });
          }}
        />
      )}
      <ModaisDoEstoque acao={acao} aoFechar={() => setAcao(null)} />
      {lancandoConsumo && <ModalConsumo aoFechar={() => setLancandoConsumo(false)} />}
    </>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { DetalheDoLancamento } from "@/components/financeiro/DetalheDoLancamento";
import {
  FILTROS_INICIAIS,
  FiltrosDaLista,
  filtrosDoIndicador,
  montarFiltro,
  mesmosFiltros,
  type FiltrosDaTela,
} from "@/components/financeiro/FiltrosDaLista";
import { IndicadoresDoMes } from "@/components/financeiro/IndicadoresDoMes";
import {
  LANCAMENTOS_POR_PAGINA,
  ListaDeLancamentos,
} from "@/components/financeiro/ListaDeLancamentos";
import { ModalAnular } from "@/components/financeiro/ModalAnular";
import { ModalFecharRepasse } from "@/components/financeiro/ModalFecharRepasse";
import { ModalGerarMensalidades } from "@/components/financeiro/ModalGerarMensalidades";
import { ModalNovoLancamento } from "@/components/financeiro/ModalNovoLancamento";
import { ModalPagamento } from "@/components/financeiro/ModalPagamento";
import { RecebidoPorForma } from "@/components/financeiro/RecebidoPorForma";
import { RelatorioProfessores } from "@/components/financeiro/RelatorioProfessores";
import { ReservasSemPagamento } from "@/components/financeiro/ReservasSemPagamento";
import { baixarArquivo } from "@/components/financeiro/utilitarios";
import { useAvisos } from "@/components/ui/Avisos";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  IconeAnterior,
  IconeCadeado,
  IconeExportar,
  IconeFinanceiro,
  IconeMais,
  IconeNota,
  IconeProximo,
} from "@/components/ui/Icons";
import { Segmentado } from "@/components/ui/Segmentado";
import { HOJE } from "@/lib/banco/constantes";
import type { TipoLancamento } from "@/lib/banco/tipos";
import { podeAcessar } from "@/lib/consultas/base";
import {
  competenciaValida,
  filtroDoIndicador,
  gerarCsv,
  indicadoresDoMes,
  listarLancamentos,
  mesTerminado,
  nomeDoMes,
  recebidoPorForma,
  relatorioDeProfessores,
  reservasAguardandoPagamento,
  somarMesesNaCompetencia,
  type ChaveIndicador,
  type SituacaoNoFiltro,
} from "@/lib/consultas/financeiro";
import { useApp } from "@/store/AppStore";

type Aba = "receber" | "pagar" | "professores";

/** No máximo um modal por vez: abrir "Registrar pagamento" no detalhe troca o modal. */
type ModalAberto =
  | { tipo: "detalhe"; id: string }
  | { tipo: "pagamento"; id: string; voltarAoDetalhe: boolean }
  | { tipo: "anular"; id: string; voltarAoDetalhe: boolean }
  | { tipo: "novo" }
  | { tipo: "gerar" }
  | { tipo: "fechar" }
  | null;

const MES_ATUAL = HOJE.slice(0, 7);
const INDICADORES: ChaveIndicador[] = ["recebido", "aReceber", "emAtraso", "aPagar"];
const SITUACOES_DA_URL: SituacaoNoFiltro[] = ["em_aberto", "pendente", "em_atraso", "pago", "cancelado"];
const ID_DA_LISTA = "lista-de-lancamentos";

function rolarAteALista() {
  window.requestAnimationFrame(() =>
    document.getElementById(ID_DA_LISTA)?.scrollIntoView({ behavior: "smooth", block: "start" }),
  );
}

export default function PaginaFinanceiro() {
  // A tela lê a URL (?aba=, ?situacao=, ?mes=, ?lancamento=), então fica
  // dentro de Suspense, como o Next pede para quem usa useSearchParams.
  return (
    <Suspense fallback={null}>
      <TelaFinanceiro />
    </Suspense>
  );
}

function TelaFinanceiro() {
  const { banco, colaborador } = useApp();
  const { avisar } = useAvisos();
  const parametros = useSearchParams();

  // H9: a recepção vê só as contas a receber; o professor não vê o financeiro.
  const podeVer = podeAcessar(banco, colaborador, "financeiro");
  const podePagar = podeAcessar(banco, colaborador, "financeiro_pagar");

  const [mes, setMes] = useState(() => {
    const daUrl = parametros.get("mes") ?? undefined;
    return competenciaValida(daUrl) ? daUrl : MES_ATUAL;
  });
  const [aba, setAba] = useState<Aba>(() => {
    const daUrl = parametros.get("aba");
    return daUrl === "pagar" || daUrl === "professores" ? daUrl : "receber";
  });
  const [filtros, setFiltros] = useState<Record<TipoLancamento, FiltrosDaTela>>(() => {
    const situacao = parametros.get("situacao") as SituacaoNoFiltro | null;
    const inicial: FiltrosDaTela =
      situacao && SITUACOES_DA_URL.includes(situacao)
        ? { ...FILTROS_INICIAIS, situacao, periodo: situacao === "em_atraso" ? "todos" : "mes" }
        : FILTROS_INICIAIS;
    return { receber: inicial, pagar: inicial };
  });
  const [limite, setLimite] = useState(LANCAMENTOS_POR_PAGINA);
  const [modal, setModal] = useState<ModalAberto>(() => {
    const id = parametros.get("lancamento");
    return id ? { tipo: "detalhe", id } : null;
  });

  const abaVisivel: Aba = podePagar ? aba : "receber";
  const tipoDaLista: TipoLancamento = abaVisivel === "pagar" ? "pagar" : "receber";
  const filtrosDaLista = filtros[tipoDaLista];

  const indicadores = useMemo(() => indicadoresDoMes(banco, mes, HOJE), [banco, mes]);
  const linhas = useMemo(
    () => listarLancamentos(banco, montarFiltro(tipoDaLista, filtrosDaLista, mes), HOJE),
    [banco, tipoDaLista, filtrosDaLista, mes],
  );
  const reservas = useMemo(() => reservasAguardandoPagamento(banco, HOJE), [banco]);
  const porForma = useMemo(() => recebidoPorForma(banco, mes, HOJE), [banco, mes]);
  const relatorio = useMemo(
    () => (abaVisivel === "professores" ? relatorioDeProfessores(banco, mes, HOJE) : null),
    [banco, mes, abaVisivel],
  );
  const mesAnteriorAFechar = useMemo(
    () =>
      abaVisivel === "professores" && !mesTerminado(mes, HOJE)
        ? relatorioDeProfessores(banco, somarMesesNaCompetencia(mes, -1), HOJE).aFechar.length
        : 0,
    [banco, mes, abaVisivel],
  );

  if (!podeVer) {
    return (
      <Card className="mx-auto max-w-lg px-6 py-10 text-center">
        <IconeCadeado className="mx-auto h-8 w-8 text-areia-400" />
        <h1 className="mt-3 text-lg font-semibold text-areia-900">Sem acesso ao financeiro</h1>
        <p className="mt-1 text-sm text-areia-600">
          O seu perfil não enxerga esta área (hipótese H9). Fale com o dono da arena.
        </p>
      </Card>
    );
  }

  // Indicador cujo filtro está aplicado na lista (fica destacado).
  const indicadorAtivo =
    abaVisivel === "professores"
      ? undefined
      : INDICADORES.find((chave) => {
          const filtro = filtroDoIndicador(chave, mes);
          return (
            filtro.tipo === tipoDaLista &&
            mesmosFiltros(filtrosDoIndicador(filtro, filtrosDaLista.ordem), filtrosDaLista)
          );
        });

  function mudarFiltros(parcial: Partial<FiltrosDaTela>) {
    setFiltros((atual) => ({ ...atual, [tipoDaLista]: { ...atual[tipoDaLista], ...parcial } }));
    setLimite(LANCAMENTOS_POR_PAGINA);
  }

  function limparFiltros() {
    setFiltros((atual) => ({
      ...atual,
      [tipoDaLista]: { ...FILTROS_INICIAIS, ordem: atual[tipoDaLista].ordem },
    }));
    setLimite(LANCAMENTOS_POR_PAGINA);
  }

  /** Clique num indicador: a lista passa a mostrar exatamente o que ele soma. */
  function mostrarIndicador(chave: ChaveIndicador) {
    const filtro = filtroDoIndicador(chave, mes);
    setAba(filtro.tipo);
    setFiltros((atual) => ({
      ...atual,
      [filtro.tipo]: filtrosDoIndicador(filtro, atual[filtro.tipo].ordem),
    }));
    setLimite(LANCAMENTOS_POR_PAGINA);
    rolarAteALista();
  }

  function trocarMes(novo: string) {
    setMes(novo);
    setLimite(LANCAMENTOS_POR_PAGINA);
  }

  function trocarAba(nova: Aba) {
    setAba(nova);
    setLimite(LANCAMENTOS_POR_PAGINA);
  }

  function exportar() {
    if (linhas.length === 0) {
      avisar("info", "Não há lançamentos para exportar com estes filtros.");
      return;
    }
    const periodo =
      filtrosDaLista.periodo === "todos"
        ? "todos-os-meses"
        : filtrosDaLista.periodo === "ate"
          ? `ate-${mes}`
          : mes;
    const nome = `financeiro-${tipoDaLista === "receber" ? "a-receber" : "a-pagar"}-${periodo}.csv`;
    baixarArquivo(nome, gerarCsv(linhas), "text/csv;charset=utf-8");
    avisar(
      "sucesso",
      `Planilha baixada com ${linhas.length} ${linhas.length === 1 ? "lançamento" : "lançamentos"}.`,
    );
  }

  function verMensalidadesNaLista(competencia: string) {
    setModal(null);
    setMes(competencia);
    setAba("receber");
    setFiltros((atual) => ({
      ...atual,
      receber: { ...FILTROS_INICIAIS, ordem: atual.receber.ordem, categoria: "Mensalidade" },
    }));
    setLimite(LANCAMENTOS_POR_PAGINA);
    rolarAteALista();
  }

  const abrirDetalhe = (id: string) => setModal({ tipo: "detalhe", id });
  const abrirPagamento = (id: string) => setModal({ tipo: "pagamento", id, voltarAoDetalhe: false });

  return (
    <div className="space-y-6">
      {/* Cabeçalho: título, mês de referência e ações */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-areia-900 sm:text-3xl">Financeiro</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => trocarMes(somarMesesNaCompetencia(mes, -1))}
              className="btn-fantasma px-2 py-1.5"
              aria-label="Mês anterior"
            >
              <IconeAnterior className="h-4 w-4" />
            </button>
            <p
              className="inline-block min-w-[150px] text-center text-sm font-semibold text-areia-800 first-letter:uppercase"
              aria-live="polite"
            >
              {nomeDoMes(mes)}
            </p>
            <button
              type="button"
              onClick={() => trocarMes(somarMesesNaCompetencia(mes, 1))}
              className="btn-fantasma px-2 py-1.5"
              aria-label="Próximo mês"
            >
              <IconeProximo className="h-4 w-4" />
            </button>
            {mes !== MES_ATUAL && (
              <button
                type="button"
                onClick={() => trocarMes(MES_ATUAL)}
                className="btn-fantasma px-2.5 py-1.5 text-xs"
              >
                Voltar ao mês atual
              </button>
            )}
          </div>
        </div>

        {/* No celular os botões ficam um embaixo do outro, o principal em cima. */}
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setModal({ tipo: "gerar" })}
            className="btn-secundario"
          >
            <IconeNota className="h-4 w-4" />
            Gerar mensalidades
          </button>
          <button
            type="button"
            onClick={() => setModal({ tipo: "novo" })}
            className="btn-primario"
          >
            <IconeMais className="h-4 w-4" />
            Novo lançamento
          </button>
        </div>
      </div>

      <IndicadoresDoMes
        indicadores={indicadores}
        mes={mes}
        mostrarAPagar={podePagar}
        ativo={indicadorAtivo}
        aoEscolher={mostrarIndicador}
      />

      {podePagar && (
        <Segmentado
          aria="Área do financeiro"
          valor={abaVisivel}
          aoMudar={trocarAba}
          opcoes={[
            { valor: "receber", rotulo: "A receber" },
            { valor: "pagar", rotulo: "A pagar" },
            { valor: "professores", rotulo: "Professores" },
          ]}
        />
      )}

      {abaVisivel === "professores" && relatorio ? (
        <RelatorioProfessores
          relatorio={relatorio}
          mesAnteriorAFechar={mesAnteriorAFechar}
          aoFecharMes={() => setModal({ tipo: "fechar" })}
          aoVerMesAnterior={() => trocarMes(somarMesesNaCompetencia(mes, -1))}
        />
      ) : (
        <>
          {abaVisivel === "receber" && (
            <ReservasSemPagamento reservas={reservas} aoPagar={abrirPagamento} aoAbrir={abrirDetalhe} />
          )}

          <div id={ID_DA_LISTA} className="scroll-mt-36">
            <Card>
              <CardHeader
                titulo={tipoDaLista === "receber" ? "Contas a receber" : "Contas a pagar"}
                descricao={
                  tipoDaLista === "receber"
                    ? "Mensalidades, aulas avulsas, locações, consumo do balcão e torneios."
                    : "Despesas da arena, fornecedores e repasses dos professores."
                }
                icone={<IconeFinanceiro className="h-5 w-5" />}
                acao={
                  <button type="button" onClick={exportar} className="btn-secundario py-2">
                    <IconeExportar className="h-4 w-4" />
                    Exportar planilha
                  </button>
                }
              />
              <FiltrosDaLista
                tipo={tipoDaLista}
                filtros={filtrosDaLista}
                mes={mes}
                formas={banco.configuracoes.formasPagamento}
                aoMudar={mudarFiltros}
                aoLimpar={limparFiltros}
              />
              <ListaDeLancamentos
                tipo={tipoDaLista}
                linhas={linhas}
                limite={limite}
                ordem={filtrosDaLista.ordem}
                aoAlternarOrdem={() =>
                  mudarFiltros({
                    ordem: filtrosDaLista.ordem === "vencimento_desc" ? "vencimento_asc" : "vencimento_desc",
                  })
                }
                aoMostrarMais={() => setLimite((atual) => atual + LANCAMENTOS_POR_PAGINA)}
                aoAbrir={abrirDetalhe}
                aoPagar={abrirPagamento}
              />
            </Card>
          </div>

          {abaVisivel === "receber" && <RecebidoPorForma dados={porForma} mes={mes} />}
        </>
      )}

      {modal?.tipo === "detalhe" && (
        <DetalheDoLancamento
          key={modal.id}
          id={modal.id}
          aoFechar={() => setModal(null)}
          aoPagar={(id) => setModal({ tipo: "pagamento", id, voltarAoDetalhe: true })}
          aoAnular={(id) => setModal({ tipo: "anular", id, voltarAoDetalhe: true })}
        />
      )}
      {modal?.tipo === "pagamento" && (
        <ModalPagamento
          key={modal.id}
          id={modal.id}
          aoFechar={() => setModal(modal.voltarAoDetalhe ? { tipo: "detalhe", id: modal.id } : null)}
          aoConcluir={() => setModal(modal.voltarAoDetalhe ? { tipo: "detalhe", id: modal.id } : null)}
        />
      )}
      {modal?.tipo === "anular" && (
        <ModalAnular
          key={modal.id}
          id={modal.id}
          aoFechar={() => setModal(modal.voltarAoDetalhe ? { tipo: "detalhe", id: modal.id } : null)}
          aoConcluir={() => setModal(modal.voltarAoDetalhe ? { tipo: "detalhe", id: modal.id } : null)}
        />
      )}
      {modal?.tipo === "novo" && (
        <ModalNovoLancamento
          tipoInicial={tipoDaLista}
          podePagar={podePagar}
          aoFechar={() => setModal(null)}
          aoConcluir={(tipo) => {
            setModal(null);
            trocarAba(tipo);
          }}
        />
      )}
      {modal?.tipo === "gerar" && (
        <ModalGerarMensalidades aoFechar={() => setModal(null)} aoVerNaLista={verMensalidadesNaLista} />
      )}
      {modal?.tipo === "fechar" && relatorio && (
        <ModalFecharRepasse
          relatorio={relatorio}
          aoFechar={() => setModal(null)}
          aoConcluir={() => setModal(null)}
        />
      )}
    </div>
  );
}

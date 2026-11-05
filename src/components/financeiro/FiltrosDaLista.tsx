"use client";

import { useState, type ReactNode } from "react";
import { IconeBusca } from "@/components/ui/Icons";
import { BotaoMaisOpcoes, PainelDeOpcoes } from "@/components/ui/MaisOpcoes";
import type { CategoriaLancamento, TipoLancamento } from "@/lib/banco/tipos";
import {
  categoriasDoTipo,
  nomeDoMes,
  type FiltroLancamentos,
  type OrdemDaLista,
  type SituacaoNoFiltro,
} from "@/lib/consultas/financeiro";

/** Filtros da lista como a tela guarda (um conjunto por aba). */
export interface FiltrosDaTela {
  busca: string;
  situacao: SituacaoNoFiltro;
  categoria: CategoriaLancamento | "todas";
  /** "todas", "sem_forma" ou o nome da forma. */
  forma: string;
  /** Só o mês escolhido, até o fim dele (inclui atrasados) ou todos os meses. */
  periodo: "mes" | "ate" | "todos";
  ordem: OrdemDaLista;
}

export const FILTROS_INICIAIS: FiltrosDaTela = {
  busca: "",
  situacao: "todas",
  categoria: "todas",
  forma: "todas",
  periodo: "mes",
  ordem: "vencimento_desc",
};

/** Traduz os filtros da tela para o filtro da consulta. */
export function montarFiltro(
  tipo: TipoLancamento,
  filtros: FiltrosDaTela,
  mes: string,
): FiltroLancamentos {
  return {
    tipo,
    busca: filtros.busca,
    situacao: filtros.situacao,
    categoria: filtros.categoria,
    forma: filtros.forma,
    mes: filtros.periodo === "mes" ? mes : "todos",
    ateMes: filtros.periodo === "ate" ? mes : undefined,
    ordem: filtros.ordem,
  };
}

/** Os filtros da tela a partir do filtro de um indicador (clique no cartão). */
export function filtrosDoIndicador(filtro: FiltroLancamentos, ordem: OrdemDaLista): FiltrosDaTela {
  return {
    ...FILTROS_INICIAIS,
    ordem,
    situacao: filtro.situacao ?? "todas",
    periodo: filtro.ateMes ? "ate" : filtro.mes === "todos" ? "todos" : "mes",
  };
}

/** Mesmo recorte (a ordem não conta): serve para destacar o indicador em uso. */
export function mesmosFiltros(a: FiltrosDaTela, b: FiltrosDaTela): boolean {
  return (
    a.busca.trim() === b.busca.trim() &&
    a.situacao === b.situacao &&
    a.categoria === b.categoria &&
    a.forma === b.forma &&
    a.periodo === b.periodo
  );
}

export function filtrosLimpos(filtros: FiltrosDaTela): boolean {
  return (
    !filtros.busca.trim() &&
    filtros.situacao === FILTROS_INICIAIS.situacao &&
    filtros.categoria === FILTROS_INICIAIS.categoria &&
    filtros.forma === FILTROS_INICIAIS.forma &&
    filtros.periodo === FILTROS_INICIAIS.periodo
  );
}

const SITUACOES: Array<{ valor: SituacaoNoFiltro; rotulo: string }> = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "em_aberto", rotulo: "Em aberto" },
  { valor: "pendente", rotulo: "Pendentes" },
  { valor: "em_atraso", rotulo: "Em atraso" },
  { valor: "pago", rotulo: "Pagos" },
  { valor: "cancelado", rotulo: "Anulados" },
];

/** Quantos filtros guardados em "Mais filtros" estão ligados (a busca fica à vista e não conta). */
export function contarFiltrosAtivos(filtros: FiltrosDaTela): number {
  return [
    filtros.situacao !== FILTROS_INICIAIS.situacao,
    filtros.categoria !== FILTROS_INICIAIS.categoria,
    filtros.forma !== FILTROS_INICIAIS.forma,
    filtros.periodo !== FILTROS_INICIAIS.periodo,
  ].filter(Boolean).length;
}

/** Os filtros ligados em palavras ("Em atraso", "Todos os meses"), para ver sem abrir o painel. */
export function descreverFiltrosAtivos(filtros: FiltrosDaTela, mes: string): string[] {
  const mesSemAno = nomeDoMes(mes).split(" de ")[0];
  const partes: string[] = [];
  if (filtros.situacao !== FILTROS_INICIAIS.situacao) {
    partes.push(SITUACOES.find((s) => s.valor === filtros.situacao)?.rotulo ?? filtros.situacao);
  }
  if (filtros.categoria !== FILTROS_INICIAIS.categoria) partes.push(filtros.categoria);
  if (filtros.forma !== FILTROS_INICIAIS.forma) {
    partes.push(filtros.forma === "sem_forma" ? "Forma não informada" : filtros.forma);
  }
  if (filtros.periodo === "ate") partes.push(`Até ${mesSemAno}`);
  if (filtros.periodo === "todos") partes.push("Todos os meses");
  return partes;
}

function Seletor({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm font-semibold text-areia-700">{rotulo}</span>
      {children}
    </label>
  );
}

const ID_DO_PAINEL = "filtros-do-financeiro";

/**
 * Busca grande à vista; Situação, Categoria, Forma e Período guardados em
 * "Mais filtros" (o botão mostra quantos estão ligados). Com o painel
 * fechado, os filtros ligados aparecem escritos embaixo da busca, com
 * "Limpar filtros": clicar num cartão do topo liga filtros, e a pessoa
 * precisa ver o que está valendo.
 */
export function FiltrosDaLista({
  tipo,
  filtros,
  mes,
  formas,
  aoMudar,
  aoLimpar,
}: {
  tipo: TipoLancamento;
  filtros: FiltrosDaTela;
  mes: string;
  formas: string[];
  aoMudar: (parcial: Partial<FiltrosDaTela>) => void;
  aoLimpar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const nome = nomeDoMes(mes);
  // Nas opções do período vai só o nome do mês: o ano já está no topo da tela.
  const mesSemAno = nome.split(" de ")[0];
  const buscandoSoNoMes = Boolean(filtros.busca.trim()) && filtros.periodo === "mes";
  const ativos = contarFiltrosAtivos(filtros);
  const descricao = descreverFiltrosAtivos(filtros, mes);

  return (
    <div className="space-y-3 border-b border-areia-200 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <IconeBusca className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-areia-500" />
          <input
            type="search"
            value={filtros.busca}
            onChange={(e) => aoMudar({ busca: e.target.value })}
            aria-label={
              tipo === "receber"
                ? "Buscar por aluno, quem pagou ou item"
                : "Buscar por favorecido ou item"
            }
            placeholder={
              tipo === "receber"
                ? "Buscar nome ou item…"
                : "Buscar favorecido ou item…"
            }
            className="campo py-3 pl-11 text-base"
          />
        </div>
        <BotaoMaisOpcoes
          aberto={aberto}
          aoAlternar={() => setAberto((atual) => !atual)}
          controla={ID_DO_PAINEL}
          rotulo="Mais filtros"
          rotuloAberto="Menos filtros"
          contagem={ativos}
          className="py-3 text-base"
        />
      </div>

      {buscandoSoNoMes && (
        <p className="text-sm text-areia-600">
          A busca olha só {nome}.{" "}
          <button
            type="button"
            onClick={() => aoMudar({ periodo: "todos" })}
            className="link-acao alvo-de-toque"
          >
            Buscar em todos os meses
          </button>
        </p>
      )}

      {!aberto && descricao.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-areia-700">
          <span>
            Mostrando: <strong className="font-semibold text-areia-900">{descricao.join(" · ")}</strong>
          </span>
          <button type="button" onClick={aoLimpar} className="link-acao alvo-de-toque">
            Limpar filtros
          </button>
        </p>
      )}

      <PainelDeOpcoes
        id={ID_DO_PAINEL}
        aberto={aberto}
        rotulo="Mais filtros"
        className="space-y-2.5 rounded-xl border border-areia-200 bg-areia-50 p-3 sm:p-4"
      >
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
          <Seletor rotulo="Situação">
            <select
              value={filtros.situacao}
              onChange={(e) => aoMudar({ situacao: e.target.value as SituacaoNoFiltro })}
              className="campo text-base"
            >
              {SITUACOES.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </select>
          </Seletor>
          <Seletor rotulo="Categoria">
            <select
              value={filtros.categoria}
              onChange={(e) =>
                aoMudar({ categoria: e.target.value as CategoriaLancamento | "todas" })
              }
              className="campo text-base"
            >
              <option value="todas">Todas</option>
              {categoriasDoTipo(tipo).map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </Seletor>
          <Seletor rotulo="Forma de pagamento">
            <select
              value={filtros.forma}
              onChange={(e) => aoMudar({ forma: e.target.value })}
              className="campo text-base"
            >
              <option value="todas">Todas</option>
              {formas.map((forma) => (
                <option key={forma} value={forma}>
                  {forma}
                </option>
              ))}
              <option value="sem_forma">Não informada</option>
            </select>
          </Seletor>
          <Seletor rotulo="Período">
            <select
              value={filtros.periodo}
              onChange={(e) => aoMudar({ periodo: e.target.value as FiltrosDaTela["periodo"] })}
              className="campo text-base"
            >
              <option value="mes">Só {mesSemAno}</option>
              <option value="ate">Até {mesSemAno}</option>
              <option value="todos">Todos os meses</option>
            </select>
          </Seletor>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-areia-600">
          <span>
            No período, vale a data do pagamento; o que ainda não foi pago entra pelo vencimento.
          </span>
          {!filtrosLimpos(filtros) && (
            <button type="button" onClick={aoLimpar} className="link-acao alvo-de-toque">
              Limpar filtros
            </button>
          )}
        </div>
      </PainelDeOpcoes>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { IconeBusca } from "@/components/ui/Icons";
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

function Seletor({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-areia-500">{rotulo}</span>
      {children}
    </label>
  );
}

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
  const nome = nomeDoMes(mes);
  // Nas opções do período vai só o nome do mês: o ano já está no topo da tela.
  const mesSemAno = nome.split(" de ")[0];
  const buscandoSoNoMes = Boolean(filtros.busca.trim()) && filtros.periodo === "mes";

  return (
    <div className="space-y-2.5 border-b border-areia-200 px-4 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <label className="relative block min-w-0 xl:flex-1">
          <span className="mb-1 block text-xs font-medium text-areia-500">Busca</span>
          <IconeBusca className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-areia-400" />
          <input
            type="search"
            value={filtros.busca}
            onChange={(e) => aoMudar({ busca: e.target.value })}
            placeholder={
              tipo === "receber"
                ? "Aluno, quem pagou ou item…"
                : "Favorecido ou item…"
            }
            className="campo py-2 pl-9"
          />
        </label>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[700px] xl:shrink-0">
          <Seletor rotulo="Situação">
            <select
              value={filtros.situacao}
              onChange={(e) => aoMudar({ situacao: e.target.value as SituacaoNoFiltro })}
              className="campo py-2"
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
              className="campo py-2"
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
              className="campo py-2"
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
              className="campo py-2"
            >
              <option value="mes">Só {mesSemAno}</option>
              <option value="ate">Até {mesSemAno}</option>
              <option value="todos">Todos os meses</option>
            </select>
          </Seletor>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-areia-500">
        {buscandoSoNoMes ? (
          <span className="text-areia-600">
            A busca olha só {nome}.{" "}
            <button
              type="button"
              onClick={() => aoMudar({ periodo: "todos" })}
              className="font-semibold text-tijolo-700 underline-offset-2 hover:underline"
            >
              Buscar em todos os meses
            </button>
          </span>
        ) : (
          <span>
            No período, vale a data do pagamento; o que ainda não foi pago entra pelo vencimento.
          </span>
        )}
        {!filtrosLimpos(filtros) && (
          <button
            type="button"
            onClick={aoLimpar}
            className="font-semibold text-areia-700 underline-offset-2 hover:text-areia-900 hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}

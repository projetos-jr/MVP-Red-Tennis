"use client";

import { useState, type ReactNode } from "react";
import { IconeFiltro } from "@/components/ui/Icons";
import type { Professor, Quadra, TipoOcupacao } from "@/lib/banco/tipos";
import type { FiltroAgenda } from "@/lib/consultas/agenda";
import { ORDEM_TIPOS_AGENDA } from "./estilos";
import { Legenda } from "./Legenda";

/**
 * Filtros da agenda (quadra, professor, tipo, canceladas). No computador
 * ficam sempre abertos; no celular, recolhidos atras de um botao, junto com
 * a legenda. Sao os mesmos controles nos dois tamanhos.
 */
export function FiltrosDaAgenda({
  filtro,
  aoMudar,
  quadras,
  professores,
  professorTravado,
}: {
  filtro: FiltroAgenda;
  aoMudar: (parcial: Partial<FiltroAgenda>) => void;
  quadras: Quadra[];
  professores: Professor[];
  /** Perfil de professor: ve so as proprias aulas (Hipotese H9). */
  professorTravado?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ativos =
    Number(filtro.quadraId !== "todas") +
    Number(filtro.professorId !== "todos" && !professorTravado) +
    Number(filtro.tipo !== "todos") +
    Number(!filtro.mostrarCanceladas);

  return (
    <div className="border-b border-areia-200">
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-areia-700 md:hidden"
      >
        <IconeFiltro className="h-4 w-4" />
        Filtros e legenda
        {ativos > 0 && (
          <span className="rounded-full bg-saibro-600 px-2 py-0.5 text-[11px] text-white">
            {ativos}
          </span>
        )}
        <span className="ml-auto text-xs font-medium text-areia-500">
          {aberto ? "Fechar" : "Abrir"}
        </span>
      </button>

      <div
        className={`${aberto ? "flex" : "hidden"} flex-col gap-3 px-4 pb-4 md:flex md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:gap-y-3 md:py-3`}
      >
        <span className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-wide text-areia-500 md:flex">
          <IconeFiltro className="h-4 w-4" />
          Filtros
        </span>

        <GrupoFiltro rotulo="Quadra">
          <BotaoFiltro
            ativo={filtro.quadraId === "todas"}
            aoClicar={() => aoMudar({ quadraId: "todas" })}
          >
            Todas
          </BotaoFiltro>
          {quadras.map((q) => (
            <BotaoFiltro
              key={q.id}
              ativo={filtro.quadraId === q.id}
              aoClicar={() => aoMudar({ quadraId: q.id })}
            >
              {q.nome}
            </BotaoFiltro>
          ))}
        </GrupoFiltro>

        <GrupoFiltro rotulo="Professor">
          {professorTravado ? (
            <span className="rounded-lg bg-saibro-50 px-2.5 py-1.5 text-xs font-medium text-saibro-800">
              Só as suas aulas · {professorTravado}
            </span>
          ) : (
            <>
              <BotaoFiltro
                ativo={filtro.professorId === "todos"}
                aoClicar={() => aoMudar({ professorId: "todos" })}
              >
                Todos
              </BotaoFiltro>
              {professores.map((p) => (
                <BotaoFiltro
                  key={p.id}
                  ativo={filtro.professorId === p.id}
                  aoClicar={() => aoMudar({ professorId: p.id })}
                  cor={p.cor}
                >
                  {p.nome}
                </BotaoFiltro>
              ))}
            </>
          )}
        </GrupoFiltro>

        <GrupoFiltro rotulo="Tipo">
          <select
            value={filtro.tipo}
            onChange={(e) => aoMudar({ tipo: e.target.value as TipoOcupacao | "todos" })}
            aria-label="Tipo de ocupação"
            className="rounded-lg border border-areia-200 bg-white px-2.5 py-1.5 text-xs font-medium text-areia-700 focus:border-saibro-500 focus:outline-none"
          >
            <option value="todos">Todos os tipos</option>
            {ORDEM_TIPOS_AGENDA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </GrupoFiltro>

        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-areia-700">
          <input
            type="checkbox"
            checked={filtro.mostrarCanceladas}
            onChange={(e) => aoMudar({ mostrarCanceladas: e.target.checked })}
            className="h-4 w-4 rounded border-areia-300 accent-saibro-600"
          />
          Mostrar canceladas
        </label>

        <Legenda className="border-t border-areia-100 pt-3 md:hidden" />
      </div>
    </div>
  );
}

function GrupoFiltro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-areia-500">{rotulo}:</span>
      {children}
    </div>
  );
}

function BotaoFiltro({
  ativo,
  aoClicar,
  children,
  cor,
}: {
  ativo: boolean;
  aoClicar: () => void;
  children: ReactNode;
  cor?: string;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
        ativo ? "bg-saibro-600 text-white" : "bg-areia-100 text-areia-700 hover:bg-areia-200"
      }`}
    >
      {cor && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ativo ? "#fff" : cor }} />
      )}
      {children}
    </button>
  );
}

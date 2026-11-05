"use client";

import type { ReactNode } from "react";
import { BotaoFiltro } from "@/components/ui/BotaoFiltro";
import { InterruptorBola } from "@/components/ui/InterruptorBola";
import type { Professor, TipoOcupacao } from "@/lib/banco/tipos";
import type { EstadoDaAgenda } from "@/lib/consultas/enderecoDaAgenda";
import { ORDEM_TIPOS_AGENDA } from "./estilos";

/** Quantos filtros estao ligados (o numero no botao "Mais opcoes"). */
export function filtrosAtivosDaAgenda(estado: EstadoDaAgenda, professorTravado: boolean): number {
  const filtraProfessor = estado.visao !== "professor" && !professorTravado;
  return (
    Number(filtraProfessor && Boolean(estado.professorId)) +
    Number(estado.tipo !== "todos") +
    Number(!estado.mostrarCanceladas)
  );
}

/**
 * Filtros da agenda, dentro de "Mais opcoes": professor, tipo e "Mostrar
 * canceladas". Na visao Professores, a escolha do professor abre a semana
 * dele ("Todos os professores" volta para hoje e amanha com todos).
 */
export function FiltrosDaAgenda({
  estado,
  aoMudar,
  professores,
  professorTravado,
  professorFora,
}: {
  estado: EstadoDaAgenda;
  aoMudar: (parcial: Partial<EstadoDaAgenda>) => void;
  professores: Professor[];
  /** Perfil de professor: ve so as proprias aulas (Hipotese H9). */
  professorTravado?: string;
  /** Nome do professor escolhido quando ele nao esta em `professores` (inativo). */
  professorFora?: string;
}) {
  const visaoProfessores = estado.visao === "professor";
  const foraDaLista =
    estado.professorId && !professores.some((p) => p.id === estado.professorId) ? estado.professorId : undefined;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:gap-y-3">
      <GrupoFiltro rotulo={visaoProfessores ? "Semana de" : "Professor"}>
        {professorTravado ? (
          <span className="rounded-lg bg-saibro-50 px-2.5 py-1.5 text-sm font-medium text-saibro-800">
            Só as suas aulas · {professorTravado}
          </span>
        ) : (
          <>
            <BotaoFiltro ativo={!estado.professorId} aoClicar={() => aoMudar({ professorId: undefined })}>
              {visaoProfessores ? "Todos os professores" : "Todos"}
            </BotaoFiltro>
            {professores.map((p) => (
              <BotaoFiltro
                key={p.id}
                ativo={estado.professorId === p.id}
                aoClicar={() => aoMudar({ professorId: p.id })}
                cor={p.cor}
              >
                {p.nome}
              </BotaoFiltro>
            ))}
            {/* Vindo da ficha de um professor inativo: aparece para o nome bater com a grade. */}
            {foraDaLista && (
              <BotaoFiltro ativo aoClicar={() => aoMudar({ professorId: foraDaLista })}>
                {professorFora ?? "Professor"} (inativo)
              </BotaoFiltro>
            )}
          </>
        )}
      </GrupoFiltro>

      <GrupoFiltro rotulo="Tipo">
        <select
          value={estado.tipo}
          onChange={(e) => aoMudar({ tipo: e.target.value as TipoOcupacao | "todos" })}
          aria-label="Tipo de ocupação"
          className="campo w-auto py-1.5"
        >
          <option value="todos">Todos os tipos</option>
          {ORDEM_TIPOS_AGENDA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </GrupoFiltro>

      <InterruptorBola
        ligado={estado.mostrarCanceladas}
        aoMudar={(mostrarCanceladas) => aoMudar({ mostrarCanceladas })}
        rotulo="Mostrar canceladas"
      />
    </div>
  );
}

function GrupoFiltro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm font-medium text-areia-700">{rotulo}:</span>
      {children}
    </div>
  );
}

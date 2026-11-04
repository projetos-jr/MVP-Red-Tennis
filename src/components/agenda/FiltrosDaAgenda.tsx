"use client";

import { useState, type ReactNode } from "react";
import { BotaoFiltro } from "@/components/ui/BotaoFiltro";
import { IconeFiltro } from "@/components/ui/Icons";
import { InterruptorBola } from "@/components/ui/InterruptorBola";
import type { Professor, Quadra, TipoOcupacao } from "@/lib/banco/tipos";
import type { EstadoDaAgenda } from "@/lib/consultas/enderecoDaAgenda";
import { CLASSE_DO_PISO, ORDEM_TIPOS_AGENDA, rotuloCurtoDaQuadra } from "./estilos";
import { Legenda } from "./Legenda";

/**
 * Barra de cima da grade:
 *  - o que escolhe o assunto da visao (as quadras na visao Quadra, o
 *    professor na visao Professor), sempre a mostra;
 *  - os filtros (professor, tipo, "Mostrar canceladas"): no computador
 *    sempre abertos; no celular, recolhidos atras de um botao, junto com a
 *    legenda.
 */
export function FiltrosDaAgenda({
  estado,
  aoMudar,
  quadras,
  professores,
  professorTravado,
  professorFora,
  extra,
}: {
  estado: EstadoDaAgenda;
  aoMudar: (parcial: Partial<EstadoDaAgenda>) => void;
  quadras: Quadra[];
  professores: Professor[];
  /** Perfil de professor: ve so as proprias aulas (Hipotese H9). */
  professorTravado?: string;
  /** Nome do professor da visao quando ele nao esta em `professores` (inativo). */
  professorFora?: string;
  /** Controle extra no inicio da barra (ex.: "Hoje | Amanhã" no tablet em pe). */
  extra?: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const filtraProfessor = estado.visao !== "professor" && !professorTravado;
  const ativos =
    Number(filtraProfessor && Boolean(estado.professorId)) +
    Number(estado.tipo !== "todos") +
    Number(!estado.mostrarCanceladas);

  const assunto =
    estado.visao === "quadra" ? (
      <SeletorDeQuadra
        quadras={quadras}
        valor={estado.quadraId}
        aoMudar={(quadraId) => aoMudar({ quadraId })}
      />
    ) : estado.visao === "professor" ? (
      professorTravado ? (
        <SoAsSuasAulas nome={professorTravado} />
      ) : (
        <label className="flex items-center gap-2 text-xs font-medium text-areia-600">
          Professor
          <select
            value={estado.professorId ?? ""}
            onChange={(e) => aoMudar({ professorId: e.target.value })}
            className="campo w-auto min-w-[12rem] py-1.5 font-semibold text-areia-900"
          >
            {/* Vindo da ficha de um professor inativo: ele aparece na lista para o nome bater com a grade. */}
            {estado.professorId && !professores.some((p) => p.id === estado.professorId) && (
              <option value={estado.professorId}>
                {professorFora ?? "Professor"} (inativo)
              </option>
            )}
            {professores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      )
    ) : null;

  return (
    <div className="border-b border-areia-200">
      {(assunto || extra) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-areia-100 px-4 py-2.5 md:border-b-0 md:pb-0">
          {extra}
          {assunto}
        </div>
      )}

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
        <span className="ml-auto text-xs font-medium text-areia-600">
          {aberto ? "Fechar" : "Abrir"}
        </span>
      </button>

      <div
        className={`${aberto ? "flex" : "hidden"} flex-col gap-3 px-4 pb-4 md:flex md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:gap-y-2 md:py-2.5`}
      >
        <span className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-wide text-areia-600 md:flex">
          <IconeFiltro className="h-4 w-4" />
          Filtros
        </span>

        {estado.visao !== "professor" && (
          <GrupoFiltro rotulo="Professor">
            {professorTravado ? (
              <SoAsSuasAulas nome={professorTravado} />
            ) : (
              <>
                <BotaoFiltro
                  ativo={!estado.professorId}
                  aoClicar={() => aoMudar({ professorId: undefined })}
                >
                  Todos
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
              </>
            )}
          </GrupoFiltro>
        )}

        <GrupoFiltro rotulo="Tipo">
          <select
            value={estado.tipo}
            onChange={(e) => aoMudar({ tipo: e.target.value as TipoOcupacao | "todos" })}
            aria-label="Tipo de ocupação"
            className="alvo-de-toque rounded-lg border border-areia-300 bg-white px-2.5 py-1.5 text-xs font-medium text-areia-800 focus:border-saibro-500 focus:outline-none"
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
          className="text-xs"
        />

        <Legenda className="border-t border-areia-100 pt-3 md:hidden" />
      </div>
    </div>
  );
}

function SoAsSuasAulas({ nome }: { nome: string }) {
  return (
    <span className="rounded-lg bg-saibro-50 px-2.5 py-1.5 text-xs font-medium text-saibro-800">
      Só as suas aulas · {nome}
    </span>
  );
}

/** Pilulas da visao Quadra: Q1 (cimento, azul) a Q4 e Paredao (saibro, laranja). */
function SeletorDeQuadra({
  quadras,
  valor,
  aoMudar,
}: {
  quadras: Quadra[];
  valor?: string;
  aoMudar: (quadraId: Quadra["id"]) => void;
}) {
  return (
    <div role="group" aria-label="Quadra" className="flex flex-wrap items-center gap-1 sm:gap-1.5">
      {quadras.map((q) => {
        const ativo = q.id === valor;
        return (
          <button
            key={q.id}
            type="button"
            aria-pressed={ativo}
            onClick={() => aoMudar(q.id)}
            aria-label={q.nome}
            className={`alvo-de-toque inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-display text-[15px] font-semibold leading-none transition-colors sm:px-3 ${
              ativo
                ? `border-transparent shadow-sm ${CLASSE_DO_PISO[q.piso]}`
                : "border-areia-300 bg-white text-areia-800 hover:border-saibro-400 hover:bg-saibro-50"
            }`}
          >
            {!ativo && (
              <span
                className={`hidden h-2.5 w-2.5 rounded-sm sm:inline-block ${q.piso === "cimento" ? "bg-cimento-600" : "bg-saibro-600"}`}
                aria-hidden="true"
              />
            )}
            <span className="sm:hidden">{q.id === "paredao" ? q.nome : rotuloCurtoDaQuadra(q.id)}</span>
            <span className="hidden sm:inline">{q.nome}</span>
          </button>
        );
      })}
    </div>
  );
}

function GrupoFiltro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-areia-600">{rotulo}:</span>
      {children}
    </div>
  );
}

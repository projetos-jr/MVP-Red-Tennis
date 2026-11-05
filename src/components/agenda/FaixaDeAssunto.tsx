"use client";

import type { Professor, Quadra, QuadraId } from "@/lib/banco/tipos";
import { textoLegivelSobre } from "@/lib/cores";
import { CLASSE_DO_PISO, rotuloCurtoDaQuadra } from "./estilos";

/**
 * Faixa logo acima da grade nas visoes de semana: de QUEM e a semana. Botoes
 * grandes, o escolhido pintado (a quadra na cor do piso, o professor na cor
 * dele). Substitui a primeira linha do cabecalho da grade e o seletor que
 * antes ficava na barra de filtros.
 */
const PILULA =
  "alvo-de-toque inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl border px-3 font-display text-lg font-semibold leading-none transition-colors xl:px-4 xl:text-xl";
const PILULA_LIVRE = "border-areia-300 bg-white text-areia-800 hover:border-saibro-400 hover:bg-saibro-50";

/** Visao Quadra: Quadra 1 (cimento, azul) a Quadra 4 e Paredao (saibro, laranja). */
export function FaixaDeQuadras({
  quadras,
  valor,
  aoMudar,
}: {
  quadras: Quadra[];
  valor?: QuadraId;
  aoMudar: (quadraId: QuadraId) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Quadra da semana"
      className="grid grid-cols-5 gap-1.5 border-b border-areia-200 px-3 py-2.5 sm:flex sm:flex-wrap sm:gap-2"
    >
      {quadras.map((q) => {
        const ativo = q.id === valor;
        return (
          <button
            key={q.id}
            type="button"
            aria-pressed={ativo}
            aria-label={q.nome}
            onClick={() => aoMudar(q.id)}
            className={`${PILULA} px-1 ${ativo ? `border-transparent shadow-sm ${CLASSE_DO_PISO[q.piso]}` : PILULA_LIVRE}`}
          >
            {!ativo && (
              <span
                className={`hidden h-3 w-3 rounded-sm sm:inline-block ${q.piso === "cimento" ? "bg-cimento-600" : "bg-saibro-600"}`}
                aria-hidden="true"
              />
            )}
            <span className="text-base sm:hidden">
              {q.id === "paredao" ? q.nome : rotuloCurtoDaQuadra(q.id)}
            </span>
            <span className="hidden sm:inline">{q.nome}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Visao Professores: "Todos" (hoje e amanha, uma coluna por professor) ou a
 * semana de um professor. O professor logado (Hipotese H9) ve so o proprio
 * nome, sem trocar.
 */
export function FaixaDeProfessores({
  professores,
  valor,
  aoMudar,
  travado,
  professorFora,
}: {
  professores: Professor[];
  /** Professor da semana; sem ele, "Todos". */
  valor?: string;
  aoMudar: (professorId: string | undefined) => void;
  /** Perfil de professor: ve so as proprias aulas. */
  travado?: Professor;
  /** Professor da semana que nao esta na lista (inativo, vindo da ficha dele). */
  professorFora?: Professor;
}) {
  if (travado) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-areia-200 px-3 py-2.5">
        <PilulaDoProfessor professor={travado} ativo />
        <span className="text-base text-areia-700">A sua semana de aulas.</span>
      </div>
    );
  }
  const lista = professorFora ? [...professores, professorFora] : professores;
  return (
    <div
      role="group"
      aria-label="Professor"
      className="flex flex-wrap items-center gap-1.5 border-b border-areia-200 px-3 py-2.5 sm:gap-2"
    >
      <button
        type="button"
        aria-pressed={!valor}
        onClick={() => aoMudar(undefined)}
        className={`${PILULA} ${!valor ? "border-transparent bg-saibro-600 text-white shadow-sm" : PILULA_LIVRE}`}
        title="Hoje e amanhã, uma coluna por professor"
      >
        <span className="sm:hidden">Todos</span>
        <span className="hidden sm:inline">Todos os professores</span>
      </button>
      {lista.map((p) => (
        <PilulaDoProfessor
          key={p.id}
          professor={p}
          ativo={p.id === valor}
          inativo={p === professorFora}
          aoClicar={() => aoMudar(p.id)}
        />
      ))}
    </div>
  );
}

function PilulaDoProfessor({
  professor,
  ativo,
  inativo = false,
  aoClicar,
}: {
  professor: Professor;
  ativo: boolean;
  inativo?: boolean;
  aoClicar?: () => void;
}) {
  const estilo = ativo ? { backgroundColor: professor.cor, color: textoLegivelSobre(professor.cor) } : undefined;
  const conteudo = (
    <>
      {!ativo && (
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: professor.cor }} aria-hidden="true" />
      )}
      {professor.nome}
      {inativo && <span className="font-sans text-sm font-medium">(inativo)</span>}
    </>
  );
  const classe = `${PILULA} ${ativo ? "border-transparent shadow-sm" : PILULA_LIVRE}`;
  return aoClicar ? (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={classe}
      style={estilo}
      title={`A semana de ${professor.nome}`}
    >
      {conteudo}
    </button>
  ) : (
    <span className={classe} style={estilo}>
      {conteudo}
    </span>
  );
}

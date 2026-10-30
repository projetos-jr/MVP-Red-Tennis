"use client";

import type { ReactNode } from "react";
import { IconeAlerta } from "./Icons";

/**
 * Pecas de formulario usadas em todas as telas.
 * Os campos em si usam a classe `campo` (input, select, textarea).
 *
 *   <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
 *     <input className="campo" value={nome} onChange={...} />
 *   </Campo>
 *
 * A validacao na tela e so conforto: a regra que vale e a da operacao
 * (e, depois, a do banco).
 */
export function Campo({
  rotulo,
  obrigatorio,
  ajuda,
  erro,
  children,
  className = "",
}: {
  rotulo: string;
  obrigatorio?: boolean;
  ajuda?: string;
  erro?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-areia-800">
        {rotulo}
        {obrigatorio && <span className="ml-0.5 text-tijolo-600">*</span>}
      </span>
      {children}
      {erro ? (
        <span className="mt-1 block text-xs font-medium text-tijolo-700">{erro}</span>
      ) : (
        ajuda && <span className="mt-1 block text-xs text-areia-500">{ajuda}</span>
      )}
    </label>
  );
}

/** Caixa de erro dentro de um formulario (ex.: mensagem devolvida pela regra). */
export function MensagemDeErro({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-tijolo-200 bg-tijolo-50 px-3.5 py-3 text-sm text-tijolo-800"
    >
      <IconeAlerta className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="leading-snug">{children}</p>
    </div>
  );
}

/** Rodape padrao dos formularios em modal: cancelar a esquerda, acao principal a direita. */
export function RodapeDoFormulario({
  aoCancelar,
  rotuloConfirmar,
  desabilitado,
  perigoso,
}: {
  aoCancelar: () => void;
  rotuloConfirmar: string;
  desabilitado?: boolean;
  perigoso?: boolean;
}) {
  return (
    <footer className="flex flex-col-reverse gap-2 border-t border-areia-200 px-5 py-4 sm:flex-row sm:justify-end">
      <button type="button" onClick={aoCancelar} className="btn-secundario">
        Cancelar
      </button>
      <button
        type="submit"
        disabled={desabilitado}
        className={perigoso ? "btn-perigo" : "btn-primario"}
      >
        {rotuloConfirmar}
      </button>
    </footer>
  );
}

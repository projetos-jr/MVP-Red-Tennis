"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Seção de apoio que começa fechada (relatórios, últimos movimentos): o
 * cabeçalho inteiro é um botão grande que abre e fecha. Pedido do dono da
 * arena: "não tem que estar tudo na tela". Usada no financeiro e no estoque.
 *
 *   <SecaoRecolhida titulo="Ver por forma de pagamento" resumo="R$ 25.613,00 em 95 pagamentos">
 *     ...
 *   </SecaoRecolhida>
 */
export function SecaoRecolhida({
  titulo,
  resumo,
  icone,
  children,
  abertaNoInicio = false,
  className = "",
}: {
  titulo: string;
  /** Linha curta ao lado do título (aparece fechada e aberta). */
  resumo?: ReactNode;
  icone?: ReactNode;
  children: ReactNode;
  abertaNoInicio?: boolean;
  className?: string;
}) {
  const [aberta, setAberta] = useState(abertaNoInicio);
  const id = useId();
  const idDoConteudo = `${id}-conteudo`;

  return (
    <section className={`card ${className}`}>
      <h2>
        <button
          type="button"
          onClick={() => setAberta((atual) => !atual)}
          aria-expanded={aberta}
          aria-controls={idDoConteudo}
          aria-labelledby={`${id}-titulo`}
          aria-describedby={resumo ? `${id}-resumo` : undefined}
          className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left transition-colors hover:bg-areia-50 sm:px-5 ${
            aberta ? "rounded-b-none border-b border-areia-200" : ""
          }`}
        >
          {icone && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saibro-600 text-white">
              {icone}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span id={`${id}-titulo`} className="block font-display text-xl font-bold leading-tight text-areia-900">
              {titulo}
            </span>
            {resumo && (
              <span id={`${id}-resumo`} className="mt-0.5 block text-base text-areia-600">
                {resumo}
              </span>
            )}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-areia-300 bg-white px-3 py-2 text-base font-semibold text-areia-800 group-hover:border-saibro-400 group-hover:text-saibro-800">
            <span className="hidden sm:inline">{aberta ? "Esconder" : "Ver"}</span>
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className={`h-5 w-5 motion-safe:transition-transform ${aberta ? "rotate-180" : ""}`}
            >
              <path
                d="M5 8l5 5 5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </h2>
      <div id={idDoConteudo} hidden={!aberta} className={aberta ? "motion-safe:animate-fade-up" : ""}>
        {aberta ? children : null}
      </div>
    </section>
  );
}

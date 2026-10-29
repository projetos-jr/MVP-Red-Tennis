"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Painel lateral (gaveta) que abre por cima da agenda, sem tirar a grade da
 * vista no computador; no celular ocupa a tela toda. Fecha com Esc, com o
 * clique fora ou pelo botao de fechar do conteudo.
 */
export function Gaveta({
  aberto,
  aoFechar,
  titulo,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  const painel = useRef<HTMLElement>(null);

  // Foco no painel ao abrir e de volta onde estava ao fechar.
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    painel.current?.focus();
    return () => anterior?.focus();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      // Com uma confirmacao aberta por cima, o Esc fecha so ela.
      if (document.querySelectorAll('[aria-modal="true"]').length > 1) return;
      aoFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[45] flex justify-end bg-areia-900/30 animate-fade-in"
      onClick={aoFechar}
    >
      <aside
        ref={painel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto rolagem-suave bg-white shadow-card-hover outline-none md:rounded-l-2xl"
      >
        {children}
      </aside>
    </div>
  );
}

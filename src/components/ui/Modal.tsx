"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconeFechar } from "./Icons";

interface ModalProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  /** Largura máxima do painel. */
  largura?: "sm" | "md" | "lg";
}

const LARGURAS = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-3xl",
} as const;

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Janelas abertas, da mais antiga para a de cima (uma confirmação sobre um formulário). */
const pilha: string[] = [];

/**
 * Janela modal.
 *
 * - Abre fora da página (portal no `body`): não herda espaçamentos do
 *   contêiner nem fica presa dentro da barra do topo.
 * - Leva o foco do teclado para dentro, prende o Tab ali e devolve o foco ao
 *   fechar.
 * - Esc e clique fora fecham só a janela de cima.
 * - Janela mais alta que a tela rola inteira (o topo nunca fica cortado).
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  largura = "md",
}: ModalProps) {
  const id = useId();
  const painel = useRef<HTMLDivElement>(null);
  // Guarda a funcao mais recente sem reabrir a janela a cada renderizacao.
  const fechar = useRef(aoFechar);
  useEffect(() => {
    fechar.current = aoFechar;
  }, [aoFechar]);

  useEffect(() => {
    if (!aberto) return;
    const focoAnterior = document.activeElement as HTMLElement | null;
    pilha.push(id);
    document.body.style.overflow = "hidden";

    const elemento = painel.current;
    const primeiro =
      elemento?.querySelector<HTMLElement>("[autofocus]") ??
      elemento?.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      ) ??
      elemento;
    primeiro?.focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (pilha[pilha.length - 1] !== id || !elemento) return;
      if (evento.key === "Escape") {
        evento.stopPropagation();
        fechar.current();
        return;
      }
      if (evento.key !== "Tab") return;
      const focaveis = [...elemento.querySelectorAll<HTMLElement>(FOCAVEIS)];
      if (focaveis.length === 0) return;
      const inicio = focaveis[0];
      const fim = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === inicio) {
        evento.preventDefault();
        fim.focus();
      } else if (!evento.shiftKey && document.activeElement === fim) {
        evento.preventDefault();
        inicio.focus();
      }
    }

    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      pilha.splice(pilha.indexOf(id), 1);
      if (pilha.length === 0) document.body.style.overflow = "";
      focoAnterior?.focus?.();
    };
  }, [aberto, id]);

  if (!aberto || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-areia-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-titulo`}
    >
      <div
        className="flex min-h-full items-start justify-center p-4 sm:items-center"
        onClick={(evento) => {
          if (evento.target === evento.currentTarget && pilha[pilha.length - 1] === id) {
            aoFechar();
          }
        }}
      >
        <div
          ref={painel}
          tabIndex={-1}
          className={`w-full ${LARGURAS[largura]} animate-fade-up rounded-2xl border border-areia-200 bg-white shadow-card-hover focus:outline-none`}
        >
          <header className="flex items-start justify-between gap-4 border-b border-areia-200 px-5 py-4">
            <div>
              <h2 id={`${id}-titulo`} className="text-base font-semibold text-areia-900">
                {titulo}
              </h2>
              {descricao && <p className="mt-0.5 text-sm text-areia-600">{descricao}</p>}
            </div>
            <button
              type="button"
              onClick={aoFechar}
              className="btn-fantasma shrink-0 px-2 py-1.5"
              aria-label="Fechar"
            >
              <IconeFechar className="h-4 w-4" />
            </button>
          </header>

          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

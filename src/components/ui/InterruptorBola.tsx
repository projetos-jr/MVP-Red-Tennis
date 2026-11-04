"use client";

import { useId, type ReactNode } from "react";

/**
 * Interruptor de liga/desliga com o botão em forma de bola de tênis: desligado
 * a bola fica cinza; ligado, ela "acende" em amarelo e corre para a direita
 * sobre o trilho verde de quadra. O texto (Sim/Não ou o rótulo) acompanha
 * sempre: a cor nunca vem sozinha.
 *
 *   <InterruptorBola ligado={x} aoMudar={setX} rotulo="Mostrar canceladas" />
 *
 * Acessível: `role="switch"` com `aria-checked`; área de toque de 44px.
 */
export function InterruptorBola({
  id,
  ligado,
  aoMudar,
  rotulo,
  rotuloOculto,
  descricaoId,
  className = "",
}: {
  id?: string;
  ligado: boolean;
  aoMudar: (ligado: boolean) => void;
  /** Texto ao lado (clicável). Sem ele, use `rotuloOculto` para o leitor de tela. */
  rotulo?: string;
  rotuloOculto?: string;
  /** id do texto de ajuda (aria-describedby). */
  descricaoId?: string;
  className?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo ? undefined : rotuloOculto}
      aria-describedby={descricaoId}
      onClick={() => aoMudar(!ligado)}
      className={`group inline-flex min-h-[44px] items-center gap-2.5 rounded-full text-sm font-medium text-areia-800 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-[30px] w-[54px] shrink-0 items-center rounded-full border transition-colors duration-200 ${
          ligado ? "border-quadra-800 bg-quadra-700" : "border-areia-300 bg-areia-200"
        }`}
      >
        {/* Linha de quadra no trilho (decorativa). */}
        <span className={`absolute inset-x-2 top-1/2 h-px -translate-y-1/2 ${ligado ? "bg-white/50" : "bg-white/80"}`} />
        <span
          className={`relative h-6 w-6 rounded-full shadow-md transition-transform duration-200 motion-reduce:transition-none ${
            ligado ? "translate-x-[26px]" : "translate-x-[2px]"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6">
            <circle
              cx="12"
              cy="12"
              r="11"
              className={ligado ? "fill-bola-300 stroke-bola-700" : "fill-areia-50 stroke-areia-400"}
              strokeWidth="1.2"
            />
            {/* As duas costuras da bola. */}
            <path
              d="M5.2 4.6c3.1 2.3 4.4 4.9 4.4 7.4s-1.3 5.1-4.4 7.4M18.8 4.6c-3.1 2.3-4.4 4.9-4.4 7.4s1.3 5.1 4.4 7.4"
              fill="none"
              stroke="white"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity={ligado ? 0.95 : 0.9}
            />
          </svg>
        </span>
      </span>
      {rotulo && <span>{rotulo}</span>}
    </button>
  );
}

/**
 * Opção sim/não de formulário: o interruptor com um título e, se precisar,
 * uma explicação embaixo. Clicar no texto também liga e desliga. Use no lugar
 * de uma caixa de seleção sozinha ("Já foi pago", "Reservar quadra"); listas
 * e matrizes de escolha (permissões) continuam com caixas de seleção.
 *
 *   <OpcaoSimNao ligado={jaPago} aoMudar={setJaPago} titulo="Já foi pago" />
 */
export function OpcaoSimNao({
  ligado,
  aoMudar,
  titulo,
  descricao,
  className = "",
}: {
  ligado: boolean;
  aoMudar: (ligado: boolean) => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const idDaAjuda = `${id}-ajuda`;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <InterruptorBola
        id={id}
        ligado={ligado}
        aoMudar={aoMudar}
        descricaoId={descricao ? idDaAjuda : undefined}
        className="shrink-0"
      />
      <label htmlFor={id} className="min-w-0 cursor-pointer text-sm">
        <span className="block font-medium text-areia-900">{titulo}</span>
        {descricao && (
          <span id={idDaAjuda} className="block text-xs text-areia-500">
            {descricao}
          </span>
        )}
      </label>
    </div>
  );
}

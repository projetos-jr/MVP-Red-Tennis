"use client";

import { PALETA } from "@/lib/paleta";

/**
 * Placa triangular de atenção (amarelo da bola, borda escura, "!"), como a
 * placa de alerta do sistema antigo da arena. Só aparece quando há algo para
 * ver: com `quantidade` 0 o botão não é desenhado.
 */
export function PlacaDeAtencao({ className = "h-14 w-14" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 58" aria-hidden="true" className={className}>
      <path
        d="M27.4 4.6a5.3 5.3 0 0 1 9.2 0l25 43.2A5.3 5.3 0 0 1 57 55.8H7a5.3 5.3 0 0 1-4.6-8L27.4 4.6Z"
        fill={PALETA.bola[300]}
        stroke={PALETA.areia[900]}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path d="M32 20v16" stroke={PALETA.areia[900]} strokeWidth={6} strokeLinecap="round" />
      <circle cx="32" cy="45.5" r="3.6" fill={PALETA.areia[900]} />
    </svg>
  );
}

/**
 * Botão com a placa: "grande" no Início (abaixo do mosaico) e "compacto"
 * em barras de ferramentas (agenda). Some quando não há nada.
 */
export function BotaoDeAtencao({
  quantidade,
  aoAbrir,
  titulo = "Atenção",
  descricao,
  variante = "grande",
  abreJanela = true,
  className = "",
}: {
  quantidade: number;
  aoAbrir: () => void;
  titulo?: string;
  /** Linha de baixo (grande) ou rótulo (compacto). Padrão: "N itens precisam de você". */
  descricao?: string;
  variante?: "grande" | "compacto";
  /** O botão abre uma janela (leitor de tela avisa). Use false quando ele só abre uma lista na própria página. */
  abreJanela?: boolean;
  className?: string;
}) {
  if (quantidade <= 0) return null;
  const texto = descricao ?? `${quantidade} ${quantidade === 1 ? "item precisa" : "itens precisam"} de você`;

  if (variante === "compacto") {
    return (
      <button
        type="button"
        onClick={aoAbrir}
        aria-haspopup={abreJanela ? "dialog" : undefined}
        className={`btn alvo-de-toque gap-2 border-2 border-areia-900 bg-bola-300 px-3 py-2 text-areia-900 hover:bg-bola-200 ${className}`}
      >
        <PlacaDeAtencao className="h-6 w-6 shrink-0" />
        <span className="font-bold">{texto}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={aoAbrir}
      aria-haspopup={abreJanela ? "dialog" : undefined}
      className={`group flex w-full items-center gap-5 rounded-2xl bg-areia-900 px-5 py-4 text-left text-white shadow-card transition-transform hover:-translate-y-0.5 motion-reduce:transition-none sm:px-7 sm:py-5 ${className}`}
    >
      <span className="relative shrink-0">
        <PlacaDeAtencao className="h-16 w-16 drop-shadow-[0_0_14px_rgba(224,243,79,0.45)] motion-safe:animate-atencao sm:h-20 sm:w-20" />
        <span className="absolute -right-2 -top-2 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-tijolo-600 px-2 font-display text-lg font-bold text-white ring-4 ring-areia-900">
          {quantidade}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-3xl font-bold leading-none sm:text-4xl">{titulo}</span>
        <span className="mt-1.5 block text-base text-areia-200 sm:text-lg">{texto}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-base font-semibold sm:inline-flex">
        Ver
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 motion-safe:transition-transform group-hover:translate-x-0.5">
          <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

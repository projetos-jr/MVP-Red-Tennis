"use client";

import type { ReactNode } from "react";

/**
 * "Mais opções": o que é usado todo dia fica grande e à vista; o resto
 * (filtros, ações raras, números de apoio) fica guardado atrás deste botão.
 * Pedido do dono da arena: "quando está tudo fechado, deixa tudo bem grande".
 *
 * Uso:
 *   const [aberto, setAberto] = useState(false);
 *   <BotaoMaisOpcoes aberto={aberto} aoAlternar={() => setAberto(!aberto)} controla="opcoes-agenda" />
 *   <PainelDeOpcoes id="opcoes-agenda" aberto={aberto}>...</PainelDeOpcoes>
 */
export function BotaoMaisOpcoes({
  aberto,
  aoAlternar,
  controla,
  rotulo = "Mais opções",
  rotuloAberto = "Menos opções",
  contagem,
  className = "",
}: {
  aberto: boolean;
  aoAlternar: () => void;
  /** id do PainelDeOpcoes que o botão abre. */
  controla: string;
  rotulo?: string;
  rotuloAberto?: string;
  /** Quantos filtros/opções estão ativos lá dentro (aparece como número). */
  contagem?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-expanded={aberto}
      aria-controls={controla}
      className={`btn alvo-de-toque border px-4 py-2.5 text-[0.95rem] ${
        aberto
          ? "border-areia-900 bg-areia-900 text-white hover:bg-areia-800"
          : "border-areia-300 bg-white text-areia-800 hover:border-areia-400 hover:bg-areia-50"
      } ${className}`}
    >
      <IconeOpcoes className="h-5 w-5" />
      {aberto ? rotuloAberto : rotulo}
      {!aberto && contagem !== undefined && contagem > 0 && (
        <span className="ml-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-saibro-600 px-1.5 text-xs font-bold text-white">
          {contagem}
        </span>
      )}
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className={`h-4 w-4 motion-safe:transition-transform ${aberto ? "rotate-180" : ""}`}
      >
        <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** A área que o BotaoMaisOpcoes abre. Fechada, não ocupa espaço nem recebe foco. */
export function PainelDeOpcoes({
  id,
  aberto,
  children,
  className = "",
  rotulo = "Mais opções",
}: {
  id: string;
  aberto: boolean;
  children: ReactNode;
  className?: string;
  rotulo?: string;
}) {
  return (
    <div
      id={id}
      role="region"
      aria-label={rotulo}
      hidden={!aberto}
      className={`${aberto ? "motion-safe:animate-fade-up" : ""} ${className}`}
    >
      {aberto ? children : null}
    </div>
  );
}

function IconeOpcoes(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" {...p}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";
import { PALETA } from "@/lib/paleta";
import { FundoDeSaibro } from "./FundoDeSaibro";

/**
 * Moldura das duas telas de login (demonstracao e e-mail): a quadra de
 * saibro de fundo e, no meio, o cartao branco com a logo grande da arena.
 * O cartao e branco solido (nada de transparencia atras do texto).
 *
 * Celular: o cartao ocupa a largura com 16px de margem e fica no alto; o
 * "T" da quadra e a bola aparecem no pe da tela (por isso o espaco embaixo).
 * O rodape (quadras e horario) so aparece do tablet para cima.
 */
export function CenaDoLogin({ children, rodape }: { children: ReactNode; rodape?: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-saibro-700 px-4 pb-28 pt-6 sm:px-6 md:py-12">
      <FundoDeSaibro />
      <main className="w-full max-w-[30rem] motion-safe:animate-fade-up">
        <div className="rounded-[1.75rem] bg-white px-5 pb-7 pt-6 shadow-quadra ring-1 ring-saibro-950/10 sm:px-8 sm:pb-8 sm:pt-7">
          <h1 className="sr-only">Entrar no sistema da Red Tennis</h1>
          <Logo className="mx-auto h-24 w-auto sm:h-32" />
          {children}
        </div>
        {rodape && (
          <p
            data-fundo-de-contraste={PALETA.saibro[900]}
            className="mx-auto mt-5 hidden w-fit max-w-full rounded-full bg-saibro-950/60 px-4 py-1.5 text-center text-sm font-medium text-white sm:block"
          >
            {rodape}
          </p>
        )}
      </main>
    </div>
  );
}

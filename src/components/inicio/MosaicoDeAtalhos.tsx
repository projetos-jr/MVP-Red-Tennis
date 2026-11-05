"use client";

import Link from "next/link";
import { useId } from "react";
import { colunasDoPrimeiro, type Atalho } from "@/components/layout/atalhos";
import { IconeExterno } from "@/components/ui/Icons";
import { LADRILHO } from "@/lib/paleta";
import { ICONE_DO_ATALHO } from "./IconesDoMosaico";

/**
 * Classes de largura do primeiro botao em cada tamanho da grade (2, 3 e 4
 * colunas). Escritas por extenso para o Tailwind encontrar.
 */
const LARGURA: Record<2 | 3 | 4, string[]> = {
  2: ["", "col-span-1", "col-span-2"],
  3: ["", "sm:col-span-1", "sm:col-span-2", "sm:col-span-3"],
  4: ["", "lg:col-span-1", "lg:col-span-2", "lg:col-span-3", "lg:col-span-4"],
};

function larguraDoPrimeiro(total: number): string {
  return ([2, 3, 4] as const).map((colunas) => LARGURA[colunas][colunasDoPrimeiro(total, colunas)]).join(" ");
}

/**
 * Linhas de quadra decorativas no canto do botao (fundo da quadra visto de
 * cima: linha de base, laterais e linha de saque), bem discretas.
 */
function CantoDeQuadra() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 120 80"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="pointer-events-none absolute -right-px -top-px h-16 w-24 text-white opacity-25 sm:h-20 sm:w-[7.5rem] [mask-image:linear-gradient(to_bottom_left,black_35%,transparent_85%)]"
    >
      <path d="M0 12h104v68M90 12v68M0 48h90M36 48v32" />
    </svg>
  );
}

/**
 * O mosaico do Início: botoes grandes laranja, um por tela, como no sistema
 * antigo (agora com icones proprios e acabamento atual). So aparecem as telas
 * que o perfil pode abrir (`atalhosPermitidos`). O primeiro (Diária) fica
 * mais largo quando sobra espaco na ultima linha, para a grade fechar.
 */
export function MosaicoDeAtalhos({ atalhos }: { atalhos: Atalho[] }) {
  const idDoTitulo = useId();
  if (atalhos.length === 0) return null;

  return (
    <nav aria-labelledby={idDoTitulo}>
      <h2 id={idDoTitulo} className="sr-only">
        Atalhos
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {atalhos.map((atalho, i) => {
          const Icone = ICONE_DO_ATALHO[atalho.id];
          const destaque = i === 0;
          const classes = `ladrilho group min-h-[7.75rem] sm:min-h-[8.75rem] ${
            destaque ? "lg:min-h-[9.25rem]" : ""
          }`;
          const conteudo = (
            <>
              <CantoDeQuadra />
              <span className="relative flex items-start justify-between gap-2">
                <Icone className="h-12 w-12 shrink-0 drop-shadow-sm lg:h-14 lg:w-14" />
                {atalho.externo && <IconeExterno className="h-5 w-5 shrink-0" />}
              </span>
              <span
                className={`relative mt-3 block font-display text-[1.375rem] font-bold leading-[1.05] tracking-tight sm:text-[1.625rem] ${
                  destaque ? "lg:text-[2rem]" : ""
                }`}
              >
                {atalho.rotulo}
                {atalho.externo && <span className="sr-only"> (abre em nova aba)</span>}
              </span>
            </>
          );

          return (
            <li key={atalho.id} className={`flex ${destaque ? larguraDoPrimeiro(atalhos.length) : ""}`}>
              {atalho.externo ? (
                <a
                  href={atalho.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={atalho.descricao}
                  data-fundo-de-contraste={LADRILHO.referencia}
                  className={`${classes} w-full`}
                >
                  {conteudo}
                </a>
              ) : (
                <Link
                  href={atalho.href}
                  title={atalho.descricao}
                  data-fundo-de-contraste={LADRILHO.referencia}
                  className={`${classes} w-full`}
                >
                  {conteudo}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

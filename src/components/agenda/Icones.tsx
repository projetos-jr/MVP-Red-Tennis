import type { ReactNode, SVGProps } from "react";

/**
 * Icones usados so na agenda, no mesmo traco de `components/ui/Icons.tsx`
 * (que e compartilhado e nao recebe icones de um modulo so).
 */
type IconeProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconeProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconeChuva = (p: IconeProps) => (
  <Base {...p}>
    <path d="M7 15a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 6.5a3.8 3.8 0 0 1 .5 7.5H7z" />
    <path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5" />
  </Base>
);

export const IconeImpressora = (p: IconeProps) => (
  <Base {...p}>
    <path d="M7 8V3h10v5" />
    <rect x="3" y="8" width="18" height="8" rx="2" />
    <path d="M7 13h10v8H7z" />
  </Base>
);

export const IconeTablet = (p: IconeProps) => (
  <Base {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M18 12h.01" />
  </Base>
);

export const IconeReposicao = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5" />
    <path d="M20 4v4.5h-4.5" />
    <path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5" />
    <path d="M4 20v-4.5h4.5" />
  </Base>
);

export const IconeRemarcar = (p: IconeProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <path d="M9 15.5h6M13 13.5l2 2-2 2" />
  </Base>
);

export const IconeCancelar = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M6 6l12 12" />
  </Base>
);

export const IconeFimDoHorario = (p: IconeProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <path d="M9.5 13.5l5 5M14.5 13.5l-5 5" />
  </Base>
);

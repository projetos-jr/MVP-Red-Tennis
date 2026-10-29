import type { SVGProps } from "react";

/**
 * Icones usados so nas fichas de aluno e professor, no mesmo traco de
 * `components/ui/Icons.tsx`.
 */
type IconeProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconeProps & { children: React.ReactNode }) {
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

export const IconeEditar = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Base>
);

export const IconeTroca = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 8h13M14 4.5 17.5 8 14 11.5" />
    <path d="M20 16H7M10 12.5 6.5 16l3.5 3.5" />
  </Base>
);

export const IconeSaida = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3.5 20a6.5 6.5 0 0 1 11.2-4.5M16 18h5" />
  </Base>
);

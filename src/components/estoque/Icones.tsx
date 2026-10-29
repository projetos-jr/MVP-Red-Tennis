import type { ReactNode, SVGProps } from "react";

/**
 * Icones que so o estoque usa, no mesmo traco de `components/ui/Icons.tsx`.
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

/** Lapis: editar cadastro. */
export const IconeEditar = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </Base>
);

/** Prancheta com check: contagem (ajuste de inventario). */
export const IconeContagem = (p: IconeProps) => (
  <Base {...p}>
    <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" />
    <path d="M16 5h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2" />
    <path d="M9 13.5l2 2 4-4.5" />
  </Base>
);

/** Caixa de arquivo: inativar produto. */
export const IconeArquivar = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 5h16v4H4z" />
    <path d="M5.5 9v10h13V9" />
    <path d="M10 13h4" />
  </Base>
);

/** Carrinho: lista de compras. */
export const IconeCarrinho = (p: IconeProps) => (
  <Base {...p}>
    <path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.1L20 8H6" />
    <circle cx="9.5" cy="19.5" r="1.2" />
    <circle cx="16.5" cy="19.5" r="1.2" />
  </Base>
);

/** Recibo: fechar conta. */
export const IconeRecibo = (p: IconeProps) => (
  <Base {...p}>
    <path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Base>
);

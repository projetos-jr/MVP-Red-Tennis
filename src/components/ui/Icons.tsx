import type { SVGProps } from "react";

/**
 * Conjunto minimo de icones em SVG inline.
 * Evita dependencia externa e mantem o traco consistente em todas as telas.
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

export const IconeQuadras = (p: IconeProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 12h18M12 4v16" />
    <path d="M8 9h8v6H8z" />
  </Base>
);

export const IconeAgenda = (p: IconeProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Base>
);

export const IconeFinanceiro = (p: IconeProps) => (
  <Base {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M3 10h18" />
    <path d="M7 15h4" />
  </Base>
);

export const IconeTrofeu = (p: IconeProps) => (
  <Base {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3" />
    <path d="M10 17h4M12 13v4M9 20h6" />
  </Base>
);

export const IconeUsuario = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Base>
);

export const IconeUsuarios = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 19a6 6 0 0 1 12 0" />
    <path d="M16 6.5a3 3 0 0 1 0 5.8M17.5 19a6 6 0 0 0-2-4.5" />
  </Base>
);

export const IconeRelogio = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
);

export const IconeAlerta = (p: IconeProps) => (
  <Base {...p}>
    <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Base>
);

export const IconeCheck = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.3 2.4 2.4 4.6-4.9" />
  </Base>
);

export const IconeVoltar = (p: IconeProps) => (
  <Base {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Base>
);

export const IconeSeta = (p: IconeProps) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const IconeAnterior = (p: IconeProps) => (
  <Base {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Base>
);

export const IconeProximo = (p: IconeProps) => (
  <Base {...p}>
    <path d="M9 6l6 6-6 6" />
  </Base>
);

export const IconeTelefone = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h1.8a1 1 0 0 1 1 .8l.7 3a1 1 0 0 1-.5 1.1L7.6 9a12 12 0 0 0 5.4 5.4l1.1-1.4a1 1 0 0 1 1.1-.5l3 .7a1 1 0 0 1 .8 1V16a2 2 0 0 1-2 2h-.5A13.5 13.5 0 0 1 4 5.5z" />
  </Base>
);

export const IconeEmail = (p: IconeProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Base>
);

export const IconeCongelado = (p: IconeProps) => (
  <Base {...p}>
    <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
    <path d="M12 6.5 9.8 4.6M12 6.5l2.2-1.9M12 17.5l-2.2 1.9M12 17.5l2.2 1.9" />
  </Base>
);

export const IconeMais = (p: IconeProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconeBusca = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Base>
);

export const IconeExportar = (p: IconeProps) => (
  <Base {...p}>
    <path d="M12 3v11M8 10.5l4 4 4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Base>
);

export const IconeSair = (p: IconeProps) => (
  <Base {...p}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 16l-4-4 4-4M6 12h9" />
  </Base>
);

export const IconeSubiu = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 17 10 11l3.5 3.5L20 8" />
    <path d="M15 8h5v5" />
  </Base>
);

export const IconeDesceu = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 8 10 14l3.5-3.5L20 17" />
    <path d="M15 17h5v-5" />
  </Base>
);

export const IconeEstavel = (p: IconeProps) => (
  <Base {...p}>
    <path d="M5 12h14" />
  </Base>
);

export const IconeFiltro = (p: IconeProps) => (
  <Base {...p}>
    <path d="M3 5h18l-7 8v6l-4 2v-8z" />
  </Base>
);

export const IconeBola = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M4.5 6.5A7.5 7.5 0 0 0 9 15M19.5 6.5A7.5 7.5 0 0 1 15 15" />
  </Base>
);

export const IconeCadeado = (p: IconeProps) => (
  <Base {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Base>
);

export const IconeNota = (p: IconeProps) => (
  <Base {...p}>
    <path d="M5 4h14v12l-5 5H5z" />
    <path d="M19 16h-5v5" />
    <path d="M9 9h6M9 13h3" />
  </Base>
);

export const IconeEstoque = (p: IconeProps) => (
  <Base {...p}>
    <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5z" />
    <path d="M3 8.5 12 13l9-4.5M12 13v7" />
  </Base>
);

export const IconeCopo = (p: IconeProps) => (
  <Base {...p}>
    <path d="M6 4h12l-1.2 15a2 2 0 0 1-2 1.9h-5.6a2 2 0 0 1-2-1.9z" />
    <path d="M6.6 10h10.8" />
  </Base>
);

export const IconeFechar = (p: IconeProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);

export const IconeEntrada = (p: IconeProps) => (
  <Base {...p}>
    <path d="M12 21V10M8 13.5l4-4 4 4" />
    <path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
  </Base>
);

export const IconeLixeira = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
  </Base>
);

/** Casa: botão "Início" (tela inicial com as quadras e o mosaico). */
export const IconeInicio = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 11.5 12 5l8 6.5" />
    <path d="M6 10v9a1 1 0 0 0 1 1h3.5v-5h3v5H17a1 1 0 0 0 1-1v-9" />
  </Base>
);

/** Seta saindo da caixa: link que abre fora do sistema (nova aba). */
export const IconeExterno = (p: IconeProps) => (
  <Base {...p}>
    <path d="M14 5h5v5" />
    <path d="M19 5l-8 8" />
    <path d="M17 13.5V18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4.5" />
  </Base>
);

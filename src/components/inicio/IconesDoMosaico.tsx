import type { ComponentType, ReactNode, SVGProps } from "react";
import type { IdDoAtalho } from "@/components/layout/atalhos";

/**
 * Icones do mosaico do Inicio: desenhos proprios em SVG (sem biblioteca nem
 * imagem de terceiros), em dois tons sobre o laranja do ladrilho:
 *  - traco principal em branco (`currentColor` do botao);
 *  - detalhe em saibro-200 (bola, raquete, caixa de cima, ponteiros...).
 *
 * Grade de 48 x 48, traco 2,8 (o mesmo peso em todos), pontas arredondadas.
 * Sao decorativos (aria-hidden): o nome do atalho vem no rotulo do botao.
 */

type PropsDoIcone = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: PropsDoIcone & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Segundo tom do icone (saibro-200). */
function Detalhe({ children }: { children: ReactNode }) {
  return (
    <g className="text-saibro-200" stroke="currentColor">
      {children}
    </g>
  );
}

/** Bola de tenis em contorno, com as duas costuras. */
function Bola({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  // Costuras: arcos que saem e voltam ao contorno (pontos a 0,78r e 0,6r do centro).
  const dx = r * 0.78;
  const dy = r * 0.6;
  const curva = r * 0.38;
  const costura = r < 7 ? 1.8 : 2.2;
  return (
    <>
      <circle cx={cx} cy={cy} r={r} />
      <path
        strokeWidth={costura}
        d={`M${cx - dx} ${cy - dy}C${cx - dx + curva} ${cy - dy / 2} ${cx - dx + curva} ${cy + dy / 2} ${cx - dx} ${cy + dy}`}
      />
      <path
        strokeWidth={costura}
        d={`M${cx + dx} ${cy - dy}C${cx + dx - curva} ${cy - dy / 2} ${cx + dx - curva} ${cy + dy / 2} ${cx + dx} ${cy + dy}`}
      />
    </>
  );
}

/** Diária: calendario com uma bola de tenis no canto. */
export const IconeDiaria = (p: PropsDoIcone) => (
  <Base {...p}>
    <path d="M24 37H9a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v11" />
    <path d="M5 17h28M12 5v7M26 5v7" />
    <g fill="currentColor" stroke="none">
      <circle cx="11.5" cy="23" r="1.8" />
      <circle cx="17.5" cy="23" r="1.8" />
      <circle cx="23.5" cy="23" r="1.8" />
      <circle cx="11.5" cy="29.5" r="1.8" />
      <circle cx="17.5" cy="29.5" r="1.8" />
    </g>
    <Detalhe>
      <Bola cx={35} cy={35} r={8.5} />
    </Detalhe>
  </Base>
);

/** Agenda Professores: professor com a raquete na mao. */
export const IconeAgendaProfessores = (p: PropsDoIcone) => (
  <Base {...p}>
    <circle cx="16" cy="13" r="5.8" />
    <path d="M4.5 41v-4a9.5 9.5 0 0 1 9.5-9.5h4.2a9.5 9.5 0 0 1 9.5 9.5v4" />
    <Detalhe>
      <g transform="rotate(25 36 23)">
        <ellipse cx="36" cy="14" rx="6" ry="8" />
        <path d="M36 7.5v13M30.8 14h10.4" strokeWidth={1.8} />
        <path d="M36 22v14" strokeWidth={3.4} />
      </g>
    </Detalhe>
  </Base>
);

/** Financeiro: duas cedulas, a da frente com o cifrao. */
export const IconeFinanceiroMosaico = (p: PropsDoIcone) => (
  <Base {...p}>
    <Detalhe>
      <path d="M10 17v-4a3 3 0 0 1 3-3h27a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3h-1" />
    </Detalhe>
    <rect x="5" y="17" width="34" height="21" rx="3" />
    <path d="M22 20.8v13.4" />
    <path d="M25.6 24c-.7-1.3-2-2-3.7-2-2.1 0-3.6 1.1-3.6 2.7 0 1.7 1.6 2.4 3.7 2.9 2.2.5 3.8 1.3 3.8 3.1 0 1.7-1.6 2.8-3.8 2.8-1.9 0-3.4-.8-4.1-2.2" />
    <g fill="currentColor" stroke="none">
      <circle cx="10" cy="27.5" r="1.6" />
      <circle cx="34" cy="27.5" r="1.6" />
    </g>
  </Base>
);

/** Estoque: tres caixas empilhadas (a de cima no segundo tom). */
export const IconeEstoqueMosaico = (p: PropsDoIcone) => (
  <Base {...p}>
    <Detalhe>
      <path d="M15 25V12a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13" />
      <path d="M21 10v5.5h6V10" strokeWidth={2.2} />
    </Detalhe>
    <rect x="5" y="25" width="18" height="15" rx="2" />
    <rect x="25" y="25" width="18" height="15" rx="2" />
    <path d="M11 25v5.5h6V25M31 25v5.5h6V25" strokeWidth={2.2} />
  </Base>
);

/** Histórico: relogio com a seta voltando no tempo. */
export const IconeHistoricoMosaico = (p: PropsDoIcone) => (
  <Base {...p}>
    <path d="M9.5 24A15 15 0 1 1 14.4 35" />
    <path d="M4.8 19.6 9.5 24.6l4.9-4.6" />
    <Detalhe>
      <path d="M25 15v9.5l6.5 4" />
    </Detalhe>
    <circle cx="25" cy="24.5" r="1.6" fill="currentColor" stroke="none" />
  </Base>
);

/** Clientes: duas pessoas (a de tras no segundo tom). */
export const IconeClientes = (p: PropsDoIcone) => (
  <Base {...p}>
    <Detalhe>
      <circle cx="32.5" cy="13.5" r="5.2" />
      <path d="M43.5 38v-3a8.5 8.5 0 0 0-7-8.4" />
    </Detalhe>
    <circle cx="18" cy="17" r="6.2" />
    <path d="M5 41v-3a9.5 9.5 0 0 1 9.5-9.5h7A9.5 9.5 0 0 1 31 38v3" />
  </Base>
);

/** Professores: prancheta de treino com o apito. */
export const IconeProfessoresMosaico = (p: PropsDoIcone) => (
  <Base {...p}>
    <path d="M14 9h-3a3 3 0 0 0-3 3v25a3 3 0 0 0 3 3h16" />
    <path d="M26 9h3a3 3 0 0 1 3 3v14" />
    <rect x="14" y="5.5" width="12" height="6.5" rx="2" />
    <path d="M13.5 19.5h13M13.5 25.5h11M13.5 31.5h7" />
    <Detalhe>
      <circle cx="35" cy="35.5" r="7" />
      <path d="M35 28.5h10v5.5h-3.5" />
      <circle cx="35" cy="35.5" r="2" fill="currentColor" stroke="none" />
    </Detalhe>
  </Base>
);

/** Configurações: engrenagem. */
export const IconeConfiguracoesMosaico = (p: PropsDoIcone) => (
  <Base {...p}>
    <path d="M20.14 10.54L21.43 5.68A18.5 18.5 0 0 1 26.57 5.68L27.86 10.54A14 14 0 0 1 30.79 11.76L35.13 9.23A18.5 18.5 0 0 1 38.77 12.87L36.24 17.21A14 14 0 0 1 37.46 20.14L42.32 21.43A18.5 18.5 0 0 1 42.32 26.57L37.46 27.86A14 14 0 0 1 36.24 30.79L38.77 35.13A18.5 18.5 0 0 1 35.13 38.77L30.79 36.24A14 14 0 0 1 27.86 37.46L26.57 42.32A18.5 18.5 0 0 1 21.43 42.32L20.14 37.46A14 14 0 0 1 17.21 36.24L12.87 38.77A18.5 18.5 0 0 1 9.23 35.13L11.76 30.79A14 14 0 0 1 10.54 27.86L5.68 26.57A18.5 18.5 0 0 1 5.68 21.43L10.54 20.14A14 14 0 0 1 11.76 17.21L9.23 12.87A18.5 18.5 0 0 1 12.87 9.23L17.21 11.76A14 14 0 0 1 20.14 10.54Z" />
    <Detalhe>
      <circle cx="24" cy="24" r="5.8" />
    </Detalhe>
  </Base>
);

/** Ranking: podio com a estrela do primeiro lugar. */
export const IconeRankingMosaico = (p: PropsDoIcone) => (
  <Base {...p}>
    <path d="M17 41V24.5h14V41M4.5 41V31h12.5M31 34h12.5v7M3 41h42" />
    <path d="M22.4 29.4 24.6 28v8" strokeWidth={2.2} />
    <Detalhe>
      <path d="M24 5L25.88 9.91L31.13 10.18L27.04 13.49L28.41 18.57L24 15.7L19.59 18.57L20.96 13.49L16.87 10.18L22.12 9.91Z" />
    </Detalhe>
  </Base>
);

/** Torneio: chave de confrontos que termina na taca. */
export const IconeTorneio = (p: PropsDoIcone) => (
  <Base {...p}>
    <path d="M3 7h10v10H3M3 31h10v10H3M13 12h6M13 36h6M19 12v24M19 24h4" />
    <Detalhe>
      <path d="M27.5 13h15v5.5a7.5 7.5 0 0 1-15 0z" />
      <path d="M27.5 15.5H25a3.2 3.2 0 0 0 3.4 5.2M42.5 15.5H45a3.2 3.2 0 0 1-3.4 5.2" strokeWidth={2.4} />
      <path d="M35 26v6M30 34h10" />
    </Detalhe>
  </Base>
);

/** LAP: raquete com duas bolas. */
export const IconeLap = (p: PropsDoIcone) => (
  <Base {...p}>
    <g transform="rotate(-38 24 24)">
      <ellipse cx="24" cy="13.5" rx="8.5" ry="10.5" />
      <path d="M20.6 5.6v15.8M27.4 5.6v15.8M16.4 10.5h15.2M16.4 16.5h15.2" strokeWidth={1.8} />
      <path d="M20.6 23.4 24 28l3.4-4.6" />
      <path d="M24 28v14" strokeWidth={3.6} />
    </g>
    <Detalhe>
      <Bola cx={10.5} cy={36} r={6} />
    </Detalhe>
    <Detalhe>
      <Bola cx={23} cy={40.5} r={4.6} />
    </Detalhe>
  </Base>
);

/** Site: globo. */
export const IconeSite = (p: PropsDoIcone) => (
  <Base {...p}>
    <circle cx="24" cy="24" r="17" />
    <Detalhe>
      <ellipse cx="24" cy="24" rx="7.5" ry="17" />
      <path d="M7 24h34M9.6 15.5h28.8M9.6 32.5h28.8" />
    </Detalhe>
  </Base>
);

/** Icone de cada atalho do mosaico. */
export const ICONE_DO_ATALHO: Record<IdDoAtalho, ComponentType<PropsDoIcone>> = {
  diaria: IconeDiaria,
  "agenda-professores": IconeAgendaProfessores,
  financeiro: IconeFinanceiroMosaico,
  estoque: IconeEstoqueMosaico,
  historico: IconeHistoricoMosaico,
  clientes: IconeClientes,
  professores: IconeProfessoresMosaico,
  configuracoes: IconeConfiguracoesMosaico,
  ranking: IconeRankingMosaico,
  torneio: IconeTorneio,
  lap: IconeLap,
  site: IconeSite,
};

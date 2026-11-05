import { BRANCO, PALETA } from "@/lib/paleta";
import { BolaDeTenis } from "./BolaDeTenis";

/**
 * Fundo do login: um pedaco de quadra de saibro visto de cima, desenhado em
 * codigo (inspirado na foto que a equipe trouxe, sem usar a foto, que tem
 * direito autoral). Leve e sem imagem: funciona offline.
 *
 * Camadas, de baixo para cima:
 *  1. o saibro: laranja escuro da paleta, com luz no meio;
 *  2. o grao: pontinhos claros e escuros (ruido SVG em ladrilho repetido);
 *  3. a linha branca em "T" (linha central de saque encontrando a linha de
 *     saque), com a borda irregular de po e um pouco de po espalhado;
 *  4. a bola amarela encostada no "T", com a sombra comprida do sol;
 *  5. vinheta escura nas bordas.
 *
 * O ponto do "T" fica a esquerda do cartao no tablet e no computador e perto
 * do pe da tela no celular (variaveis --tx e --ty).
 */

/** "#A8390A" -> [r, g, b] de 0 a 1 (para as matrizes de cor do SVG). */
function canais(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) * 1000) / 1000) as [
    number,
    number,
    number,
  ];
}

/** "#A8390A" + 0.5 -> "rgba(168, 57, 10, 0.5)". */
function comAlfa(hex: string, alfa: number): string {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

/**
 * Pontinhos do saibro: um filtro de ruido gera os graos claros (po de
 * tijolo) e outro os escuros. A matriz pinta tudo de uma cor e usa o ruido
 * como transparencia, cortando os valores do meio (sobra so o grao).
 */
function emUrl(svg: string): string {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\n/g, ""))}")`;
}

function ladrilhoDeGrao(): string {
  const [cr, cg, cb] = canais(PALETA.saibro[300]);
  const [er, eg, eb] = canais(PALETA.saibro[950]);
  return emUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'>
<filter id='c' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>
<feTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='2' seed='4' stitchTiles='stitch'/>
<feColorMatrix values='0 0 0 0 ${cr} 0 0 0 0 ${cg} 0 0 0 0 ${cb} 6 0 0 0 -3.55'/>
</filter>
<filter id='e' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>
<feTurbulence type='fractalNoise' baseFrequency='0.58' numOctaves='2' seed='11' stitchTiles='stitch'/>
<feColorMatrix values='0 0 0 0 ${er} 0 0 0 0 ${eg} 0 0 0 0 ${eb} -6 0 0 0 3.15'/>
</filter>
<rect width='100%' height='100%' filter='url(#e)' opacity='0.8'/>
<rect width='100%' height='100%' filter='url(#c)' opacity='0.75'/>
</svg>`);
}

/** Manchas largas e suaves (o saibro nunca e de uma cor so: varrido, pisado, molhado). */
function ladrilhoDeManchas(): string {
  const [er, eg, eb] = canais(PALETA.saibro[900]);
  return emUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='720' height='720'>
<filter id='m' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>
<feTurbulence type='fractalNoise' baseFrequency='0.006' numOctaves='3' seed='2' stitchTiles='stitch'/>
<feColorMatrix values='0 0 0 0 ${er} 0 0 0 0 ${eg} 0 0 0 0 ${eb} -1.6 0 0 0 0.95'/>
</filter>
<rect width='100%' height='100%' filter='url(#m)' opacity='0.5'/>
</svg>`);
}

const GRAO = ladrilhoDeGrao();
const MANCHAS = ladrilhoDeManchas();

/** Ids fixos dos filtros (so existe um login na tela por vez). */
const FILTRO_LINHA = "rt-login-linha";
const FILTRO_PO = "rt-login-po";

/**
 * Filtros da linha pintada: a borda sai irregular (deslocada por ruido fino,
 * como po) e o miolo ganha furinhos onde o saibro aparece por baixo.
 */
function FiltrosDaLinha() {
  return (
    <svg aria-hidden="true" focusable="false" className="absolute h-0 w-0">
      <defs>
        <filter id={FILTRO_LINHA} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves={2} seed={3} result="ruido" />
          <feDisplacementMap in="SourceGraphic" in2="ruido" scale={13} xChannelSelector="R" yChannelSelector="G" result="borda" />
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={9} result="grao" />
          <feColorMatrix
            in="grao"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -5 0 0 0 3.75"
            result="furos"
          />
          <feComposite in="borda" in2="furos" operator="in" />
        </filter>
        <filter id={FILTRO_PO} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} seed={21} result="grao" />
          <feColorMatrix
            in="grao"
            type="matrix"
            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  5.5 0 0 0 -3.3"
            result="pontos"
          />
          <feComposite in="pontos" in2="SourceAlpha" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

export function FundoDeSaibro() {
  const linha = { backgroundColor: BRANCO, filter: `url(#${FILTRO_LINHA})` } as const;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [--lt:1.75rem] [--tx:22%] [--ty:calc(100%-4.5rem)] md:[--lt:2.5rem] md:[--tx:calc(50%-23rem)] md:[--ty:78%]"
    >
      <FiltrosDaLinha />

      {/* 1 e 2. Saibro com luz no meio e o grao por cima. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: PALETA.saibro[700],
          backgroundImage: `${GRAO}, ${MANCHAS}, radial-gradient(120% 90% at 55% 40%, ${PALETA.saibro[600]} 0%, ${PALETA.saibro[700]} 60%, ${PALETA.saibro[800]} 100%)`,
          backgroundSize: "260px 260px, 720px 720px, 100% 100%",
        }}
      />

      {/* 3. Linha branca em "T": a central de saque desce ate a linha de saque. */}
      <div
        className="absolute top-[-2rem] left-[calc(var(--tx)-var(--lt)/2)] h-[calc(var(--ty)+2rem)] w-[var(--lt)] opacity-90"
        style={linha}
      />
      <div
        className="absolute left-[-2rem] right-[-2rem] top-[var(--ty)] h-[var(--lt)] opacity-90"
        style={linha}
      />
      {/* Po branco espalhado logo abaixo da linha de saque. */}
      <div
        className="absolute left-0 right-0 top-[calc(var(--ty)+var(--lt))] h-[calc(var(--lt)*1.4)] opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        style={{ backgroundColor: BRANCO, filter: `url(#${FILTRO_PO})` }}
      />

      {/* 4. A bola encostada no "T", com a sombra comprida para baixo e a esquerda. */}
      <div className="absolute left-[calc(var(--tx)+var(--lt)/2+0.15rem)] top-[calc(var(--ty)-3.3rem)] h-12 w-12 md:top-[calc(var(--ty)-4.6rem)] md:h-[4.25rem] md:w-[4.25rem]">
        <span
          className="absolute left-1/2 top-[70%] h-[260%] w-[78%] origin-top -translate-x-1/2 rotate-[38deg] rounded-[50%] blur-[5px]"
          style={{
            backgroundImage: `linear-gradient(to bottom, ${comAlfa(PALETA.saibro[950], 0.62)}, ${comAlfa(PALETA.saibro[950], 0.18)} 80%, transparent)`,
          }}
        />
        <span
          className="relative block h-full w-full"
          style={{ filter: `drop-shadow(0 2px 2px ${comAlfa(PALETA.saibro[950], 0.45)})` }}
        >
          <BolaDeTenis className="h-full w-full" />
        </span>
      </div>

      {/* 5. Vinheta: bordas mais escuras, o olho vai para o meio. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(130% 100% at 50% 45%, transparent 55%, ${comAlfa(PALETA.saibro[950], 0.5)} 100%)`,
        }}
      />
    </div>
  );
}

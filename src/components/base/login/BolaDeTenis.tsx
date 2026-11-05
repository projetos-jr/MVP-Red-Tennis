import { useId } from "react";
import { BRANCO, PALETA } from "@/lib/paleta";

/**
 * Bola de tenis desenhada (SVG proprio, sem imagem de terceiros): feltro
 * amarelo com luz no alto a esquerda, pelinho granulado e as duas costuras
 * brancas. Decorativa (aria-hidden): quem usa da o nome ao botao.
 *
 * `apagada`: bola cinza (botao desabilitado), como o interruptor desligado.
 */
export function BolaDeTenis({
  className = "h-16 w-16",
  apagada = false,
}: {
  className?: string;
  apagada?: boolean;
}) {
  // useId pode trazer ":" ou "«»": tira tudo que nao serve num id de SVG.
  const id = `bola${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const cores = apagada
    ? { luz: PALETA.areia[50], meio: PALETA.areia[200], borda: PALETA.areia[400], contorno: PALETA.areia[500], pelo: PALETA.areia[600] }
    : { luz: PALETA.bola[100], meio: PALETA.bola[300], borda: PALETA.bola[500], contorno: PALETA.bola[700], pelo: PALETA.bola[800] };

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <radialGradient id={`${id}-feltro`} cx="36%" cy="30%" r="74%">
          <stop offset="0%" stopColor={cores.luz} />
          <stop offset="42%" stopColor={cores.meio} />
          <stop offset="86%" stopColor={cores.meio} />
          <stop offset="100%" stopColor={cores.borda} />
        </radialGradient>
        {/* Pelinho do feltro: pontinhos escuros bem leves, so dentro da bola. */}
        <filter id={`${id}-pelo`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves={2} seed={5} result="ruido" />
          <feColorMatrix
            in="ruido"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.4 0 0 0 1.35"
            result="pontos"
          />
          <feComposite in="pontos" in2="SourceAlpha" operator="in" />
        </filter>
        <clipPath id={`${id}-dentro`}>
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>

      <circle cx="50" cy="50" r="47" fill={`url(#${id}-feltro)`} />
      <g clipPath={`url(#${id}-dentro)`}>
        <rect width="100" height="100" fill={cores.pelo} filter={`url(#${id}-pelo)`} opacity={0.16} />
        {/* Costuras: sombra fina e a faixa branca por cima. */}
        <path
          d="M9 20c17 14 24 22 24 30S26 66 9 80M91 20C74 34 67 42 67 50s7 16 24 30"
          fill="none"
          stroke={cores.contorno}
          strokeOpacity={0.35}
          strokeWidth={8}
          strokeLinecap="round"
          transform="translate(0.8 1.2)"
        />
        <path
          d="M9 20c17 14 24 22 24 30S26 66 9 80M91 20C74 34 67 42 67 50s7 16 24 30"
          fill="none"
          stroke={BRANCO}
          strokeOpacity={0.95}
          strokeWidth={5.5}
          strokeLinecap="round"
        />
        {/* Brilho do sol no alto. */}
        <ellipse cx="34" cy="26" rx="15" ry="9" fill={BRANCO} opacity={0.28} transform="rotate(-28 34 26)" />
      </g>
      <circle cx="50" cy="50" r="47" fill="none" stroke={cores.contorno} strokeWidth={2} />
    </svg>
  );
}

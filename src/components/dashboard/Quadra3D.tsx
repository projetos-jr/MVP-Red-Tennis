import type { PisoQuadra } from "@/lib/banco/tipos";

interface Quadra3DProps {
  /** Numero da quadra ou "P" para o paredão. */
  rotulo: string;
  /** Ocupacao do dia (0 a 1) — quanto maior, mais escuro fica o piso. */
  taxa: number;
  /** Saibro (laranja) ou cimento (cinza-azulado). */
  piso?: PisoQuadra;
  /** O paredão ganha uma parede levantada no fundo em vez de uma quadra completa. */
  paredao?: boolean;
  /** Inclinacao da perspectiva, em graus. */
  inclinacao?: number;
  className?: string;
}

/** Interpola dois valores hexadecimais de cor. */
function misturar(inicio: string, fim: string, t: number): string {
  const p = Math.min(1, Math.max(0, t));
  const ler = (hex: string, i: number) =>
    parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const canal = (i: number) =>
    Math.round(ler(inicio, i) + (ler(fim, i) - ler(inicio, i)) * p);
  return `rgb(${canal(0)}, ${canal(1)}, ${canal(2)})`;
}

/**
 * Escala de ocupacao do piso.
 * Vazia = piso claro; lotada = piso escuro e saturado.
 *
 * Na pratica a ocupacao diaria fica entre ~20% e ~85%, entao a faixa util e
 * reesticada para 0..1 — sem isso as quadras ficariam quase iguais entre si.
 */
export function corDaQuadra(taxa: number, piso: PisoQuadra = "saibro") {
  const t = Math.min(1, Math.max(0, (taxa - 0.12) / 0.76));

  if (piso === "cimento") {
    return {
      clara: misturar("#DFE6EB", "#5C6B78", t),
      media: misturar("#C3CFD8", "#44515C", t),
      escura: misturar("#A5B4C0", "#2B343C", t),
    };
  }

  return {
    clara: misturar("#F7D2B0", "#9A4A1B", t),
    media: misturar("#EFA771", "#7C3714", t),
    escura: misturar("#D98146", "#4E2410", t),
  };
}

/**
 * Quadra desenhada em perspectiva com CSS 3D.
 *
 * Elemento visual central do Dashboard: o tom do piso escurece
 * progressivamente conforme a ocupacao do dia aumenta. A quadra de cimento
 * usa a mesma escala, em cinza-azulado.
 */
export function Quadra3D({
  rotulo,
  taxa,
  piso = "saibro",
  paredao = false,
  inclinacao = 62,
  className = "",
}: Quadra3DProps) {
  const cor = corDaQuadra(taxa, piso);
  const cimento = piso === "cimento";
  const linha = cimento
    ? "rgba(255, 255, 255, 0.95)"
    : "rgba(255, 250, 244, 0.92)";

  return (
    <div
      className={`relative [perspective:820px] [perspective-origin:50%_40%] ${className}`}
      style={{ aspectRatio: "10.97 / 12.6" }}
    >
      <div
        className="absolute inset-x-0 bottom-0 transition-transform duration-500 ease-out"
        style={{
          aspectRatio: "10.97 / 23.77",
          transform: `rotateX(${inclinacao}deg)`,
          transformStyle: "preserve-3d",
          transformOrigin: "50% 100%",
        }}
      >
        {/* Piso de saibro */}
        <div
          className="absolute inset-0 rounded-[6px] shadow-quadra"
          style={{
            background: `linear-gradient(180deg, ${cor.clara} 0%, ${cor.media} 48%, ${cor.escura} 100%)`,
          }}
        >
          {/* Textura do pó de saibro */}
          <div
            className={`absolute inset-0 rounded-[6px] mix-blend-overlay ${
              cimento ? "opacity-[0.12]" : "opacity-[0.22]"
            }`}
            style={{
              backgroundImage: cimento
                ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 3px)"
                : "repeating-linear-gradient(92deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 5px), repeating-linear-gradient(2deg, rgba(0,0,0,0.35) 0 1px, transparent 1px 7px)",
            }}
          />

          {paredao ? (
            <>
              {/* Area de treino do paredão: uma marcacao simples no piso */}
              <div
                className="absolute"
                style={{
                  inset: "14% 16%",
                  border: `2px solid ${linha}`,
                  borderRadius: 2,
                }}
              />
              <div
                className="absolute left-[16%] right-[16%]"
                style={{ top: "46%", height: 2, background: linha }}
              />
            </>
          ) : (
            <>
              {/* Marcacoes oficiais da quadra */}
              <div
                className="absolute"
                style={{
                  inset: "7% 9%",
                  border: `2px solid ${linha}`,
                  borderRadius: 2,
                }}
              />
              {/* Laterais de simples */}
              <div
                className="absolute"
                style={{
                  top: "7%",
                  bottom: "7%",
                  left: "21.5%",
                  width: 2,
                  background: linha,
                }}
              />
              <div
                className="absolute"
                style={{
                  top: "7%",
                  bottom: "7%",
                  right: "21.5%",
                  width: 2,
                  background: linha,
                }}
              />
              {/* Linhas de saque */}
              <div
                className="absolute left-[21.5%] right-[21.5%]"
                style={{ top: "29%", height: 2, background: linha }}
              />
              <div
                className="absolute left-[21.5%] right-[21.5%]"
                style={{ bottom: "29%", height: 2, background: linha }}
              />
              {/* Linha central de saque */}
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: "29%", bottom: "29%", width: 2, background: linha }}
              />
              {/* Rede */}
              <div
                className="absolute left-[4%] right-[4%] top-1/2 -translate-y-1/2"
                style={{
                  height: 3,
                  background:
                    "linear-gradient(90deg, rgba(60,52,46,0.95), rgba(250,246,240,0.95), rgba(60,52,46,0.95))",
                  boxShadow: "0 2px 6px rgba(60, 30, 12, 0.45)",
                }}
              />
            </>
          )}

          {/* Numero pintado no piso — esticado para compensar a perspectiva */}
          <span
            className="absolute inset-0 flex items-center justify-center select-none"
            style={{ transform: "scaleY(1.75)" }}
          >
            <span
              className="text-[2.6rem] font-black leading-none tracking-tight sm:text-5xl"
              style={{
                color: "rgba(255, 251, 245, 0.9)",
                textShadow: "0 2px 10px rgba(70, 32, 12, 0.55)",
              }}
            >
              {rotulo}
            </span>
          </span>
        </div>

        {/* Parede do paredão, levantada em 90° no fundo da area */}
        {paredao && (
          <div
            className="absolute left-0 right-0 top-0"
            style={{
              height: "34%",
              transform: "rotateX(-90deg)",
              transformOrigin: "50% 0%",
              background:
                "linear-gradient(180deg, #8C4622 0%, #6E3419 55%, #5A2A13 100%)",
              borderRadius: "4px 4px 0 0",
              boxShadow: "0 -10px 24px -8px rgba(60, 28, 10, 0.6)",
            }}
          >
            <div
              className="absolute inset-x-[10%] bottom-[18%] h-[3px]"
              style={{ background: "rgba(255, 250, 244, 0.85)" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

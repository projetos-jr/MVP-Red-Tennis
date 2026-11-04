import type { PisoQuadra } from "@/lib/banco/tipos";
import { BRANCO, PALETA, PISO } from "@/lib/paleta";

interface Quadra3DProps {
  /** Numero da quadra ou "P" para o paredão. */
  rotulo: string;
  /** Saibro (laranja vivo) ou cimento (azul da Quadra 1), como no sistema antigo. */
  piso?: PisoQuadra;
  /** O paredão ganha uma parede levantada no fundo em vez de uma quadra completa. */
  paredao?: boolean;
  /** Tem gente jogando agora: uma bola amarela aparece no piso. */
  emJogo?: boolean;
  /** Quadra bloqueada ou arena fechada: o piso fica apagado. */
  apagada?: boolean;
  /** Inclinacao da perspectiva, em graus. */
  inclinacao?: number;
  /** Tamanho do numero pintado no piso (classe de fonte). */
  classeDoNumero?: string;
  className?: string;
}

/** "#C8460B" + 0.5 -> "rgba(200, 70, 11, 0.5)" (cores sempre da paleta). */
function comAlfa(hex: string, alfa: number): string {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

const SOMBRA_DO_NUMERO = `0 2px 10px ${comAlfa(PALETA.saibro[950], 0.55)}`;
const REDE = `linear-gradient(90deg, ${comAlfa(PALETA.areia[800], 0.95)}, ${comAlfa(BRANCO, 0.95)}, ${comAlfa(PALETA.areia[800], 0.95)})`;
const SOMBRA_DA_REDE = `0 2px 6px ${comAlfa(PALETA.saibro[950], 0.45)}`;
const PAREDE = `linear-gradient(180deg, ${PALETA.saibro[800]} 0%, ${PALETA.saibro[900]} 55%, ${PALETA.saibro[950]} 100%)`;

/**
 * Quadra desenhada em perspectiva com CSS 3D (faixa das quadras do Início).
 *
 * Cores vivas e fixas por piso (`PISO` em `lib/paleta.ts`): saibro laranja e
 * cimento azul, com as linhas brancas oficiais. E decorativa (aria-hidden):
 * quem usa a quadra descreve a situacao em texto.
 */
export function Quadra3D({
  rotulo,
  piso = "saibro",
  paredao = false,
  emJogo = false,
  apagada = false,
  inclinacao = 58,
  classeDoNumero = "text-[2.6rem] sm:text-5xl",
  className = "",
}: Quadra3DProps) {
  const cor = PISO[piso];
  const cimento = piso === "cimento";
  const linha = cor.linha;

  return (
    <div
      aria-hidden="true"
      className={`relative [perspective:820px] [perspective-origin:50%_40%] ${
        apagada ? "saturate-[0.35] brightness-90" : ""
      } ${className}`}
      style={{ aspectRatio: "10.97 / 12.6" }}
    >
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          aspectRatio: "10.97 / 23.77",
          transform: `rotateX(${inclinacao}deg)`,
          transformStyle: "preserve-3d",
          transformOrigin: "50% 100%",
        }}
      >
        {/* Piso */}
        <div
          className="absolute inset-0 rounded-[6px] shadow-quadra"
          style={{
            background: `linear-gradient(180deg, ${cor.clara} 0%, ${cor.media} 48%, ${cor.escura} 100%)`,
          }}
        >
          {/* Textura: po de saibro ou o liso do cimento */}
          <div
            className={`absolute inset-0 rounded-[6px] mix-blend-overlay ${
              cimento ? "opacity-[0.12]" : "opacity-[0.22]"
            }`}
            style={{
              backgroundImage: cimento
                ? `repeating-linear-gradient(45deg, ${comAlfa(BRANCO, 0.35)} 0 1px, transparent 1px 3px)`
                : `repeating-linear-gradient(92deg, ${comAlfa(BRANCO, 0.5)} 0 1px, transparent 1px 5px), repeating-linear-gradient(2deg, ${comAlfa(PALETA.areia[900], 0.35)} 0 1px, transparent 1px 7px)`,
            }}
          />

          {paredao ? (
            <>
              {/* Area de treino do paredão: uma marcacao simples no piso */}
              <div
                className="absolute"
                style={{ inset: "14% 16%", border: `2px solid ${linha}`, borderRadius: 2 }}
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
                style={{ inset: "7% 9%", border: `2px solid ${linha}`, borderRadius: 2 }}
              />
              {/* Laterais de simples */}
              <div
                className="absolute"
                style={{ top: "7%", bottom: "7%", left: "21.5%", width: 2, background: linha }}
              />
              <div
                className="absolute"
                style={{ top: "7%", bottom: "7%", right: "21.5%", width: 2, background: linha }}
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
                style={{ height: 3, background: REDE, boxShadow: SOMBRA_DA_REDE }}
              />
            </>
          )}

          {/* Bola em jogo: a quadra esta sendo usada agora */}
          {emJogo && (
            <span
              className="absolute rounded-full"
              style={{
                left: paredao ? "60%" : "62%",
                top: paredao ? "24%" : "36%",
                width: "11%",
                aspectRatio: "1",
                background: PALETA.bola[300],
                boxShadow: `0 0 0 2px ${comAlfa(PALETA.bola[100], 0.5)}, 0 3px 6px ${comAlfa(PALETA.areia[900], 0.45)}`,
              }}
            />
          )}

          {/* Numero pintado na metade de perto (fora da rede), esticado para
              compensar a perspectiva */}
          <span
            className="absolute inset-x-0 flex select-none items-center justify-center"
            style={{ top: "50%", bottom: paredao ? "14%" : "27%", transform: "scaleY(1.75)" }}
          >
            <span
              className={`font-display font-bold leading-none tracking-tight ${classeDoNumero}`}
              style={{ color: comAlfa(BRANCO, 0.92), textShadow: SOMBRA_DO_NUMERO }}
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
              background: PAREDE,
              borderRadius: "4px 4px 0 0",
              boxShadow: `0 -10px 24px -8px ${comAlfa(PALETA.saibro[950], 0.6)}`,
            }}
          >
            <div
              className="absolute inset-x-[10%] bottom-[18%] h-[3px]"
              style={{ background: comAlfa(BRANCO, 0.85) }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

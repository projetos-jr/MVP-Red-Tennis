"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { misturar, textoLegivelSobre } from "@/lib/cores";
import { BRANCO, PALETA } from "@/lib/paleta";
import { corAvatar, iniciais } from "@/lib/theme";

/**
 * Raquete de madeira com a foto do jogador no centro da cabeca (pedido do
 * dono da arena para a piramide do ranking). Desenho proprio em SVG, sem
 * biblioteca nem imagem de terceiros, inspirado nas raquetes antigas de
 * madeira: aro laminado, encordoamento cruzado, garganta em "V", cabo com
 * grip de couro enrolado e tampa. A posicao vai numa bolinha de tenis
 * apoiada no aro. O lider (1o) tem aro de saibro vivo, grip amarelo-bola e
 * uma coroa discreta.
 *
 * Medidas em unidades do desenho (largura 120); o tamanho na tela vem de
 * `largura` (CSS), e a altura acompanha.
 */

// --- Cores (todas da paleta; misturas feitas aqui, sem hex solto) ---------
const MADEIRA = {
  aro: misturar(PALETA.saibro[300], PALETA.bola[200], 0.4),
  laminado: misturar(PALETA.saibro[600], PALETA.areia[500], 0.35),
  brilho: misturar(PALETA.saibro[100], BRANCO, 0.4),
  contorno: PALETA.saibro[900],
  grip: PALETA.saibro[900],
  gripListra: PALETA.saibro[950],
  gripBrilho: PALETA.saibro[800],
  tampa: PALETA.saibro[950],
  colar: PALETA.bola[300],
  /** Decalque em "V" na garganta: o vermelho do letreiro da arena, so como enfeite. */
  decalque: PALETA.tijolo[600],
};

const LIDER = {
  aro: PALETA.saibro[500],
  laminado: PALETA.saibro[700],
  brilho: PALETA.saibro[300],
  contorno: PALETA.saibro[900],
  grip: PALETA.bola[300],
  gripListra: PALETA.bola[500],
  gripBrilho: PALETA.bola[100],
  tampa: PALETA.saibro[900],
  colar: BRANCO,
  decalque: PALETA.bola[300],
};

const CORDA = PALETA.areia[400];
const BOLA = { fundo: PALETA.bola[300], borda: PALETA.bola[600], costura: BRANCO, numero: PALETA.areia[900] };

// --- Geometria ------------------------------------------------------------
const CX = 60;
const CY = 68;
/** Linha do meio do aro. */
const ARO = { rx: 48, ry: 59, espessura: 9 };
/** Area das cordas (borda de dentro do aro). */
const CORDAS = { rx: ARO.rx - ARO.espessura / 2, ry: ARO.ry - ARO.espessura / 2 };
const FOTO_R = 31;
const ESPACO_DAS_CORDAS = 6;

/** Ponto do aro no angulo `graus` (0 = topo, sentido horario). */
function pontoDoAro(graus: number): [number, number] {
  const rad = (graus * Math.PI) / 180;
  return [CX + ARO.rx * Math.sin(rad), CY - ARO.ry * Math.cos(rad)];
}

/** Encordoamento: linhas verticais e horizontais cortadas na borda das cordas. */
const CAMINHO_DAS_CORDAS = (() => {
  const partes: string[] = [];
  for (let d = -Math.floor(CORDAS.rx / ESPACO_DAS_CORDAS) * ESPACO_DAS_CORDAS; d <= CORDAS.rx; d += ESPACO_DAS_CORDAS) {
    const meia = CORDAS.ry * Math.sqrt(Math.max(0, 1 - (d / CORDAS.rx) ** 2));
    if (meia > 1) partes.push(`M${(CX + d).toFixed(1)} ${(CY - meia).toFixed(1)}V${(CY + meia).toFixed(1)}`);
  }
  for (let d = -Math.floor(CORDAS.ry / ESPACO_DAS_CORDAS) * ESPACO_DAS_CORDAS; d <= CORDAS.ry; d += ESPACO_DAS_CORDAS) {
    const meia = CORDAS.rx * Math.sqrt(Math.max(0, 1 - (d / CORDAS.ry) ** 2));
    if (meia > 1) partes.push(`M${(CX - meia).toFixed(1)} ${(CY + d).toFixed(1)}H${(CX + meia).toFixed(1)}`);
  }
  return partes.join("");
})();

// Garganta: dois bracos saem do aro e se juntam no cabo.
const [ESQ_X, ESQ_Y] = pontoDoAro(212);
const [DIR_X, DIR_Y] = pontoDoAro(148);
const TOPO_DO_CABO = 166;
const BRACO_ESQUERDO = `M${ESQ_X.toFixed(1)} ${ESQ_Y.toFixed(1)}C${ESQ_X + 3} ${ESQ_Y + 20} 54 ${TOPO_DO_CABO - 16} 56.5 ${TOPO_DO_CABO}`;
const BRACO_DIREITO = `M${DIR_X.toFixed(1)} ${DIR_Y.toFixed(1)}C${DIR_X - 3} ${DIR_Y + 20} 66 ${TOPO_DO_CABO - 16} 63.5 ${TOPO_DO_CABO}`;
/** Cunha de madeira no fim do "V", onde os bracos se encontram, com um decalque em "V". */
const CUNHA = `M49.5 ${TOPO_DO_CABO - 21}Q60 ${TOPO_DO_CABO - 15} 70.5 ${TOPO_DO_CABO - 21}L62.5 ${TOPO_DO_CABO + 1}H57.5Z`;
const DECALQUE_DA_CUNHA = `M56 ${TOPO_DO_CABO - 15}L60 ${TOPO_DO_CABO - 8}L64 ${TOPO_DO_CABO - 15}`;

const GRIP = { x: 52.5, y: 178, largura: 15, altura: 40 };
const LISTRAS_DO_GRIP = (() => {
  const partes: string[] = [];
  const inclinacao = 4;
  for (let y = GRIP.y + 1; y + inclinacao <= GRIP.y + GRIP.altura - 0.5; y += 4.4) {
    partes.push(`M${GRIP.x} ${(y + inclinacao).toFixed(1)}L${GRIP.x + GRIP.largura} ${y.toFixed(1)}`);
  }
  return partes.join("");
})();
const FIM_DO_DESENHO = GRIP.y + GRIP.altura + 8;

// Bolinha com a posicao, apoiada no aro (em cima, a direita).
const [BOLA_X, BOLA_Y] = pontoDoAro(42);
const BOLA_R = 17;

/** Ids de SVG sem os caracteres especiais do useId. */
function idSeguro(id: string): string {
  return `raq${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function Desenho({
  alunoId,
  nome,
  fotoUrl,
  posicao,
  lider,
}: {
  alunoId: string;
  nome: string;
  fotoUrl?: string;
  posicao: number;
  lider: boolean;
}) {
  const base = idSeguro(useId());
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const cor = lider ? LIDER : MADEIRA;
  const corDasIniciais = corAvatar(alunoId);
  const topo = lider ? -22 : 0;
  const numero = String(posicao);

  return (
    <svg
      viewBox={`0 ${topo} 120 ${FIM_DO_DESENHO - topo}`}
      className="block h-auto w-full overflow-visible drop-shadow-md"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={`${base}-foto`}>
          <circle cx={CX} cy={CY} r={FOTO_R} />
        </clipPath>
      </defs>

      {/* Sombra suave no chao */}
      <ellipse cx={CX} cy={FIM_DO_DESENHO - 2.5} rx={20} ry={2.5} fill={PALETA.areia[900]} opacity={0.12} />

      {/* Garganta: cunha com decalque e os dois bracos (contorno escuro, madeira e laminado) */}
      <path d={CUNHA} fill={cor.aro} stroke={cor.contorno} strokeWidth={1} strokeLinejoin="round" />
      <g fill="none" strokeLinecap="round">
        <path d={BRACO_ESQUERDO} stroke={cor.contorno} strokeWidth={ARO.espessura + 1.6} />
        <path d={BRACO_DIREITO} stroke={cor.contorno} strokeWidth={ARO.espessura + 1.6} />
        <path d={BRACO_ESQUERDO} stroke={cor.aro} strokeWidth={ARO.espessura - 0.4} />
        <path d={BRACO_DIREITO} stroke={cor.aro} strokeWidth={ARO.espessura - 0.4} />
        <path d={BRACO_ESQUERDO} stroke={cor.laminado} strokeWidth={1.1} />
        <path d={BRACO_DIREITO} stroke={cor.laminado} strokeWidth={1.1} />
      </g>
      <path d={DECALQUE_DA_CUNHA} fill="none" stroke={cor.decalque} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />

      {/* Cabo de madeira, colar e grip de couro enrolado */}
      <rect x={54} y={TOPO_DO_CABO - 1} width={12} height={GRIP.y - TOPO_DO_CABO + 2} fill={cor.aro} stroke={cor.contorno} strokeWidth={0.9} />
      <rect x={53} y={GRIP.y - 5} width={14} height={4} rx={1} fill={cor.colar} stroke={cor.contorno} strokeWidth={0.8} />
      <rect x={GRIP.x} y={GRIP.y} width={GRIP.largura} height={GRIP.altura} rx={2.5} fill={cor.grip} stroke={cor.contorno} strokeWidth={0.9} />
      <path d={LISTRAS_DO_GRIP} fill="none" stroke={cor.gripListra} strokeWidth={1.5} />
      <path d={LISTRAS_DO_GRIP} fill="none" stroke={cor.gripBrilho} strokeWidth={0.5} transform="translate(0 1.4)" />
      <rect x={51} y={GRIP.y + GRIP.altura - 1} width={18} height={7} rx={3} fill={cor.tampa} stroke={cor.contorno} strokeWidth={0.8} />

      {/* Cordas (claras, cruzadas) */}
      <ellipse cx={CX} cy={CY} rx={CORDAS.rx} ry={CORDAS.ry} fill={BRANCO} fillOpacity={0.7} />
      <path d={CAMINHO_DAS_CORDAS} stroke={CORDA} strokeWidth={0.6} fill="none" />

      {/* Aro laminado */}
      <ellipse cx={CX} cy={CY} rx={ARO.rx} ry={ARO.ry} fill="none" stroke={cor.contorno} strokeWidth={ARO.espessura + 1.6} />
      <ellipse cx={CX} cy={CY} rx={ARO.rx} ry={ARO.ry} fill="none" stroke={cor.aro} strokeWidth={ARO.espessura - 0.4} />
      <ellipse cx={CX} cy={CY} rx={ARO.rx - 2.2} ry={ARO.ry - 2.2} fill="none" stroke={cor.brilho} strokeWidth={0.9} />
      <ellipse cx={CX} cy={CY} rx={ARO.rx + 0.4} ry={ARO.ry + 0.4} fill="none" stroke={cor.laminado} strokeWidth={1.1} />
      <ellipse cx={CX} cy={CY} rx={ARO.rx + 2.8} ry={ARO.ry + 2.8} fill="none" stroke={cor.laminado} strokeWidth={0.6} opacity={0.6} />

      {/* Foto (ou iniciais) no centro, com anel claro */}
      <circle cx={CX} cy={CY} r={FOTO_R + 1.6} fill={BRANCO} stroke={PALETA.areia[300]} strokeWidth={0.6} />
      {fotoUrl && !fotoFalhou ? (
        <image
          href={fotoUrl}
          x={CX - FOTO_R}
          y={CY - FOTO_R}
          width={FOTO_R * 2}
          height={FOTO_R * 2}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${base}-foto)`}
          onError={() => setFotoFalhou(true)}
        />
      ) : (
        <>
          <circle cx={CX} cy={CY} r={FOTO_R} fill={corDasIniciais} />
          <text
            x={CX}
            y={CY}
            textAnchor="middle"
            dominantBaseline="central"
            className="font-display"
            fontWeight={700}
            fontSize={24}
            fill={textoLegivelSobre(corDasIniciais)}
          >
            {iniciais(nome)}
          </text>
        </>
      )}
      <circle cx={CX} cy={CY} r={FOTO_R} fill="none" stroke={BRANCO} strokeWidth={2.4} />

      {/* Coroa do lider, discreta, sobre o aro */}
      {lider && (
        <g stroke={PALETA.saibro[800]} strokeWidth={1.3} strokeLinejoin="round">
          <path d="M45 4 L42.5 -12 L51.5 -4 L60 -18 L68.5 -4 L77.5 -12 L75 4 Z" fill={PALETA.bola[300]} />
          <path d="M45.5 0 H74.5" fill="none" stroke={PALETA.bola[600]} strokeWidth={1} />
          <circle cx={42.5} cy={-12} r={2.3} fill={PALETA.bola[300]} />
          <circle cx={60} cy={-18} r={2.6} fill={PALETA.bola[300]} />
          <circle cx={77.5} cy={-12} r={2.3} fill={PALETA.bola[300]} />
        </g>
      )}

      {/* Bolinha com a posicao */}
      <g>
        <circle cx={BOLA_X} cy={BOLA_Y} r={BOLA_R} fill={BOLA.fundo} stroke={BOLA.borda} strokeWidth={1} />
        <path
          d={`M${BOLA_X - BOLA_R * 0.78} ${BOLA_Y - BOLA_R * 0.62}Q${BOLA_X - BOLA_R * 0.35} ${BOLA_Y} ${BOLA_X - BOLA_R * 0.78} ${BOLA_Y + BOLA_R * 0.62}M${BOLA_X + BOLA_R * 0.78} ${BOLA_Y - BOLA_R * 0.62}Q${BOLA_X + BOLA_R * 0.35} ${BOLA_Y} ${BOLA_X + BOLA_R * 0.78} ${BOLA_Y + BOLA_R * 0.62}`}
          fill="none"
          stroke={BOLA.costura}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <text
          x={BOLA_X}
          y={BOLA_Y + 0.5}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-display"
          fontWeight={700}
          fontSize={numero.length > 1 ? 17 : 20}
          fill={BOLA.numero}
        >
          {numero}
        </text>
      </g>
    </svg>
  );
}

export type NivelDaRaquete = "topo" | "segunda" | "demais";

const TEXTO_DO_NOME: Record<NivelDaRaquete, string> = {
  topo: "text-2xl sm:text-3xl",
  segunda: "text-lg sm:text-xl",
  demais: "text-base sm:text-lg",
};
const TEXTO_DOS_PONTOS: Record<NivelDaRaquete, string> = {
  topo: "text-lg",
  segunda: "text-base",
  demais: "text-sm sm:text-base",
};

/** Uma raquete da piramide: desenho, nome e pontos. Clicar abre a ficha. */
export function RaqueteComFoto({
  alunoId,
  nome,
  fotoUrl,
  posicao,
  pontos,
  nivel,
  largura,
  detalhe,
}: {
  alunoId: string;
  nome: string;
  fotoUrl?: string;
  posicao: number;
  pontos: number;
  nivel: NivelDaRaquete;
  /** Largura da raquete em CSS (ex.: "clamp(5rem, 20cqi, 8rem)"). */
  largura: string;
  /** Complemento para leitores de tela (ex.: "Categoria B"). */
  detalhe?: string;
}) {
  const lider = posicao === 1;
  const rotulo = `${posicao}º lugar: ${nome}, ${pontos} ${pontos === 1 ? "ponto" : "pontos"}${detalhe ? `, ${detalhe}` : ""}. Abrir a ficha.`;
  return (
    <Link
      href={`/alunos/${alunoId}`}
      aria-label={rotulo}
      title={`${posicao}º · ${nome}`}
      className="group flex shrink-0 flex-col items-center rounded-2xl px-1 pb-2 pt-1 text-center focus-visible:bg-white/80"
      style={{ width: largura }}
    >
      <span className="block w-full motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:-rotate-2">
        <Desenho alunoId={alunoId} nome={nome} fotoUrl={fotoUrl} posicao={posicao} lider={lider} />
      </span>
      <span
        className={`mt-1.5 line-clamp-2 w-[calc(100%+0.5rem)] sm:w-[calc(100%+1rem)] font-display font-bold leading-tight text-areia-900 group-hover:text-saibro-700 ${TEXTO_DO_NOME[nivel]}`}
      >
        {nome}
      </span>
      <span className={`mt-0.5 tabular-nums text-areia-700 ${TEXTO_DOS_PONTOS[nivel]}`}>
        <strong className="font-bold text-areia-900">{pontos}</strong> {pontos === 1 ? "ponto" : "pontos"}
      </span>
    </Link>
  );
}

import type { Config } from "tailwindcss";
import { PALETA } from "./src/lib/paleta";

/**
 * As cores vem de `src/lib/paleta.ts` (fonte unica, com as regras de
 * contraste). Nomes: saibro (laranja, cor principal), tijolo (vermelho:
 * perigo e marca), areia (neutros), cimento (azul da Quadra 1), quadra
 * (verde) e bola (amarelo da bola de tenis).
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: PALETA,
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Titulos, numeros e rotulos grandes (estilo placar).
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(31, 29, 25, 0.04), 0 8px 24px -12px rgba(31, 29, 25, 0.18)",
        "card-hover":
          "0 2px 4px rgba(28, 27, 25, 0.06), 0 18px 40px -16px rgba(168, 57, 10, 0.4)",
        quadra: "0 28px 45px -22px rgba(61, 21, 6, 0.75)",
        ladrilho: "0 1px 0 rgba(255, 255, 255, 0.35) inset, 0 -3px 0 rgba(61, 21, 6, 0.28) inset, 0 10px 22px -12px rgba(168, 57, 10, 0.7)",
      },
      keyframes: {
        "conflito-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(196, 63, 47, 0.55)" },
          "50%": { boxShadow: "0 0 0 5px rgba(196, 63, 47, 0)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "conflito-pulse": "conflito-pulse 1.6s ease-in-out infinite",
        "fade-up": "fade-up 0.35s ease-out both",
        "fade-in": "fade-in 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

/**
 * Paleta derivada do logo da Red Tennis:
 *  - "saibro": laranja/terracota da quadra (cor primaria)
 *  - "tijolo": vermelho escuro do texto do logo (cor de acao/destaque)
 *  - "areia" : neutros quentes usados como base das telas
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        saibro: {
          50: "#FDF6F1",
          100: "#FAE8DA",
          200: "#F3CEAF",
          300: "#EAAD82",
          400: "#DF8B55",
          500: "#D2703A",
          600: "#B95A28",
          700: "#9A4720",
          800: "#7C391C",
          900: "#5E2C16",
          950: "#3A1B0D",
        },
        tijolo: {
          50: "#FDF3F2",
          100: "#FBE3E0",
          200: "#F6C4BE",
          300: "#EC9A90",
          400: "#DC6557",
          500: "#C43F2F",
          600: "#A32A1C",
          700: "#8A2118",
          800: "#6E1B14",
          900: "#521410",
        },
        areia: {
          50: "#FAF9F7",
          100: "#F4F1EC",
          200: "#E8E3DB",
          300: "#D6CEC2",
          400: "#B3A897",
          // Texto de apoio (datas, rótulos, legendas). Mais escuro que o do MVP
          // (#8C8172) para ter contraste de 4,5:1 sobre o branco e o fundo areia.
          500: "#776D5F",
          600: "#6B6255",
          700: "#4F483E",
          800: "#33302A",
          900: "#1F1D19",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(31, 29, 25, 0.04), 0 8px 24px -12px rgba(31, 29, 25, 0.18)",
        "card-hover":
          "0 2px 4px rgba(31, 29, 25, 0.06), 0 18px 40px -16px rgba(122, 60, 25, 0.38)",
        quadra: "0 28px 45px -22px rgba(94, 44, 22, 0.75)",
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

import type { Metadata, Viewport } from "next";
import { AvisosProvider } from "@/components/ui/Avisos";
import { AppProvider } from "@/store/AppStore";
// Fontes empacotadas com o site (funcionam offline): Inter no texto e
// Barlow Semi Condensed nos titulos, numeros e botoes do mosaico.
import "@fontsource-variable/inter";
import "@fontsource/barlow-semi-condensed/600.css";
import "@fontsource/barlow-semi-condensed/700.css";
import { PALETA } from "@/lib/paleta";
import "./globals.css";

export const metadata: Metadata = {
  title: "Red Tennis · Sistema de Gestão",
  description:
    "MVP do sistema de gestão da arena Red Tennis — agenda, alunos, financeiro e ranking.",
  icons: {
    icon: "/favicon.png",
  },
};

export const viewport: Viewport = {
  themeColor: PALETA.saibro[600],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AppProvider>
          <AvisosProvider>{children}</AvisosProvider>
        </AppProvider>
      </body>
    </html>
  );
}

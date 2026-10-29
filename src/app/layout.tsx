import type { Metadata, Viewport } from "next";
import { AvisosProvider } from "@/components/ui/Avisos";
import { AppProvider } from "@/store/AppStore";
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
  themeColor: "#B95A28",
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

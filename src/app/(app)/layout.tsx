import { CascaDoApp } from "@/components/layout/CascaDoApp";
import { NavegacaoMobile } from "@/components/layout/NavegacaoMobile";
import { ProtecaoDeRota } from "@/components/layout/ProtecaoDeRota";
import { Topbar } from "@/components/layout/Topbar";

/**
 * Casca das telas internas: topbar fixa com as abas que o perfil pode abrir
 * e, em volta da pagina, a protecao de rota (aviso "Sem acesso a esta área"
 * quando o perfil nao pode abrir o modulo). Tudo e montado so no navegador
 * (ver `CascaDoApp`). A tela de login (`/`) fica fora deste grupo e por isso
 * nao tem navegacao.
 */
export default function LayoutApp({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <CascaDoApp>
      <div className="fundo-arena min-h-screen">
        <Topbar />
        {/* pb-20 no celular reserva o espaço da barra de navegação fixa */}
        <main className="w-full px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8 2xl:px-10">
          <ProtecaoDeRota>{children}</ProtecaoDeRota>
        </main>
        <footer className="hidden w-full px-4 pb-8 pt-2 text-center text-xs text-areia-500 sm:px-6 md:block">
          MVP desenvolvido pela UFABC Júnior · dados fictícios para demonstração
        </footer>

        <NavegacaoMobile />
      </div>
    </CascaDoApp>
  );
}

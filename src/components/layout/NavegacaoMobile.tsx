"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/store/AppStore";
import { abaAtiva, abasPermitidas } from "./abas";

/**
 * Barra de navegação fixa no rodapé, exibida apenas no celular.
 *
 * Substitui as abas da topbar em telas estreitas, onde elas exigiriam rolagem
 * horizontal. Fundo de vidro translúcido; a aba ativa ganha uma pílula laranja
 * clara atrás do ícone. Os alvos de toque têm 56px de altura e ícone grande
 * com rótulo, para leitura e acerto fáceis — a arena é operada também por
 * quem não tem intimidade com celular. Mostra só as áreas que o perfil pode
 * abrir; as do dono (Configurações e Histórico) ficam no menu do usuário.
 */
export function NavegacaoMobile() {
  const caminho = usePathname();
  const { banco, colaborador } = useApp();
  const abas = abasPermitidas(banco, colaborador);

  if (abas.length === 0) return null;

  return (
    <nav
      aria-label="Navegação principal"
      className="vidro fixed inset-x-0 bottom-0 z-40 border-t border-areia-200 bg-white/90 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch px-1">
        {abas.map((aba) => {
          const { href, curto, Icone } = aba;
          const ativo = abaAtiva(caminho, aba);
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={`flex h-[58px] flex-col items-center justify-center gap-1 transition-colors ${
                  ativo ? "text-saibro-800" : "text-areia-600 hover:text-areia-900"
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200 motion-reduce:transition-none ${
                    ativo ? "bg-saibro-100" : ""
                  }`}
                >
                  <Icone className="h-[22px] w-[22px]" />
                </span>
                <span
                  className={`max-w-full truncate px-0.5 text-[11px] leading-none ${
                    ativo ? "font-bold" : "font-medium"
                  }`}
                >
                  {curto}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

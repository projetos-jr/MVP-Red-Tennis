"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { podeAcessar } from "@/lib/consultas/base";
import { HORARIO_DE_FUNCIONAMENTO, descricaoDaArena } from "@/lib/consultas/painel";
import { useApp } from "@/store/AppStore";
import { BuscaRapida } from "./BuscaRapida";
import { Logo } from "./Logo";
import { MenuDoUsuario } from "./MenuDoUsuario";
import { abasPermitidas, areaInicial, estaNaArea } from "./abas";

/**
 * Barra do topo: marca, busca rapida de aluno, usuario logado e as abas que
 * o perfil pode abrir (Hipotese H9). No celular as abas vao para a barra
 * inferior (`NavegacaoMobile`).
 */
export function Topbar() {
  const caminho = usePathname();
  const { banco, colaborador } = useApp();
  const abas = abasPermitidas(banco, colaborador);
  const inicio = areaInicial(banco, colaborador)?.href ?? "/";

  return (
    <header className="sticky top-0 z-30 border-b border-areia-200 bg-white/95 backdrop-blur">
      {/* Faixa superior: marca, busca e usuario logado */}
      <div className="flex w-full items-center justify-between gap-3 px-4 py-2.5 sm:px-6 2xl:px-10">
        <Link href={inicio} className="flex min-w-0 items-center gap-3">
          <Logo variante="marca" className="h-7 w-auto shrink-0 sm:h-8" />
          <span className="min-w-0">
            <span className="block text-sm font-bold uppercase tracking-[0.18em] text-tijolo-700">
              Red Tennis
            </span>
            <span className="hidden truncate text-[11px] text-areia-500 lg:block">
              {descricaoDaArena(banco)} · {HORARIO_DE_FUNCIONAMENTO}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {podeAcessar(banco, colaborador, "alunos") && <BuscaRapida />}
          <MenuDoUsuario />
        </div>
      </div>

      {/* Abas de navegacao — no celular a navegacao fica na barra inferior */}
      <nav aria-label="Seções do sistema" className="hidden w-full px-2 sm:px-4 md:block 2xl:px-8">
        <ul className="flex items-center gap-1 overflow-x-auto rolagem-suave">
          {abas.map(({ href, rotulo, Icone }) => {
            const ativo = estaNaArea(caminho, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={ativo ? "page" : undefined}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4 ${
                    ativo
                      ? "border-tijolo-600 text-tijolo-700"
                      : "border-transparent text-areia-600 hover:border-areia-300 hover:text-areia-900"
                  }`}
                >
                  <Icone className="h-[18px] w-[18px]" />
                  {rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { podeAcessar } from "@/lib/consultas/base";
import { HORARIO_DE_FUNCIONAMENTO, descricaoDaArena } from "@/lib/consultas/painel";
import { useApp } from "@/store/AppStore";
import { AbasComIndicador } from "./AbasComIndicador";
import { BuscaRapida } from "./BuscaRapida";
import { FaixaDeQuadra } from "./FaixaDeQuadra";
import { Logo } from "./Logo";
import { MenuDoUsuario } from "./MenuDoUsuario";
import { abasPermitidas, areaInicial } from "./abas";

/**
 * Barra do topo (vidro translucido): marca, busca rapida de aluno, usuario
 * logado e as abas que o perfil pode abrir (Hipotese H9), com a pilula
 * laranja na aba ativa. Embaixo, a faixa de saibro com a linha branca. No
 * celular as abas vao para a barra inferior (`NavegacaoMobile`).
 */
export function Topbar() {
  const caminho = usePathname();
  const { banco, colaborador } = useApp();
  const abas = abasPermitidas(banco, colaborador);
  const inicio = areaInicial(banco, colaborador)?.href ?? "/";

  return (
    <header className="vidro sticky top-0 z-30">
      {/* Faixa superior: marca, busca e usuario logado */}
      <div className="flex w-full items-center justify-between gap-3 px-4 py-2.5 sm:px-6 2xl:px-10">
        <Link href={inicio} className="alvo-de-toque flex min-w-0 items-center gap-3 rounded-xl">
          <Logo variante="marca" className="h-7 w-auto shrink-0 sm:h-8" />
          <span className="min-w-0">
            <span className="block font-display text-base font-bold uppercase leading-tight tracking-[0.16em] text-tijolo-700">
              Red Tennis
            </span>
            <span className="hidden truncate text-[11px] text-areia-600 lg:block">
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
        <AbasComIndicador abas={abas} caminho={caminho} />
      </nav>

      <FaixaDeQuadra />
    </header>
  );
}

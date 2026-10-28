"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { ABAS } from "./abas";
import { IconeSair } from "@/components/ui/Icons";
import { ARENA } from "@/lib/arena";
import { useApp } from "@/store/AppStore";


export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { usuario, sair } = useApp();

  async function sairDoSistema() {
    await sair();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-areia-200 bg-white/95 backdrop-blur">
      {/* Faixa superior: marca, identificacao da arena e usuario logado */}
      <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 2xl:px-10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Logo variante="marca" className="h-7 w-auto sm:h-8" />
          <span>
            <span className="block text-sm font-bold uppercase tracking-[0.18em] text-tijolo-700">
              Red Tennis
            </span>
            <span className="hidden text-[11px] text-areia-500 sm:block">
              {ARENA.endereco} · {ARENA.horarioFuncionamento}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight text-areia-900">
              {usuario.nome}
            </p>
            <p className="text-[11px] leading-tight text-areia-500">
              {usuario.cargo}
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-saibro-600 text-sm font-semibold text-white">
            {usuario.nome
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </span>
          <button
            type="button"
            onClick={sairDoSistema}
            className="btn-fantasma px-2.5 py-2"
            title="Sair do sistema"
          >
            <IconeSair className="h-5 w-5" />
            <span className="sr-only">Sair</span>
          </button>
        </div>
      </div>

      {/* Abas de navegacao — no celular a navegacao fica na barra inferior */}
      <nav className="hidden w-full px-2 sm:px-4 md:block 2xl:px-8">
        <ul className="flex items-center gap-1 overflow-x-auto rolagem-suave">
          {ABAS.map(({ href, rotulo, Icone }) => {
            const ativo = pathname.startsWith(href);
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

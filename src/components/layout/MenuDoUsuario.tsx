"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { IconeSetaBaixo } from "@/components/base/Icones";
import { ESTILO_DO_PERFIL } from "@/components/base/perfis";
import { Avatar } from "@/components/ui/Avatar";
import { IconeSair } from "@/components/ui/Icons";
import { NOMES_DOS_PERFIS, resumoDoAcesso } from "@/lib/consultas/configuracoes";
import { useApp } from "@/store/AppStore";
import { areasDoMenuPermitidas, estaNaArea } from "./abas";

/**
 * Usuario logado no canto da barra. Abre um menu com as areas do dono
 * (Configuracoes e Historico, so para quem pode) e o botao de sair.
 * Teclado: setas para andar, Esc para fechar.
 */
export function MenuDoUsuario() {
  const caminho = usePathname();
  const router = useRouter();
  const { banco, colaborador, sair } = useApp();
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const idDoMenu = useId();

  const areas = areasDoMenuPermitidas(banco, colaborador);
  const numaAreaDoMenu = areas.some((area) => estaNaArea(caminho, area.href));
  const nomeDoPerfil = NOMES_DOS_PERFIS[colaborador.perfil];
  // "Diretor · Dono", mas so "Recepção" quando cargo e perfil tem o mesmo nome.
  const cargoEPerfil =
    colaborador.cargo.toLowerCase() === nomeDoPerfil.toLowerCase()
      ? colaborador.cargo
      : `${colaborador.cargo} · ${nomeDoPerfil}`;

  useEffect(() => {
    if (!aberto) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node;
      if (!menu.current?.contains(alvo) && !botao.current?.contains(alvo)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    const itens = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const atual = itens.indexOf(document.activeElement as HTMLElement);
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      itens[(atual + passo + itens.length) % itens.length]?.focus();
    } else if (evento.key === "Escape") {
      evento.preventDefault();
      setAberto(false);
      botao.current?.focus();
    } else if (evento.key === "Tab") {
      setAberto(false);
    }
  }

  function sairDoSistema() {
    setAberto(false);
    sair();
    router.push("/");
  }

  return (
    <div className="relative">
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idDoMenu : undefined}
        aria-label={`Menu de ${colaborador.nome}`}
        className={`flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition-colors hover:bg-areia-100 lg:px-2 ${
          aberto || numaAreaDoMenu ? "bg-areia-100" : ""
        }`}
      >
        <span className="hidden text-right lg:block">
          <span className="block text-sm font-semibold leading-tight text-areia-900">
            {colaborador.nome}
          </span>
          <span className="block text-[11px] leading-tight text-areia-500">{cargoEPerfil}</span>
        </span>
        <Avatar id={colaborador.id} nome={colaborador.nome} tamanho="sm" />
        <IconeSetaBaixo
          className={`h-4 w-4 text-areia-500 transition-transform ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      {aberto && (
        <div
          ref={menu}
          id={idDoMenu}
          role="menu"
          aria-label="Menu do usuário"
          onKeyDown={aoTeclar}
          className="absolute right-0 top-full z-40 mt-2 w-72 animate-fade-up overflow-hidden rounded-2xl border border-areia-200 bg-white shadow-card-hover"
        >
          <div className="border-b border-areia-200 px-4 py-3.5">
            <p className="text-sm font-semibold text-areia-900">{colaborador.nome}</p>
            <p className="mt-0.5 text-xs text-areia-500">{colaborador.cargo}</p>
            <span
              className={`chip mt-2 border text-[11px] ${ESTILO_DO_PERFIL[colaborador.perfil]}`}
            >
              Perfil {nomeDoPerfil}
            </span>
            <p className="mt-2 text-xs leading-snug text-areia-500">
              {resumoDoAcesso(banco.configuracoes, colaborador.perfil)}
            </p>
          </div>

          {areas.length > 0 && (
            <ul className="border-b border-areia-200 py-1.5">
              {areas.map(({ href, rotulo, Icone }) => (
                <li key={href} role="none">
                  <Link
                    href={href}
                    role="menuitem"
                    onClick={() => setAberto(false)}
                    aria-current={estaNaArea(caminho, href) ? "page" : undefined}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-areia-700 hover:bg-areia-50 hover:text-areia-900 focus-visible:bg-areia-50 aria-[current=page]:text-tijolo-700"
                  >
                    <Icone className="h-[18px] w-[18px]" />
                    {rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="py-1.5" role="none">
            <button
              type="button"
              role="menuitem"
              onClick={sairDoSistema}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-areia-700 hover:bg-areia-50 hover:text-areia-900 focus-visible:bg-areia-50"
            >
              <IconeSair className="h-[18px] w-[18px]" />
              Sair e trocar de usuário
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

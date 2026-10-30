"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { EstadoVazio } from "@/components/ui/EstadoVazio";
import { IconeCadeado } from "@/components/ui/Icons";
import { podeAcessar } from "@/lib/consultas/base";
import { NOMES_DOS_MODULOS, NOMES_DOS_PERFIS } from "@/lib/consultas/configuracoes";
import { useApp } from "@/store/AppStore";
import { areaInicial, moduloDaRota } from "./abas";

/**
 * Protecao de rota das telas internas: se o perfil de quem esta logado nao
 * pode abrir o modulo da pagina atual (Hipotese H9), mostra o aviso no lugar
 * da pagina. Vale tambem para quem digita o endereco ou volta pelo historico
 * do navegador depois de trocar de usuario.
 *
 * E so a protecao da tela: no banco real, as politicas de acesso (RLS) do
 * Supabase impedem a leitura dos dados.
 */
export function ProtecaoDeRota({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const { banco, colaborador, sair } = useApp();
  const modulo = moduloDaRota(caminho);

  if (!modulo || podeAcessar(banco, colaborador, modulo)) return children;

  const inicial = areaInicial(banco, colaborador);

  function trocarDeUsuario() {
    sair();
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-lg py-6 sm:py-12">
      <EstadoVazio
        icone={<IconeCadeado className="h-6 w-6" />}
        titulo="Sem acesso a esta área"
        tituloDaPagina
        acoes={
          <>
            {inicial && (
              <Link href={inicial.href} className="btn-primario">
                {inicial.modulo === "painel" ? "Voltar ao painel" : `Ir para ${inicial.rotulo}`}
              </Link>
            )}
            <button type="button" onClick={trocarDeUsuario} className="btn-secundario">
              Entrar com outro usuário
            </button>
          </>
        }
      >
        O perfil <strong className="font-semibold">{NOMES_DOS_PERFIS[colaborador.perfil]}</strong>{" "}
        não abre <strong className="font-semibold">{NOMES_DOS_MODULOS[modulo].nome}</strong>. Se
        precisar, peça ao dono para liberar em Configurações, na parte de permissões.
      </EstadoVazio>
    </div>
  );
}

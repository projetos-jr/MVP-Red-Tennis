"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Carregando } from "@/components/ui/Carregando";
import { useApp } from "@/store/AppStore";

const semInscricao = () => () => {};

/**
 * Casca das telas internas, com duas regras:
 *
 * 1. As telas so sao montadas no navegador. Elas dependem da data e da hora
 *    da arena ("hoje" na agenda, no painel e no financeiro); montando so no
 *    navegador, "hoje" e sempre o dia em que a pagina foi aberta, sem
 *    divergencia entre servidor e navegador, e o servidor so entrega arquivos
 *    prontos (sem gastar processamento a cada acesso).
 * 2. Sem ninguem logado (depois de "Sair"), manda para o login.
 */
export function CascaDoApp({ children }: { children: ReactNode }) {
  const noNavegador = useSyncExternalStore(
    semInscricao,
    () => true,
    () => false,
  );
  const { logado } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (noNavegador && !logado) router.replace("/");
  }, [noNavegador, logado, router]);

  if (!noNavegador || !logado) return <Carregando telaInteira />;

  return children;
}

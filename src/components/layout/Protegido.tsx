"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Logo } from "./Logo";
import { useApp } from "@/store/AppStore";

/**
 * Libera as telas internas so depois do login e da carga dos dados.
 * Sem sessao (ou sem acesso), volta para a tela de login.
 */
export function Protegido({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { situacao } = useApp();

  useEffect(() => {
    if (situacao === "deslogado" || situacao === "erro") router.replace("/");
  }, [situacao, router]);

  if (situacao === "pronto") return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white">
      <Logo className="h-20 w-auto animate-pulse" />
      <p className="text-sm text-areia-500">Carregando dados da arena…</p>
    </div>
  );
}

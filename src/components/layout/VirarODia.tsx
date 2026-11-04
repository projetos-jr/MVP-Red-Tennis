"use client";

import { useEffect } from "react";
import { HOJE } from "@/lib/banco/constantes";
import { hojeISO } from "@/lib/date";

/**
 * O "hoje" do sistema (`HOJE`) e lido uma vez, ao abrir. O tablet da quadra
 * pode ficar aberto de um dia para o outro: quando a data da arena muda, a
 * pagina recarrega sozinha para a agenda, o Inicio e as regras de data
 * ("so a partir de hoje") passarem para o dia novo. A arena fecha as 22h,
 * entao ninguem esta no meio de um cadastro a meia-noite.
 *
 * Com o Supabase a sessao continua depois de recarregar; no modo
 * demonstracao os dados de exemplo sao montados de novo para o dia novo.
 */
export function VirarODia() {
  useEffect(() => {
    function conferir() {
      const hoje = hojeISO();
      if (hoje === HOJE) return;
      // Uma vez por data: se algo der errado, nunca fica recarregando sem parar.
      try {
        if (window.sessionStorage.getItem("red-tennis:virou-o-dia") === hoje) return;
        window.sessionStorage.setItem("red-tennis:virou-o-dia", hoje);
      } catch {
        // Sem sessionStorage (navegacao privada): recarrega assim mesmo.
      }
      window.location.reload();
    }
    const relogio = window.setInterval(conferir, 60_000);
    // Tablet que "dormiu": confere assim que a tela volta.
    document.addEventListener("visibilitychange", conferir);
    return () => {
      window.clearInterval(relogio);
      document.removeEventListener("visibilitychange", conferir);
    };
  }, []);
  return null;
}

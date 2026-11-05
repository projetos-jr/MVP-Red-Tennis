"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Ao abrir outra tela, a página começa do topo.
 *
 * O Next só rola para cima quando o começo da página nova está FORA da tela;
 * com o topo fixo do sistema por cima, ele achava que estava visível (estava,
 * mas escondido atrás do topo) e a barra da agenda, por exemplo, ficava
 * coberta para quem vinha rolado do Início. O "Voltar" do navegador continua
 * devolvendo a posição em que a pessoa estava.
 */
export function RolarAoTrocarDeTela() {
  const caminho = usePathname();
  const anterior = useRef(caminho);
  const voltou = useRef(false);

  useEffect(() => {
    let relogio: number | undefined;
    function marcarVolta() {
      voltou.current = true;
      window.clearTimeout(relogio);
      relogio = window.setTimeout(() => {
        voltou.current = false;
      }, 1000);
    }
    window.addEventListener("popstate", marcarVolta);
    return () => {
      window.removeEventListener("popstate", marcarVolta);
      window.clearTimeout(relogio);
    };
  }, []);

  useEffect(() => {
    if (anterior.current === caminho) return;
    anterior.current = caminho;
    if (voltou.current) {
      voltou.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [caminho]);

  return null;
}

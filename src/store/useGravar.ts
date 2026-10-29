"use client";

import { useCallback } from "react";
import { useAvisos } from "@/components/ui/Avisos";
import type { Operacao } from "@/lib/banco/executar";
import { useApp } from "./AppStore";

/**
 * Atalho para gravar a partir de uma tela: executa a operacao e mostra o
 * aviso de sucesso ou o erro da regra.
 *
 *   const gravar = useGravar();
 *   if (gravar(cancelarOcupacao, { id, motivo: "CH" }, "Aula cancelada.")) fecharModal();
 *
 * Devolve true se gravou e false se uma regra recusou.
 */
export function useGravar() {
  const { executar } = useApp();
  const { avisar } = useAvisos();

  return useCallback(
    <Dados,>(operacao: Operacao<Dados>, dados: Dados, mensagemDeSucesso?: string): boolean => {
      const resultado = executar(operacao, dados);
      if (!resultado.ok) {
        avisar("erro", resultado.erro);
        return false;
      }
      if (mensagemDeSucesso) avisar("sucesso", mensagemDeSucesso);
      return true;
    },
    [executar, avisar],
  );
}

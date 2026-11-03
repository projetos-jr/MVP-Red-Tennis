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
 *   if (await gravar(cancelarOcupacao, { id, motivo: "CH" }, "Aula cancelada.")) fecharModal();
 *
 * Devolve (sempre com `await`) true se gravou e false se uma regra recusou.
 * Enquanto grava, `useApp().gravando` fica true e um segundo clique e
 * ignorado.
 */
export function useGravar() {
  const { executar } = useApp();
  const { avisar } = useAvisos();

  return useCallback(
    async <Dados,>(
      operacao: Operacao<Dados>,
      dados: Dados,
      mensagemDeSucesso?: string,
    ): Promise<boolean> => {
      const resultado = await executar(operacao, dados);
      if (!resultado.ok) {
        // Erro vazio = clique repetido enquanto a gravacao anterior acontecia.
        if (resultado.erro) avisar("erro", resultado.erro);
        return false;
      }
      if (mensagemDeSucesso) avisar("sucesso", mensagemDeSucesso);
      return true;
    },
    [executar, avisar],
  );
}

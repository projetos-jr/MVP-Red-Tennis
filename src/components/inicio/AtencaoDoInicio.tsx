"use client";

import { useState } from "react";
import { PrecisaDeAtencao } from "@/components/dashboard/PrecisaDeAtencao";
import { Modal } from "@/components/ui/Modal";
import { BotaoDeAtencao } from "@/components/ui/PlacaDeAtencao";
import type { Configuracoes } from "@/lib/banco/tipos";
import type { PrecisaDeAtencao as DadosDeAtencao } from "@/lib/consultas/painel";

/**
 * Placa de atenção do Início (embaixo do mosaico), como a placa de alerta do
 * sistema antigo: só aparece quando há pendência (total 0 = nada na tela).
 * Clicar abre a janela "Precisa de atenção" com as listas; Esc, o X ou um
 * clique fora fecham.
 */
export function AtencaoDoInicio({
  atencao,
  configuracoes,
  podeRegistrarPagamento,
}: {
  atencao: DadosDeAtencao;
  configuracoes: Configuracoes;
  podeRegistrarPagamento: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  if (atencao.total <= 0) return null;

  const total = atencao.total;
  return (
    <>
      <BotaoDeAtencao variante="grande" quantidade={total} aoAbrir={() => setAberta(true)} />
      <Modal
        aberto={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Precisa de atenção"
        descricao={`${total} ${total === 1 ? "item pede" : "itens pedem"} uma ação hoje.`}
        largura="lg"
      >
        <PrecisaDeAtencao
          atencao={atencao}
          configuracoes={configuracoes}
          podeRegistrarPagamento={podeRegistrarPagamento}
        />
      </Modal>
    </>
  );
}

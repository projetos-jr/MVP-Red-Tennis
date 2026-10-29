"use client";

import { useState } from "react";
import { ComentariosDoRegistro } from "@/components/registro/ComentariosDoRegistro";
import { HistoricoDoRegistro } from "@/components/registro/HistoricoDoRegistro";
import { Segmentado } from "@/components/ui/Segmentado";

/** Nomes legiveis dos campos de uma partida no historico de alteracoes. */
export const ROTULOS_DA_PARTIDA: Record<string, string> = {
  data: "Data",
  placar: "Placar",
  vencedor: "Vencedor",
  wo: "W.O.",
  ladoA: "Lado A",
  ladoB: "Lado B",
  inscricaoAId: "Inscrição do lado A",
  inscricaoBId: "Inscrição do lado B",
  ocupacaoId: "Reserva de quadra",
};

/** Comentarios e historico de alteracoes de uma partida (rodape dos modais). */
export function RegistroDaPartida({ partidaId }: { partidaId: string }) {
  const [aba, setAba] = useState<"comentarios" | "historico">("comentarios");
  return (
    <section className="border-t border-areia-200">
      <div className="px-5 pt-3">
        <Segmentado
          aria="Comentários e histórico da partida"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: "comentarios", rotulo: "Comentários" },
            { valor: "historico", rotulo: "Histórico" },
          ]}
        />
      </div>
      {aba === "comentarios" ? (
        <ComentariosDoRegistro entidade="partida" entidadeId={partidaId} semCartao />
      ) : (
        <div className="pb-2 pt-1">
          <HistoricoDoRegistro
            tabela="partidas"
            registroId={partidaId}
            rotulos={ROTULOS_DA_PARTIDA}
            semCartao
          />
        </div>
      )}
    </section>
  );
}

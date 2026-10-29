"use client";

import type { FormEvent, ReactNode } from "react";
import { RodapeDoFormulario } from "./Formulario";
import { Modal } from "./Modal";

/**
 * Pergunta antes de uma acao que cancela, apaga ou nao tem volta.
 * `children` permite pedir algo junto (ex.: o motivo do cancelamento).
 */
export function Confirmacao({
  aberto,
  titulo,
  mensagem,
  rotuloConfirmar = "Confirmar",
  perigoso,
  desabilitado,
  aoConfirmar,
  aoCancelar,
  children,
}: {
  aberto: boolean;
  titulo: string;
  mensagem: ReactNode;
  rotuloConfirmar?: string;
  perigoso?: boolean;
  desabilitado?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
  children?: ReactNode;
}) {
  function enviar(evento: FormEvent) {
    evento.preventDefault();
    aoConfirmar();
  }

  return (
    <Modal aberto={aberto} aoFechar={aoCancelar} titulo={titulo} largura="sm">
      <form onSubmit={enviar}>
        <div className="space-y-4 px-5 py-4 text-sm text-areia-700">
          <div className="leading-relaxed">{mensagem}</div>
          {children}
        </div>
        <RodapeDoFormulario
          aoCancelar={aoCancelar}
          rotuloConfirmar={rotuloConfirmar}
          perigoso={perigoso}
          desabilitado={desabilitado}
        />
      </form>
    </Modal>
  );
}

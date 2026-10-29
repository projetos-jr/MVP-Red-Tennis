"use client";

import { useState } from "react";
import { IconeAgenda } from "@/components/ui/Icons";
import { salvarParametros } from "@/lib/banco/operacoes/configuracoes";
import type { Configuracoes } from "@/lib/banco/tipos";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import {
  CampoDeConfiguracao,
  EntradaComUnidade,
  FormularioDeSecao,
  Interruptor,
  RodapeDeSalvar,
  SecaoDeConfiguracao,
  erroDeInteiro,
  paraNumero,
} from "./Pecas";

function rascunhoDe(c: Configuracoes) {
  return {
    prazo: String(c.prazoPagamentoReservaHoras),
    liberar: c.liberarReservaAutomaticamente,
    semanas: String(c.semanasGeradasAFrente),
    bloquearProfessor: c.bloquearProfessorEmDuasAulas,
  };
}

/** Reserva sem pagamento (H5), agenda gerada a frente (H12) e professor em duas aulas (H10). */
export function SecaoReservasEAgenda() {
  const { banco } = useApp();
  const gravar = useGravar();
  const salvo = rascunhoDe(banco.configuracoes);
  const [rascunho, setRascunho] = useState(salvo);
  const alterado = JSON.stringify(rascunho) !== JSON.stringify(salvo);

  const erroDoPrazo = erroDeInteiro(rascunho.prazo, 1, "Use um número inteiro de horas, a partir de 1.");
  const semanas = paraNumero(rascunho.semanas);
  const erroDasSemanas =
    Number.isInteger(semanas) && semanas >= 1 && semanas <= 52
      ? undefined
      : "Use um número inteiro de 1 a 52.";

  function salvar() {
    gravar(
      salvarParametros,
      {
        prazoPagamentoReservaHoras: paraNumero(rascunho.prazo),
        liberarReservaAutomaticamente: rascunho.liberar,
        semanasGeradasAFrente: semanas,
        bloquearProfessorEmDuasAulas: rascunho.bloquearProfessor,
      },
      "Regras de reserva e agenda salvas.",
    );
  }

  return (
    <SecaoDeConfiguracao
      id="reservas"
      titulo="Reservas e agenda"
      descricao="Prazo para pagar reservas avulsas, quanto da agenda fica pronta e choque de horário do professor."
      icone={<IconeAgenda className="h-5 w-5" />}
    >
      <FormularioDeSecao aoSalvar={salvar}>
        <div className="divide-y divide-areia-100">
          <CampoDeConfiguracao
            rotulo="Prazo para pagar uma reserva avulsa"
            hipotese={5}
            ajuda="Quem reserva uma quadra avulsa fica com a reserva “aguardando pagamento” por este tempo. Valor de teste: 24 horas. A reserva que passa do prazo aparece em alerta no Painel."
            erro={rascunho.prazo !== salvo.prazo ? erroDoPrazo : undefined}
          >
            {(id) => (
              <EntradaComUnidade
                id={id}
                valor={rascunho.prazo}
                aoMudar={(prazo) => setRascunho({ ...rascunho, prazo })}
                unidade="horas"
                invalido={rascunho.prazo !== salvo.prazo && Boolean(erroDoPrazo)}
              />
            )}
          </CampoDeConfiguracao>

          <CampoDeConfiguracao
            rotulo="Liberar o horário sozinho quando o prazo vencer"
            hipotese={5}
            ajuda="Não (como a arena pediu): a reserva vencida só fica em alerta e a recepção decide se cede o horário a outra pessoa. Sim: o horário é liberado automaticamente quando o prazo vence."
          >
            {(id) => (
              <Interruptor
                id={id}
                ligado={rascunho.liberar}
                aoMudar={(liberar) => setRascunho({ ...rascunho, liberar })}
              />
            )}
          </CampoDeConfiguracao>

          <CampoDeConfiguracao
            rotulo="Semanas da agenda criadas à frente"
            hipotese={12}
            ajuda="Os horários fixos viram aulas com data até este número de semanas à frente, e a agenda é estendida sozinha. Valor inicial: 12 semanas."
            erro={rascunho.semanas !== salvo.semanas ? erroDasSemanas : undefined}
          >
            {(id) => (
              <EntradaComUnidade
                id={id}
                valor={rascunho.semanas}
                aoMudar={(valor) => setRascunho({ ...rascunho, semanas: valor })}
                unidade="semanas"
                invalido={rascunho.semanas !== salvo.semanas && Boolean(erroDasSemanas)}
              />
            )}
          </CampoDeConfiguracao>

          <CampoDeConfiguracao
            rotulo="Impedir professor em duas aulas ao mesmo tempo"
            hipotese={10}
            ajuda="Não: o sistema avisa do choque de horário, mas deixa salvar. Sim: não deixa marcar o mesmo professor em duas aulas no mesmo horário."
          >
            {(id) => (
              <Interruptor
                id={id}
                ligado={rascunho.bloquearProfessor}
                aoMudar={(bloquearProfessor) => setRascunho({ ...rascunho, bloquearProfessor })}
              />
            )}
          </CampoDeConfiguracao>
        </div>
        <RodapeDeSalvar alterado={alterado} aoDesfazer={() => setRascunho(salvo)} />
      </FormularioDeSecao>
    </SecaoDeConfiguracao>
  );
}

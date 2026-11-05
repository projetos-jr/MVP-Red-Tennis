"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PainelDeOpcoes } from "@/components/ui/MaisOpcoes";
import { IconeCadeado, IconeRelogio } from "@/components/ui/Icons";
import type { Professor } from "@/lib/banco/tipos";
import type { ResumoDaAgenda } from "@/lib/consultas/agenda";
import type { EstadoDaAgenda } from "@/lib/consultas/enderecoDaAgenda";
import { ID_DAS_OPCOES } from "./BarraDaAgenda";
import { plural } from "./estilos";
import { FiltrosDaAgenda } from "./FiltrosDaAgenda";
import { IconeChuva, IconeImpressora, IconeTablet } from "./Icones";
import { Legenda } from "./Legenda";

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const BOTAO = "btn-secundario shrink-0 px-3 py-2 text-[0.95rem]";

/**
 * O que fica guardado em "Mais opcoes" (fechado por padrao): as acoes raras,
 * ir para uma data, os filtros, os numeros do periodo e a legenda. Fechado,
 * a agenda fica com a tela quase toda.
 */
export function OpcoesDaAgenda({
  aberto,
  podeEditar,
  aoAbrirJanela,
  reservas,
  reservasVencidas,
  linkImprimir,
  linkModoQuadra,
  data,
  aoIrParaData,
  estado,
  aoMudar,
  professores,
  professorTravado,
  professorFora,
  resumo,
  periodo,
  horasDeAula,
}: {
  aberto: boolean;
  podeEditar: boolean;
  aoAbrirJanela: (janela: "bloqueio" | "chuva" | "reservas") => void;
  /** Reservas aguardando pagamento (todas) e quantas passaram do prazo. */
  reservas: number;
  reservasVencidas: number;
  linkImprimir: string;
  linkModoQuadra: string;
  data: string;
  aoIrParaData: (data: string) => void;
  estado: EstadoDaAgenda;
  aoMudar: (parcial: Partial<EstadoDaAgenda>) => void;
  professores: Professor[];
  professorTravado?: string;
  professorFora?: string;
  resumo: ResumoDaAgenda;
  periodo: string;
  horasDeAula: boolean;
}) {
  return (
    <PainelDeOpcoes
      id={ID_DAS_OPCOES}
      aberto={aberto}
      rotulo="Mais opções da agenda"
      className="card space-y-4 p-4"
    >
      <Secao titulo="Ações">
        <div className="flex flex-wrap items-center gap-2">
          {podeEditar && (
            <>
              <button type="button" onClick={() => aoAbrirJanela("bloqueio")} className={BOTAO}>
                <IconeCadeado className="h-5 w-5" />
                Bloquear quadra
              </button>
              <button type="button" onClick={() => aoAbrirJanela("chuva")} className={BOTAO}>
                <IconeChuva className="h-5 w-5" />
                Cancelar por chuva
              </button>
              <button type="button" onClick={() => aoAbrirJanela("reservas")} className={BOTAO}>
                <IconeRelogio className="h-5 w-5" />
                Reservas sem pagamento
                {reservas > 0 && (
                  <span
                    className={`rounded-full px-2 text-sm font-bold ${
                      reservasVencidas > 0 ? "bg-tijolo-600 text-white" : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {reservas}
                  </span>
                )}
              </button>
            </>
          )}
          <Link href={linkImprimir} className={BOTAO}>
            <IconeImpressora className="h-5 w-5" />
            Imprimir o dia
          </Link>
          <Link href={linkModoQuadra} className={BOTAO}>
            <IconeTablet className="h-5 w-5" />
            Modo quadra
          </Link>
          <label className="flex items-center gap-2 text-sm font-medium text-areia-700">
            Ir para a data
            <input
              type="date"
              value={data}
              onChange={(e) => {
                if (DATA_ISO.test(e.target.value)) aoIrParaData(e.target.value);
              }}
              className="campo w-auto py-1.5"
            />
          </label>
        </div>
      </Secao>

      <Secao titulo="Filtros">
        <FiltrosDaAgenda
          estado={estado}
          aoMudar={aoMudar}
          professores={professores}
          professorTravado={professorTravado}
          professorFora={professorFora}
        />
      </Secao>

      <Secao titulo="Números">
        <ResumoEmLinha
          resumo={resumo}
          periodo={periodo}
          mostrarCanceladas={estado.mostrarCanceladas}
          horasDeAula={horasDeAula}
        />
      </Secao>

      <Secao titulo="Legenda">
        <Legenda />
      </Secao>

      {!podeEditar && (
        <p className="rounded-xl border border-saibro-200 bg-saibro-50 px-4 py-2.5 text-sm text-saibro-900">
          Perfil de professor: você vê só as suas aulas e não altera a agenda (Hipótese H9).
        </p>
      )}
    </PainelDeOpcoes>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-b border-areia-100 pb-4 last:border-b-0 last:pb-0">
      <h2 className="card-titulo">{titulo}</h2>
      {children}
    </section>
  );
}

/** Os contadores do periodo que esta na tela, numa linha so. */
function ResumoEmLinha({
  resumo,
  periodo,
  mostrarCanceladas,
  horasDeAula,
}: {
  resumo: ResumoDaAgenda;
  periodo: string;
  mostrarCanceladas: boolean;
  /** Visao Professores: horas de aula no lugar da ocupacao das quadras. */
  horasDeAula: boolean;
}) {
  const ocupacao = resumo.minutosDisponiveis
    ? Math.round((resumo.minutosOcupados / resumo.minutosDisponiveis) * 100)
    : 0;
  const numero = "font-display text-xl font-bold text-areia-900";
  const separador = (
    <span className="text-areia-400" aria-hidden="true">
      ·
    </span>
  );
  return (
    <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-base text-areia-700">
      <span>
        <strong className={numero}>{resumo.ativas.toLocaleString("pt-BR")}</strong>{" "}
        {resumo.ativas === 1 ? "horário" : "horários"} {periodo}
      </span>
      {separador}
      <span>
        <strong className={numero}>{resumo.alunos.toLocaleString("pt-BR")}</strong>{" "}
        {resumo.alunos === 1 ? "aluno" : "alunos"}
      </span>
      {separador}
      {horasDeAula ? (
        <span>
          <strong className={numero}>{Math.round(resumo.minutosOcupados / 60)} h</strong> de aula
        </span>
      ) : (
        <span
          title={`${Math.round(resumo.minutosOcupados / 60)} h de ${Math.round(resumo.minutosDisponiveis / 60)} h de quadra`}
        >
          <strong className={numero}>{ocupacao}%</strong> de ocupação
          {resumo.bloqueios > 0 && ` (${plural(resumo.bloqueios, "bloqueio", "bloqueios")})`}
        </span>
      )}
      {separador}
      <span>
        <strong className={numero}>{resumo.canceladas.toLocaleString("pt-BR")}</strong>{" "}
        {resumo.canceladas === 1 ? "cancelada" : "canceladas"}
        {!mostrarCanceladas && resumo.canceladas > 0 && " (escondidas)"}
      </span>
      {separador}
      <span className={resumo.vencidas > 0 ? "font-medium text-tijolo-700" : undefined}>
        <strong className={resumo.vencidas > 0 ? `${numero} !text-tijolo-700` : numero}>
          {resumo.aguardandoPagamento.toLocaleString("pt-BR")}
        </strong>{" "}
        a pagar{resumo.vencidas > 0 && ` (${resumo.vencidas} com prazo vencido)`}
      </span>
    </p>
  );
}

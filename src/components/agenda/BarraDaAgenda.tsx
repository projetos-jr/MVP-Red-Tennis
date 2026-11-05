"use client";

import { BotaoMaisOpcoes } from "@/components/ui/MaisOpcoes";
import { BotaoDeAtencao } from "@/components/ui/PlacaDeAtencao";
import { IconeAnterior, IconeMais, IconeProximo } from "@/components/ui/Icons";
import type { VisaoDaAgenda } from "@/lib/consultas/enderecoDaAgenda";
import { SeletorDaVisao } from "./SeletorDaVisao";

/** id do painel de "Mais opções" da agenda (o botão diz qual área abre). */
export const ID_DAS_OPCOES = "opcoes-da-agenda";

/**
 * Barra de cima da agenda, enxuta (pedido do dono: "a agenda maior, menos
 * botãozinho"): numa linha só no computador e no tablet deitado.
 *
 *   [Diária | Professores | Quadra | Mês]  [‹ Qua 04/11 e Qui 05/11 ›] [Hoje]
 *                               [⚠ 5 reservas vencidas] [+ Novo horário] [Mais opções]
 *
 * O resto (bloquear, chuva, reservas, imprimir, modo quadra, ir para a data,
 * filtros, números e legenda) fica no painel de "Mais opções".
 * No celular, a mesma ideia empilhada, sem rolagem para o lado.
 */
export function BarraDaAgenda({
  visao,
  aoMudarVisao,
  titulo,
  tituloCurto,
  passo,
  aoNavegar,
  aoHoje,
  vencidas,
  textoDasVencidas,
  aoAbrirReservas,
  aoNovoHorario,
  novoHorarioNoCelular,
  professorTravado,
  opcoesAbertas,
  aoAlternarOpcoes,
  filtrosAtivos,
}: {
  visao: VisaoDaAgenda;
  aoMudarVisao: (visao: VisaoDaAgenda) => void;
  /** "Qua 04/11 e Qui 05/11", "02/11 — 08/11", "novembro de 2026". */
  titulo: string;
  /** Versão mais curta para o tablet deitado (sem o dia da semana). */
  tituloCurto?: string;
  passo: "dia" | "semana" | "mês";
  aoNavegar: (direcao: -1 | 1) => void;
  aoHoje: () => void;
  /** Reservas com o prazo de pagamento vencido (a placa só aparece com alguma). */
  vencidas: number;
  textoDasVencidas: string;
  aoAbrirReservas: () => void;
  /** Ausente para quem só consulta (perfil de professor). */
  aoNovoHorario?: () => void;
  /** No celular a lista do dia já tem "Marcar": o botão fica só no Mês. */
  novoHorarioNoCelular: boolean;
  /** Perfil de professor: nome dele (vê só as próprias aulas). */
  professorTravado?: string;
  opcoesAbertas: boolean;
  aoAlternarOpcoes: () => void;
  filtrosAtivos: number;
}) {
  const anterior = passo === "dia" ? "Dia anterior" : passo === "mês" ? "Mês anterior" : "Semana anterior";
  const proximo = passo === "dia" ? "Próximo dia" : passo === "mês" ? "Próximo mês" : "Próxima semana";

  return (
    <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
      {/* A aba do topo ja diz onde se esta; o titulo fica para o leitor de tela. */}
      <h1 className="sr-only">Agenda</h1>

      <SeletorDaVisao valor={visao} aoMudar={aoMudarVisao} />

      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-xl border border-areia-200 bg-white p-1 shadow-sm md:flex-none">
          <button
            type="button"
            onClick={() => aoNavegar(-1)}
            className="btn-fantasma h-11 w-11 shrink-0 p-0"
            aria-label={anterior}
            title={anterior}
          >
            <IconeAnterior className="h-6 w-6" />
          </button>
          <span
            className="min-w-[8ch] flex-1 whitespace-nowrap px-1 text-center font-display text-xl font-bold leading-none text-areia-900 first-letter:uppercase xl:text-[1.4rem] xl:leading-none"
            aria-live="polite"
          >
            {tituloCurto ? (
              <>
                <span className="xl:hidden">{tituloCurto}</span>
                <span className="hidden xl:inline">{titulo}</span>
              </>
            ) : (
              titulo
            )}
          </span>
          <button
            type="button"
            onClick={() => aoNavegar(1)}
            className="btn-fantasma h-11 w-11 shrink-0 p-0"
            aria-label={proximo}
            title={proximo}
          >
            <IconeProximo className="h-6 w-6" />
          </button>
        </div>
        <button
          type="button"
          onClick={aoHoje}
          className="btn-secundario min-h-[2.75rem] shrink-0 px-3.5 font-display text-lg leading-none"
        >
          Hoje
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:ml-auto md:flex-nowrap">
        {/* Hipotese H5: reserva com prazo vencido entra em alerta; quem decide e a recepcao. */}
        <BotaoDeAtencao
          variante="compacto"
          quantidade={vencidas}
          descricao={textoDasVencidas}
          rotuloAcessivel={`${textoDasVencidas}: abrir a lista de reservas sem pagamento`}
          aoAbrir={aoAbrirReservas}
          className="text-base"
        />
        {professorTravado && (
          <span
            className="inline-flex min-h-[2.75rem] items-center rounded-xl bg-saibro-50 px-3 text-base font-semibold text-saibro-800"
            title={`Perfil de professor: você vê só as suas aulas (${professorTravado}) e não altera a agenda (Hipótese H9).`}
          >
            Só as suas aulas
          </span>
        )}
        {aoNovoHorario && (
          <button
            type="button"
            onClick={aoNovoHorario}
            className={`btn-primario min-h-[2.75rem] px-3.5 text-base ${novoHorarioNoCelular ? "" : "hidden md:inline-flex"}`}
          >
            <IconeMais className="h-5 w-5" />
            Novo horário
          </button>
        )}
        <BotaoMaisOpcoes
          aberto={opcoesAbertas}
          aoAlternar={aoAlternarOpcoes}
          controla={ID_DAS_OPCOES}
          contagem={filtrosAtivos}
          className="min-h-[2.75rem]"
        />
      </div>
    </div>
  );
}

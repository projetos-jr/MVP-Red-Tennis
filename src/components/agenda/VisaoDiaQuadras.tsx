"use client";

import { useEffect, useMemo, useRef } from "react";
import { IconeMais } from "@/components/ui/Icons";
import { FAIXAS_HORARIAS } from "@/lib/banco/constantes";
import type { Quadra } from "@/lib/banco/tipos";
import type { ItemAgenda } from "@/lib/consultas/agenda";
import { formatarDiaMes, horaParaMinutos } from "@/lib/date";
import { BlocoNoDia } from "./CartaoOcupacao";

const PX_POR_MINUTO = 1.2;
const ABERTURA_EM_MINUTOS = 7 * 60;
const FECHAMENTO_EM_MINUTOS = 22 * 60;
const ALTURA_DA_GRADE = (FECHAMENTO_EM_MINUTOS - ABERTURA_EM_MINUTOS) * PX_POR_MINUTO;
const ALTURA_DA_HORA = 60 * PX_POR_MINUTO;

/**
 * Dentro de uma quadra so pode haver uma ocupacao ativa por vez, mas uma
 * aula cancelada continua aparecendo ao lado da que ocupou o lugar dela.
 * Esta funcao divide a coluna da quadra em "subcolunas" para que horarios
 * que se sobrepoem fiquem lado a lado, em vez de um por cima do outro.
 */
function subcolunas(itens: ItemAgenda[]): Map<string, { coluna: number; total: number }> {
  const ordenados = [...itens].sort(
    (a, b) =>
      a.ocupacao.horaInicio.localeCompare(b.ocupacao.horaInicio) ||
      Number(a.cancelada) - Number(b.cancelada),
  );
  const posicoes = new Map<string, { coluna: number; total: number }>();
  let grupo: Array<{ id: string; coluna: number }> = [];
  let finsDasColunas: string[] = [];
  let fimDoGrupo = "";

  const fecharGrupo = () => {
    grupo.forEach(({ id, coluna }) => posicoes.set(id, { coluna, total: finsDasColunas.length }));
    grupo = [];
    finsDasColunas = [];
  };

  ordenados.forEach(({ ocupacao }) => {
    if (grupo.length > 0 && ocupacao.horaInicio >= fimDoGrupo) fecharGrupo();
    let coluna = finsDasColunas.findIndex((fim) => fim <= ocupacao.horaInicio);
    if (coluna === -1) {
      coluna = finsDasColunas.length;
      finsDasColunas.push(ocupacao.horaFim);
    } else {
      finsDasColunas[coluna] = ocupacao.horaFim;
    }
    fimDoGrupo =
      grupo.length === 0 || ocupacao.horaFim > fimDoGrupo ? ocupacao.horaFim : fimDoGrupo;
    grupo.push({ id: ocupacao.id, coluna });
  });
  fecharGrupo();
  return posicoes;
}

/**
 * Visao do dia no computador: uma coluna por quadra, cada horario com a
 * altura da sua duracao. Clicar num espaco livre de uma quadra abre o
 * formulario ja com a quadra, a data e a hora.
 */
export function VisaoDiaQuadras({
  data,
  itens,
  quadras,
  hoje,
  agora,
  aoAbrir,
  aoAdicionar,
}: {
  data: string;
  itens: ItemAgenda[];
  quadras: Quadra[];
  hoje: string;
  /** "YYYY-MM-DDTHH:mm:ss" — desenha a linha do agora quando a data e hoje. */
  agora: string;
  aoAbrir: (item: ItemAgenda) => void;
  aoAdicionar?: (inicial: { data: string; horaInicio: string; quadraId: Quadra["id"] }) => void;
}) {
  const porQuadra = useMemo(
    () =>
      quadras.map((quadra) => {
        const daQuadra = itens.filter((i) => i.ocupacao.quadraId === quadra.id);
        return {
          quadra,
          itens: daQuadra,
          posicoes: subcolunas(daQuadra),
          ativas: daQuadra.filter((i) => !i.cancelada && i.ocupacao.tipo !== "Bloqueio").length,
        };
      }),
    [quadras, itens],
  );

  const passado = data < hoje;
  const minutoAgora =
    agora.slice(0, 10) === data ? horaParaMinutos(agora.slice(11, 16)) : undefined;
  const mostrarAgora =
    minutoAgora !== undefined &&
    minutoAgora >= ABERTURA_EM_MINUTOS &&
    minutoAgora <= FECHAMENTO_EM_MINUTOS;
  const colunas = `58px repeat(${quadras.length}, minmax(0, 1fr))`;
  const primeiroInicio =
    itens.length > 0 ? horaParaMinutos(itens[0].ocupacao.horaInicio) : undefined;

  // Ao abrir um dia, a grade rola ate o "agora" (se for hoje) ou ate o
  // primeiro horario. So rola de novo quando muda o dia, para nao atrapalhar
  // quem esta navegando pela grade.
  const rolagem = useRef<HTMLDivElement>(null);
  const ultimaRolagem = useRef("");
  useEffect(() => {
    const alvo = mostrarAgora ? minutoAgora : primeiroInicio;
    const chave = `${data}|${mostrarAgora ? "agora" : "inicio"}`;
    if (!rolagem.current || alvo === undefined || ultimaRolagem.current === chave) return;
    ultimaRolagem.current = chave;
    rolagem.current.scrollTop = Math.max((alvo - ABERTURA_EM_MINUTOS) * PX_POR_MINUTO - 48, 0);
  }, [data, mostrarAgora, minutoAgora, primeiroInicio]);

  return (
    <div
      ref={rolagem}
      className="max-h-[calc(100vh-22rem)] min-h-[28rem] overflow-auto rolagem-suave"
    >
      <div className={quadras.length > 2 ? "min-w-[860px]" : ""}>
        <div
          className="sticky top-0 z-20 grid border-b border-areia-200 bg-white shadow-sm"
          style={{ gridTemplateColumns: colunas }}
        >
          <div className="sticky left-0 z-10 border-r border-areia-200 bg-white" />
          {porQuadra.map(({ quadra, ativas }) => (
            <div
              key={quadra.id}
              className="border-r border-areia-200 px-2 py-2 text-center last:border-r-0"
            >
              <p className="text-sm font-semibold text-areia-900">{quadra.nome}</p>
              <p className="text-[11px] text-areia-500">
                {quadra.piso === "cimento" ? "Cimento" : "Saibro"} · {ativas}{" "}
                {ativas === 1 ? "horário" : "horários"}
              </p>
            </div>
          ))}
        </div>

        <div className="relative grid" style={{ gridTemplateColumns: colunas }}>
          <div
            className="sticky left-0 z-10 border-r border-areia-200 bg-white"
            style={{ height: ALTURA_DA_GRADE }}
          >
            {FAIXAS_HORARIAS.map((faixa, i) => (
              <span
                key={faixa}
                className="absolute right-2 text-[11px] font-medium tabular-nums text-areia-500"
                style={{ top: i * ALTURA_DA_HORA + 4 }}
              >
                {faixa}
              </span>
            ))}
          </div>

          {porQuadra.map(({ quadra, itens: daQuadra, posicoes }) => (
            <div
              key={quadra.id}
              className={`relative border-r border-areia-200 last:border-r-0 ${
                data === hoje ? "bg-saibro-50/30" : passado ? "bg-areia-50/60" : ""
              }`}
              style={{ height: ALTURA_DA_GRADE }}
            >
              {FAIXAS_HORARIAS.map((faixa, i) => (
                <div
                  key={faixa}
                  className="group/faixa absolute inset-x-0 border-t border-areia-200 first:border-t-0"
                  style={{ top: i * ALTURA_DA_HORA, height: ALTURA_DA_HORA }}
                >
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-areia-100"
                    style={{ top: ALTURA_DA_HORA / 2 }}
                  />
                  {aoAdicionar && !passado && (
                    <button
                      type="button"
                      onClick={() => aoAdicionar({ data, horaInicio: faixa, quadraId: quadra.id })}
                      className="absolute inset-1 flex items-center justify-center rounded-lg border border-dashed border-transparent text-areia-400 opacity-0 transition-all hover:border-saibro-300 hover:bg-saibro-50/70 hover:text-saibro-600 focus-visible:opacity-100 group-hover/faixa:opacity-100"
                      aria-label={`Novo horário na ${quadra.nome}, ${formatarDiaMes(data)} às ${faixa}`}
                      title="Novo horário"
                    >
                      <IconeMais className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              {daQuadra.map((item) => {
                const inicio = horaParaMinutos(item.ocupacao.horaInicio);
                const fim = horaParaMinutos(item.ocupacao.horaFim);
                const { coluna, total } = posicoes.get(item.ocupacao.id) ?? { coluna: 0, total: 1 };
                return (
                  <BlocoNoDia
                    key={item.ocupacao.id}
                    item={item}
                    aoAbrir={aoAbrir}
                    posicao={{
                      top: (inicio - ABERTURA_EM_MINUTOS) * PX_POR_MINUTO + 1,
                      height: Math.max((fim - inicio) * PX_POR_MINUTO - 3, 24),
                      left: `calc(${(coluna / total) * 100}% + 3px)`,
                      width: `calc(${100 / total}% - 6px)`,
                    }}
                  />
                );
              })}
            </div>
          ))}

          {mostrarAgora && minutoAgora !== undefined && (
            <div
              className="pointer-events-none absolute right-0 z-10 flex items-center"
              style={{ left: 52, top: (minutoAgora - ABERTURA_EM_MINUTOS) * PX_POR_MINUTO - 4 }}
              aria-hidden="true"
            >
              <span className="h-2 w-2 rounded-full bg-tijolo-600" />
              <span className="h-0.5 flex-1 bg-tijolo-600/80" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

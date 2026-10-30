"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { IconeImpressora } from "@/components/agenda/Icones";
import { intervalo, rotuloCurtoDaQuadra } from "@/components/agenda/estilos";
import { useAgora } from "@/components/agenda/useAgora";
import { CabecalhoDaPagina, LinkDeVolta } from "@/components/ui/CabecalhoDaPagina";
import { Carregando } from "@/components/ui/Carregando";
import { FAIXAS_HORARIAS, HOJE } from "@/lib/banco/constantes";
import {
  FILTRO_INICIAL,
  montarAgenda,
  quadrasDaArena,
  type ItemAgenda,
} from "@/lib/consultas/agenda";
import { DIAS_SEMANA_LONGO, diaDaSemana, formatarDataExtenso, horaParaMinutos } from "@/lib/date";
import { useApp } from "@/store/AppStore";

/**
 * Para imprimir: esconde a barra do topo, a navegacao e o rodape do sistema,
 * tira o fundo e usa a folha A4 deitada. So vale enquanto esta tela esta aberta.
 */
const ESTILO_DE_IMPRESSAO = `
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  html, body { background: #fff !important; }
  body header, body footer, body nav, [aria-live] { display: none !important; }
  .fundo-arena { min-height: 0 !important; background: none !important; }
  main { padding: 0 !important; }
  .folha-impressao {
    box-shadow: none !important; border: 0 !important; border-radius: 0 !important;
    padding: 0 2px !important; overflow: visible !important;
  }
  .folha-impressao tr { break-inside: avoid; }
}
`;

export default function PaginaImprimirAgenda() {
  return (
    <Suspense fallback={<Carregando />}>
      <ImpressaoPelaUrl />
    </Suspense>
  );
}

function ImpressaoPelaUrl() {
  const parametros = useSearchParams();
  const data = parametros.get("data");
  return <AgendaParaImprimir key={data ?? ""} dataDaUrl={data} />;
}

/** Agenda de um dia em formato de papel: uma coluna por quadra, para a transicao do caderno. */
function AgendaParaImprimir({ dataDaUrl }: { dataDaUrl: string | null }) {
  const { banco } = useApp();
  const agora = useAgora();
  const [data, setData] = useState(
    dataDaUrl && /^\d{4}-\d{2}-\d{2}$/.test(dataDaUrl) ? dataDaUrl : HOJE,
  );
  const quadras = quadrasDaArena(banco);
  const itens = useMemo(
    () => montarAgenda(banco, [data], FILTRO_INICIAL, agora).get(data) ?? [],
    [banco, data, agora],
  );
  const ativos = itens.filter((i) => !i.cancelada);
  const canceladas = itens.filter((i) => i.cancelada);

  /** Celula (faixa, quadra): o que comeca nessa hora e o que continua de antes. */
  function celula(faixa: string, quadraId: string) {
    const comeco = horaParaMinutos(faixa);
    const daQuadra = ativos.filter((i) => i.ocupacao.quadraId === quadraId);
    return {
      comecam: daQuadra.filter((i) => {
        const inicio = horaParaMinutos(i.ocupacao.horaInicio);
        return inicio >= comeco && inicio < comeco + 60;
      }),
      continuam: daQuadra.filter(
        (i) =>
          horaParaMinutos(i.ocupacao.horaInicio) < comeco &&
          horaParaMinutos(i.ocupacao.horaFim) > comeco,
      ),
    };
  }

  return (
    <div className="space-y-5">
      <style>{ESTILO_DE_IMPRESSAO}</style>

      <LinkDeVolta href={`/agenda?data=${data}&visao=dia`} className="print:hidden">
        Agenda
      </LinkDeVolta>

      <CabecalhoDaPagina
        className="print:hidden"
        titulo="Imprimir a agenda do dia"
        descricao="Uma coluna por quadra, com espaço para marcar a presença à mão."
        acoes={
          <>
            <input
              type="date"
              value={data}
              onChange={(e) => /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && setData(e.target.value)}
              className="campo w-auto py-2"
              aria-label="Data da agenda"
            />
            <button type="button" onClick={() => window.print()} className="btn-primario py-2">
              <IconeImpressora className="h-4 w-4" />
              Imprimir
            </button>
          </>
        }
      />

      <section className="folha-impressao card overflow-x-auto bg-white p-5 text-areia-900">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b-2 border-areia-900 pb-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-tijolo-700">
              Red Tennis · Agenda do dia
            </p>
            <p className="text-xl font-bold">
              {DIAS_SEMANA_LONGO[diaDaSemana(data)]}, {formatarDataExtenso(data)}
            </p>
          </div>
          <p className="text-[11px] text-areia-600">
            {ativos.filter((i) => i.ocupacao.tipo !== "Bloqueio").length} horários · ☐ marque P
            (presente), F (falta) ou A (avisou)
          </p>
        </div>

        <table className="w-full min-w-[900px] table-fixed border-collapse text-[11px] leading-tight">
          <thead>
            <tr>
              <th className="w-14 border border-areia-400 bg-areia-100 px-1 py-1 text-left">
                Hora
              </th>
              {quadras.map((q) => (
                <th
                  key={q.id}
                  className="border border-areia-400 bg-areia-100 px-1.5 py-1 text-left"
                >
                  {q.nome} <span className="font-normal text-areia-600">({q.piso})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FAIXAS_HORARIAS.map((faixa) => (
              <tr key={faixa}>
                <th
                  scope="row"
                  className="border border-areia-400 px-1 py-1 text-left align-top font-semibold tabular-nums"
                >
                  {faixa}
                </th>
                {quadras.map((q) => {
                  const { comecam, continuam } = celula(faixa, q.id);
                  return (
                    <td key={q.id} className="border border-areia-400 px-1.5 py-1 align-top">
                      {continuam.map((item) => (
                        <p key={item.ocupacao.id} className="italic text-areia-600">
                          ↳ {item.ocupacao.tipo === "Bloqueio" ? "bloqueada" : item.ocupacao.tipo}{" "}
                          até {item.ocupacao.horaFim}
                        </p>
                      ))}
                      {comecam.map((item) => (
                        <ItemImpresso key={item.ocupacao.id} item={item} />
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {canceladas.length > 0 && (
          <div className="mt-3 text-[11px]">
            <p className="font-semibold">Canceladas neste dia ({canceladas.length}):</p>
            <p className="text-areia-700">
              {canceladas
                .map(
                  (i) =>
                    `${rotuloCurtoDaQuadra(i.ocupacao.quadraId)} ${i.ocupacao.horaInicio} ${i.ocupacao.tipo}${
                      i.participantes.length
                        ? ` (${i.participantes.map((p) => p.nome).join(", ")})`
                        : ""
                    } — ${i.ocupacao.motivoCancelamento ?? "sem motivo"}`,
                )
                .join(" · ")}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ItemImpresso({ item }: { item: ItemAgenda }) {
  const { ocupacao } = item;
  if (ocupacao.tipo === "Bloqueio") {
    return (
      <p className="rounded-sm bg-areia-200 px-1 py-0.5 font-semibold">
        {intervalo(ocupacao)} · BLOQUEADA{ocupacao.descricao ? ` · ${ocupacao.descricao}` : ""}
      </p>
    );
  }
  return (
    <div className="mb-1 last:mb-0">
      <p className="font-semibold">
        {intervalo(ocupacao)} · {ocupacao.tipo}
        {item.estadoReserva === "vencida" && " · ⚠ prazo vencido"}
        {item.estadoReserva === "aguardando" && " · aguardando pagamento"}
        {item.reposicao && " · reposição"}
      </p>
      <ul>
        {item.participantes.map((p) => (
          <li key={p.participacao.id}>☐ {p.nome}</li>
        ))}
      </ul>
      {item.professor && <p className="text-areia-600">Prof. {item.professor.nome}</p>}
    </div>
  );
}

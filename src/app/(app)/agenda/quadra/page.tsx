"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ListaDePresenca } from "@/components/agenda/ListaDePresenca";
import { Marcadores } from "@/components/agenda/Marcadores";
import { FUNDO_BLOQUEIO, ROTULO_SITUACAO, intervalo, plural } from "@/components/agenda/estilos";
import { useAgora } from "@/components/agenda/useAgora";
import { CabecalhoDaPagina, LinkDeVolta } from "@/components/ui/CabecalhoDaPagina";
import { IconeAnterior, IconeProximo } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import {
  FILTRO_INICIAL,
  montarAgenda,
  quadraPelaUrl,
  quadrasDaArena,
  type ItemAgenda,
} from "@/lib/consultas/agenda";
import { DIAS_SEMANA_LONGO, diaDaSemana, formatarData, somarDias } from "@/lib/date";
import { ESTILO_OCUPACAO } from "@/lib/theme";
import { useApp } from "@/store/AppStore";

export default function PaginaModoQuadra() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <ModoQuadraPelaUrl />
    </Suspense>
  );
}

function ModoQuadraPelaUrl() {
  const parametros = useSearchParams();
  return (
    <ModoQuadra
      key={parametros.toString()}
      quadraDaUrl={parametros.get("quadra")}
      dataDaUrl={parametros.get("data")}
    />
  );
}

/**
 * Modo quadra (tablet de 10" na horizontal, Hipotese H11): as aulas do dia
 * de UMA quadra, em lista, com botoes grandes de presenca e falta por aluno,
 * para usar na beira da quadra. `?quadra=<id>` escolhe a quadra.
 */
function ModoQuadra({
  quadraDaUrl,
  dataDaUrl,
}: {
  quadraDaUrl: string | null;
  dataDaUrl: string | null;
}) {
  const { banco, colaborador } = useApp();
  const agora = useAgora();
  const podeEditar = colaborador.perfil !== "professor";
  const quadras = quadrasDaArena(banco);
  const quadraId = quadraPelaUrl(banco, quadraDaUrl);
  const quadra = quadras.find((q) => q.id === quadraId);
  const [data, setData] = useState(
    dataDaUrl && /^\d{4}-\d{2}-\d{2}$/.test(dataDaUrl) ? dataDaUrl : HOJE,
  );

  const itens = useMemo(
    () =>
      quadraId
        ? (montarAgenda(banco, [data], { ...FILTRO_INICIAL, quadraId }, agora).get(data) ?? [])
        : [],
    [banco, quadraId, data, agora],
  );
  const aulas = itens.filter((i) => !i.cancelada && i.ocupacao.tipo !== "Bloqueio").length;
  const minutoAgora = agora.slice(0, 10) === data ? agora.slice(11, 16) : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <LinkDeVolta href="/agenda">Agenda</LinkDeVolta>

      <CabecalhoDaPagina
        titulo="Modo quadra"
        descricao={
          <>
            {DIAS_SEMANA_LONGO[diaDaSemana(data)]}, {formatarData(data)}
            {data === HOJE && " · hoje"}
            {quadra && ` · ${plural(aulas, "horário", "horários")}`}
          </>
        }
        acoes={
          <>
            <button
              type="button"
              onClick={() => setData((atual) => somarDias(atual, -1))}
              className="btn-secundario min-h-[48px] px-3"
              aria-label="Dia anterior"
            >
              <IconeAnterior className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setData(HOJE)}
              className="btn-secundario min-h-[48px] px-4 text-base"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setData((atual) => somarDias(atual, 1))}
              className="btn-secundario min-h-[48px] px-3"
              aria-label="Próximo dia"
            >
              <IconeProximo className="h-5 w-5" />
            </button>
          </>
        }
      />

      <nav aria-label="Escolher quadra" className="flex flex-wrap gap-2">
        {quadras.map((q) => (
          <Link
            key={q.id}
            href={`/agenda/quadra?quadra=${q.id}${data !== HOJE ? `&data=${data}` : ""}`}
            aria-current={q.id === quadraId ? "page" : undefined}
            className={`flex min-h-[52px] min-w-[120px] flex-1 items-center justify-center rounded-2xl border px-4 text-base font-semibold transition-colors sm:flex-none ${
              q.id === quadraId
                ? "border-saibro-600 bg-saibro-600 text-white shadow-card"
                : "border-areia-200 bg-white text-areia-800 hover:border-saibro-300 hover:bg-saibro-50"
            }`}
          >
            {q.nome}
          </Link>
        ))}
      </nav>

      {!podeEditar && (
        <p className="rounded-2xl border border-saibro-200 bg-saibro-50/70 px-4 py-3 text-sm text-saibro-900">
          Perfil de professor: só consulta (Hipótese H9). A presença é marcada pela recepção.
        </p>
      )}

      {!quadra ? (
        <p className="card px-6 py-10 text-center text-base text-areia-600">
          Escolha a quadra acima para ver as aulas do dia.
        </p>
      ) : itens.length === 0 ? (
        <p className="card px-6 py-10 text-center text-base text-areia-600">
          Nenhum horário na {quadra.nome} neste dia.
        </p>
      ) : (
        <ul className="space-y-4">
          {itens.map((item) => (
            <AulaNaQuadra
              key={item.ocupacao.id}
              item={item}
              podeEditar={podeEditar}
              agora={Boolean(
                minutoAgora &&
                item.ocupacao.horaInicio <= minutoAgora &&
                minutoAgora < item.ocupacao.horaFim,
              )}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AulaNaQuadra({
  item,
  podeEditar,
  agora,
}: {
  item: ItemAgenda;
  podeEditar: boolean;
  agora: boolean;
}) {
  const { ocupacao } = item;
  const estilo = ESTILO_OCUPACAO[ocupacao.tipo];

  if (ocupacao.tipo === "Bloqueio") {
    return (
      <li
        className={`rounded-2xl border border-areia-300 px-5 py-4 ${item.cancelada ? "opacity-60" : ""}`}
        style={{ backgroundColor: "#F4F1EC", backgroundImage: FUNDO_BLOQUEIO }}
      >
        <p className="text-lg font-semibold text-areia-800">
          {intervalo(ocupacao)} · Quadra bloqueada
          {ocupacao.descricao ? ` · ${ocupacao.descricao}` : ""}
        </p>
        <Marcadores item={item} className="mt-1" />
      </li>
    );
  }

  return (
    <li
      className={`card overflow-hidden ${agora ? "ring-4 ring-saibro-400/60" : ""} ${item.cancelada ? "opacity-70" : ""}`}
    >
      <div className="flex flex-col md:flex-row">
        <div
          className="flex shrink-0 flex-row items-center gap-4 border-b border-areia-200 px-5 py-4 md:w-56 md:flex-col md:items-start md:gap-1 md:border-b-0 md:border-r"
          style={{
            backgroundColor: estilo.fundo,
            borderLeft: `6px solid ${item.cancelada ? "#B3A897" : estilo.cor}`,
          }}
        >
          <p className="text-3xl font-bold tabular-nums text-areia-900">{ocupacao.horaInicio}</p>
          <div className="space-y-1">
            <p className="text-sm text-areia-600">até {ocupacao.horaFim}</p>
            <p
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: estilo.texto }}
            >
              {ocupacao.tipo}
            </p>
            {item.professor && <p className="text-sm text-areia-700">{item.professor.nome}</p>}
            <p className="text-xs text-areia-500">{ROTULO_SITUACAO[ocupacao.situacao]}</p>
            {agora && (
              <span className="inline-block rounded-md bg-saibro-600 px-2 py-0.5 text-xs font-bold text-white">
                Agora
              </span>
            )}
            <Marcadores item={item} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <ListaDePresenca item={item} podeEditar={podeEditar} grande />
        </div>
      </div>
    </li>
  );
}

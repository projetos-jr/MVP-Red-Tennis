"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeRelogio } from "@/components/ui/Icons";
import { Segmentado } from "@/components/ui/Segmentado";
import type { SiglaReposicao } from "@/lib/banco/tipos";
import type { AulaDoAluno } from "@/lib/consultas/alunos";
import { nomeCompacto, rotuloDaQuadra } from "@/lib/consultas/base";
import { DIAS_SEMANA_CURTO, diaDaSemana, formatarData } from "@/lib/date";
import { estiloDaSigla, formatarMinutos } from "@/lib/theme";
import { ESTILO_SITUACAO_NA_AULA } from "./estilos";

const POR_PAGINA = 12;

type Filtro = "todas" | "faltas" | "canceladas";

const FILTROS: Record<Filtro, (aula: AulaDoAluno) => boolean> = {
  todas: () => true,
  faltas: (a) => a.situacao === "falta" || a.situacao === "falta_avisada",
  canceladas: (a) => a.situacao === "cancelada" || a.situacao === "suspensa",
};

/**
 * Historico de aulas do aluno (ocupacoes ate hoje): presenca, falta com a
 * sigla, cancelamentos, minutos de reposicao e quem marcou.
 */
export function HistoricoAulas({ aulas, siglas }: { aulas: AulaDoAluno[]; siglas: SiglaReposicao[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [limite, setLimite] = useState(POR_PAGINA);
  const filtradas = useMemo(() => aulas.filter(FILTROS[filtro]), [aulas, filtro]);
  const visiveis = filtradas.slice(0, limite);
  const nomeDaSigla = useMemo(() => new Map(siglas.map((s) => [s.codigo, s.nome])), [siglas]);

  function mudarFiltro(novo: Filtro) {
    setFiltro(novo);
    setLimite(POR_PAGINA);
  }

  return (
    <Card>
      <CardHeader
        titulo="Histórico de aulas"
        descricao="Presenças, faltas e cancelamentos, com a sigla e quem marcou."
        icone={<IconeRelogio className="h-5 w-5" />}
        acao={
          <Segmentado
            aria="Filtrar o histórico de aulas"
            valor={filtro}
            aoMudar={mudarFiltro}
            opcoes={[
              { valor: "todas", rotulo: "Todas" },
              { valor: "faltas", rotulo: "Faltas" },
              { valor: "canceladas", rotulo: "Canceladas" },
            ]}
          />
        }
      />

      {/* Celular: cada aula vira um cartao compacto */}
      <ul className="divide-y divide-areia-100 md:hidden">
        {visiveis.map((aula) => {
          const estilo = ESTILO_SITUACAO_NA_AULA[aula.situacao];
          const { ocupacao } = aula;
          return (
            <li key={`${ocupacao.id}-${aula.participacaoId ?? "s"}`} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold tabular-nums text-areia-900">
                  {DIAS_SEMANA_CURTO[diaDaSemana(ocupacao.data)]} {formatarData(ocupacao.data)} ·{" "}
                  {ocupacao.horaInicio}
                </span>
                <Badge cor={estilo.cor} fundo={estilo.fundo} borda={estilo.borda}>
                  {estilo.rotulo}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-areia-500">
                {rotuloDaQuadra(ocupacao.quadraId)} · {ocupacao.tipo}
                {aula.professorNome && ` · ${nomeCompacto(aula.professorNome)}`}
              </p>
              <Detalhes aula={aula} nomeDaSigla={nomeDaSigla} />
            </li>
          );
        })}
      </ul>

      <div className={`overflow-x-auto rolagem-suave ${visiveis.length > 0 ? "hidden md:block" : "hidden"}`}>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-areia-200 text-left text-xs uppercase tracking-wide text-areia-500">
              <th scope="col" className="px-5 py-2.5 font-medium">Data</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Horário</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Aula</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Professor</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Situação</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">Reposição</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-areia-100">
            {visiveis.map((aula) => {
              const estilo = ESTILO_SITUACAO_NA_AULA[aula.situacao];
              const { ocupacao } = aula;
              return (
                <tr key={`${ocupacao.id}-${aula.participacaoId ?? "s"}`} className="align-top hover:bg-areia-50">
                  <td className="whitespace-nowrap px-5 py-2.5 font-medium tabular-nums text-areia-800">
                    <span className="mr-1 text-areia-500">{DIAS_SEMANA_CURTO[diaDaSemana(ocupacao.data)]}</span>
                    {formatarData(ocupacao.data)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-areia-600">
                    {ocupacao.horaInicio}–{ocupacao.horaFim}
                  </td>
                  <td className="px-3 py-2.5 text-areia-600">
                    <span className="block whitespace-nowrap">{rotuloDaQuadra(ocupacao.quadraId)}</span>
                    <span className="block text-xs text-areia-500">
                      {ocupacao.tipo}
                      {ocupacao.descricao && ` · ${ocupacao.descricao}`}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-areia-600">
                    {aula.professorNome ? nomeCompacto(aula.professorNome) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge cor={estilo.cor} fundo={estilo.fundo} borda={estilo.borda}>
                      {estilo.rotulo}
                    </Badge>
                    <Detalhes aula={aula} nomeDaSigla={nomeDaSigla} semReposicao />
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right text-xs">
                    <Reposicao aula={aula} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtradas.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-areia-500">
          {aulas.length === 0 ? "Nenhuma aula registrada ainda." : "Nenhuma aula com esse filtro."}
        </p>
      )}

      {filtradas.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-areia-200 px-5 py-3">
          <span className="text-xs text-areia-500">
            Mostrando {visiveis.length} de {filtradas.length}
          </span>
          {filtradas.length > limite && (
            <button
              type="button"
              onClick={() => setLimite(limite + POR_PAGINA)}
              className="btn-secundario px-3 py-1.5 text-xs"
            >
              Ver mais aulas
            </button>
          )}
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-areia-200 px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-areia-500">Siglas</span>
        {siglas.map((sigla) => (
          <span key={sigla.codigo} className="text-xs text-areia-600" title={sigla.descricao}>
            <strong className="font-semibold" style={{ color: estiloDaSigla(sigla.codigo).cor }}>
              {sigla.codigo}
            </strong>{" "}
            = {sigla.nome}
          </span>
        ))}
        <span className="text-xs text-areia-600">
          <strong className="font-semibold text-sky-700">Suspensa</strong> = congelamento, sem crédito
        </span>
      </footer>
    </Card>
  );
}

/** Sigla (ou motivo), quem marcou e, no celular, os minutos de reposicao. */
function Detalhes({
  aula,
  nomeDaSigla,
  semReposicao,
}: {
  aula: AulaDoAluno;
  nomeDaSigla: Map<string, string>;
  semReposicao?: boolean;
}) {
  const ehSigla = aula.motivo ? nomeDaSigla.has(aula.motivo) : false;
  const temReposicao =
    !semReposicao && Boolean(aula.minutosCreditados || aula.minutosDeReposicao);
  if (!aula.motivo && !aula.marcadoPor && !temReposicao) return null;

  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-areia-600">
      {aula.motivo && ehSigla && (
        <span className="flex items-center gap-1.5">
          <Badge
            cor={estiloDaSigla(aula.motivo).cor}
            fundo={estiloDaSigla(aula.motivo).fundo}
            title={nomeDaSigla.get(aula.motivo)}
            className="px-2 py-0.5 text-[11px]"
          >
            {aula.motivo}
          </Badge>
          {nomeDaSigla.get(aula.motivo)}
        </span>
      )}
      {aula.motivo && !ehSigla && <span>{aula.motivo}</span>}
      {temReposicao && <Reposicao aula={aula} />}
      {aula.marcadoPor && <span className="text-areia-500">por {aula.marcadoPor}</span>}
    </p>
  );
}

function Reposicao({ aula }: { aula: AulaDoAluno }) {
  if (aula.minutosCreditados) {
    return (
      <span className="font-semibold text-emerald-700">
        +{formatarMinutos(aula.minutosCreditados)} de crédito
      </span>
    );
  }
  if (aula.minutosDeReposicao) {
    return (
      <span className="font-medium text-saibro-700">
        Usou {formatarMinutos(aula.minutosDeReposicao)}
      </span>
    );
  }
  return <span className="text-areia-400">—</span>;
}

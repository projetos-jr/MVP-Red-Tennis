"use client";

import { useMemo, useState } from "react";
import { IconeLapis } from "@/components/base/Icones";
import { Badge } from "@/components/ui/Badge";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { IconeLixeira, IconeMais, IconeNota } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import {
  apagarPlano,
  desativarPlano,
  reativarPlano,
} from "@/lib/banco/operacoes/configuracoes";
import type { Plano } from "@/lib/banco/tipos";
import { usoDosPlanos } from "@/lib/consultas/configuracoes";
import { ESTILO_OCUPACAO, formatarMinutos, formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { ModalPlano } from "./ModalPlano";
import { SecaoDeConfiguracao, SeloHipotese } from "./Pecas";

type Acao = { tipo: "editar"; plano?: Plano } | { tipo: "desativar" | "apagar"; plano: Plano };

function SituacaoDoPlano({ plano }: { plano: Plano }) {
  return plano.ativo ? (
    <span className="chip border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800">
      Ativo
    </span>
  ) : (
    <span className="chip border border-areia-300 bg-areia-50 px-2 py-0.5 text-[11px] text-areia-600">
      Desativado
    </span>
  );
}

function TipoDoPlano({ plano }: { plano: Plano }) {
  const estilo = ESTILO_OCUPACAO[plano.tipo];
  return (
    <Badge cor={estilo.texto} fundo={estilo.fundo} borda={estilo.borda} className="text-[11px]">
      {plano.tipo}
    </Badge>
  );
}

/** Catalogo de planos: incluir, editar, desativar e apagar o que nunca foi usado (H2, H3). */
export function SecaoPlanos() {
  const { banco } = useApp();
  const gravar = useGravar();
  const [acao, setAcao] = useState<Acao | null>(null);
  const uso = useMemo(() => usoDosPlanos(banco, HOJE), [banco]);
  const { planos } = banco;
  const ativos = planos.filter((p) => p.ativo).length;

  const usoDe = (plano: Plano) => uso.get(plano.id) ?? { vigentes: 0, total: 0 };

  function reativar(plano: Plano) {
    gravar(reativarPlano, { id: plano.id }, `Plano "${plano.nome}" reativado.`);
  }

  function confirmar() {
    if (!acao || acao.tipo === "editar") return;
    const gravou =
      acao.tipo === "desativar"
        ? gravar(desativarPlano, { id: acao.plano.id }, `Plano "${acao.plano.nome}" desativado.`)
        : gravar(apagarPlano, { id: acao.plano.id }, `Plano "${acao.plano.nome}" apagado.`);
    if (gravou) setAcao(null);
  }

  function acoesDo(plano: Plano) {
    return (
      <div className="flex flex-wrap justify-end gap-1">
        <button
          type="button"
          onClick={() => setAcao({ tipo: "editar", plano })}
          className="btn-fantasma px-2 py-1.5 text-xs"
          aria-label={`Editar o plano ${plano.nome}`}
        >
          <IconeLapis className="h-4 w-4" />
          Editar
        </button>
        {plano.ativo ? (
          <button
            type="button"
            onClick={() => setAcao({ tipo: "desativar", plano })}
            className="btn-fantasma px-2 py-1.5 text-xs text-tijolo-700"
            aria-label={`Desativar o plano ${plano.nome}`}
          >
            Desativar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => reativar(plano)}
            className="btn-fantasma px-2 py-1.5 text-xs text-emerald-800"
            aria-label={`Reativar o plano ${plano.nome}`}
          >
            Reativar
          </button>
        )}
        <button
          type="button"
          onClick={() => setAcao({ tipo: "apagar", plano })}
          className="btn-fantasma px-2 py-1.5 text-tijolo-700"
          aria-label={`Apagar o plano ${plano.nome}`}
          title="Apagar plano"
        >
          <IconeLixeira className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const planoEmAcao = acao && acao.tipo !== "editar" ? acao.plano : undefined;
  const usoEmAcao = planoEmAcao ? usoDe(planoEmAcao) : { vigentes: 0, total: 0 };

  return (
    <SecaoDeConfiguracao
      id="planos"
      titulo="Planos"
      descricao={`Catálogo oferecido na matrícula: ${planos.length} planos, ${ativos} ativos.`}
      icone={<IconeNota className="h-5 w-5" />}
      acao={
        <button type="button" onClick={() => setAcao({ tipo: "editar" })} className="btn-primario">
          <IconeMais className="h-4 w-4" />
          Novo plano
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-areia-100 px-5 py-3 text-xs leading-relaxed text-areia-600">
        <SeloHipotese numero={3} />
        <span className="min-w-0 flex-1">
          Cada plano é da tabela nova ou da antiga, e o aluno mantém o valor da matrícula. Plano com
          matrícula não se apaga: desative-o para que deixe de ser oferecido.
        </span>
        <SeloHipotese numero={2} />
        <span>“Plano de locação” (amarelo): significado a confirmar.</span>
      </div>

      {/* Computador e tablet: tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-areia-200 text-left text-xs uppercase tracking-wide text-areia-500">
              <th scope="col" className="px-5 py-2.5 font-medium">Plano</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Valor mensal</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Aulas</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Tabela</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Matrículas</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Situação</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-areia-100">
            {planos.map((plano) => {
              const { vigentes } = usoDe(plano);
              return (
                <tr key={plano.id} className={plano.ativo ? "" : "bg-areia-50/70 text-areia-500"}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-areia-900">{plano.nome}</p>
                    <div className="mt-1">
                      <TipoDoPlano plano={plano} />
                    </div>
                  </td>
                  <td className="px-3 py-3 font-semibold tabular-nums text-areia-900">
                    {formatarMoeda(plano.valorMensal)}
                  </td>
                  <td className="px-3 py-3 text-areia-700">
                    {plano.aulasPorSemana}× por semana
                    <span className="block text-xs text-areia-500">{formatarMinutos(plano.duracaoMinutos)} cada</span>
                  </td>
                  <td className="px-3 py-3 text-areia-700">{plano.tabela === "nova" ? "Nova" : "Antiga"}</td>
                  <td className="px-3 py-3 tabular-nums text-areia-700">
                    {vigentes === 0 ? "Nenhuma" : `${vigentes} vigente${vigentes > 1 ? "s" : ""}`}
                  </td>
                  <td className="px-3 py-3">
                    <SituacaoDoPlano plano={plano} />
                  </td>
                  <td className="px-5 py-3">{acoesDo(plano)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Celular: cartoes */}
      <ul className="divide-y divide-areia-100 md:hidden">
        {planos.map((plano) => {
          const { vigentes } = usoDe(plano);
          return (
            <li key={plano.id} className={`px-4 py-3.5 ${plano.ativo ? "" : "bg-areia-50/70"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-areia-900">{plano.nome}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <TipoDoPlano plano={plano} />
                    <SituacaoDoPlano plano={plano} />
                  </div>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-areia-900">
                  {formatarMoeda(plano.valorMensal)}
                </p>
              </div>
              <p className="mt-1.5 text-xs text-areia-600">
                {plano.aulasPorSemana}× por semana · {formatarMinutos(plano.duracaoMinutos)} · tabela{" "}
                {plano.tabela} · {vigentes === 0 ? "nenhuma matrícula" : `${vigentes} matrícula(s) vigente(s)`}
              </p>
              <div className="mt-1.5">{acoesDo(plano)}</div>
            </li>
          );
        })}
      </ul>

      {acao?.tipo === "editar" && (
        <ModalPlano
          plano={acao.plano}
          matriculas={acao.plano ? usoDe(acao.plano).total : 0}
          aoFechar={() => setAcao(null)}
        />
      )}

      <Confirmacao
        aberto={acao?.tipo === "desativar"}
        titulo="Desativar plano?"
        mensagem={
          <>
            <strong>{planoEmAcao?.nome}</strong> deixa de ser oferecido em matrículas novas.
            {usoEmAcao.vigentes > 0 &&
              ` As ${usoEmAcao.vigentes} matrícula(s) vigente(s) continuam com ele, pelo valor combinado.`}{" "}
            Dá para reativar depois.
          </>
        }
        rotuloConfirmar="Desativar plano"
        perigoso
        aoConfirmar={confirmar}
        aoCancelar={() => setAcao(null)}
      />

      <Confirmacao
        aberto={acao?.tipo === "apagar"}
        titulo="Apagar plano?"
        mensagem={
          usoEmAcao.total > 0 ? (
            <>
              <strong>{planoEmAcao?.nome}</strong> aparece em {usoEmAcao.total} matrícula(s)
              {usoEmAcao.vigentes > 0 && `, ${usoEmAcao.vigentes} delas vigentes`}. O sistema não deixa
              apagar um plano em uso; prefira <strong>desativar</strong>.
            </>
          ) : (
            <>
              <strong>{planoEmAcao?.nome}</strong> sai do catálogo. Ele nunca foi usado em matrícula,
              e o histórico de alterações guarda como ele era.
            </>
          )
        }
        rotuloConfirmar="Apagar plano"
        perigoso
        aoConfirmar={confirmar}
        aoCancelar={() => setAcao(null)}
      />
    </SecaoDeConfiguracao>
  );
}

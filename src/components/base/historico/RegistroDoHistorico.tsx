"use client";

import Link from "next/link";
import { useState } from "react";
import { IconeLapis } from "@/components/base/Icones";
import { camposAlterados } from "@/components/registro/HistoricoDoRegistro";
import { IconeLixeira, IconeMais, IconeSeta } from "@/components/ui/Icons";
import type { Banco, RegistroAuditoria } from "@/lib/banco/tipos";
import {
  NOMES_DAS_ACOES,
  NOMES_DAS_TABELAS,
  camposDoRegistro,
  descreverRegistro,
  formatarValorDoCampo,
  mudancasNasPermissoes,
  mudancasNasSiglas,
  rotuloDoCampo,
} from "@/lib/consultas/configuracoes";
import { formatarDataHora } from "@/lib/date";

const ESTILO_DA_ACAO: Record<RegistroAuditoria["acao"], { classe: string; Icone: typeof IconeMais }> = {
  criar: { classe: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icone: IconeMais },
  alterar: { classe: "bg-saibro-50 text-saibro-700 ring-saibro-200", Icone: IconeLapis },
  apagar: { classe: "bg-tijolo-50 text-tijolo-700 ring-tijolo-200", Icone: IconeLixeira },
};

/** Campos que viram frases ("Recepção: passou a ver Histórico") em vez de antes → depois. */
function frasesDoCampo(banco: Banco, campo: string, antes: unknown, depois: unknown): string[] | undefined {
  if (campo === "permissoes") return mudancasNasPermissoes(antes, depois);
  if (campo === "siglas") return mudancasNasSiglas(banco, antes, depois);
  return undefined;
}

function Detalhe({ banco, registro }: { banco: Banco; registro: RegistroAuditoria }) {
  if (registro.acao !== "alterar") {
    const campos = camposDoRegistro(registro);
    return (
      <div className="mt-3 rounded-xl border border-areia-200 bg-areia-50/60 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-areia-500">
          {registro.acao === "criar" ? "Registro criado com" : "Como era antes de ser apagado"}
        </p>
        <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[12rem_minmax(0,1fr)]">
          {campos.map(({ campo, valor }) => (
            <div key={campo} className="contents">
              <dt className="font-medium text-areia-600">{rotuloDoCampo(campo)}</dt>
              <dd className="mb-1 break-words text-areia-800 sm:mb-0">
                {formatarValorDoCampo(banco, campo, valor)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  const campos = camposAlterados(registro);
  if (campos.length === 0) {
    return <p className="mt-3 text-xs text-areia-500">Nenhum campo mudou nesta gravação.</p>;
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-areia-200">
      <div className="hidden grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)] gap-4 bg-areia-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-areia-500 sm:grid">
        <span>Campo</span>
        <span>Antes</span>
        <span>Depois</span>
      </div>
      <ul className="divide-y divide-areia-100 text-xs">
        {campos.map(({ campo, antes, depois }) => {
          const frases = frasesDoCampo(banco, campo, antes, depois);
          return (
            <li
              key={campo}
              className="grid gap-1 px-3 py-2 sm:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4"
            >
              <span className="font-medium text-areia-700">{rotuloDoCampo(campo)}</span>
              {frases ? (
                <ul className="list-inside list-disc space-y-0.5 text-areia-800 sm:col-span-2">
                  {frases.map((frase) => (
                    <li key={frase}>{frase}</li>
                  ))}
                </ul>
              ) : (
                <>
                  <span className="break-words text-areia-500 line-through decoration-areia-300">
                    <span className="sr-only">Antes: </span>
                    {formatarValorDoCampo(banco, campo, antes)}
                  </span>
                  <span className="break-words font-medium text-areia-900">
                    <span className="sr-only">Depois: </span>
                    <span aria-hidden="true" className="text-areia-400 sm:hidden">→ </span>
                    {formatarValorDoCampo(banco, campo, depois)}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Uma linha do historico: quem fez, quando, o que, e o detalhe dos campos ao abrir. */
export function RegistroDoHistorico({
  banco,
  registro,
  tela,
}: {
  banco: Banco;
  registro: RegistroAuditoria;
  /** Tela onde o registro aparece (sem link quando o perfil nao abre a tela). */
  tela?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const { classe, Icone } = ESTILO_DA_ACAO[registro.acao];
  const idDoDetalhe = `detalhe-${registro.id}`;

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${classe}`}
          aria-hidden="true"
        >
          <Icone className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-areia-500">
            {NOMES_DAS_ACOES[registro.acao]} · {NOMES_DAS_TABELAS[registro.tabela]}
          </p>
          <p className="mt-0.5 break-words text-sm font-medium text-areia-900">
            {descreverRegistro(banco, registro)}
          </p>
          <p className="mt-0.5 text-xs text-areia-500">
            por <span className="font-medium text-areia-700">{registro.usuarioNome}</span> ·{" "}
            {formatarDataHora(registro.em)} · {registro.operacao}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={() => setAberto((atual) => !atual)}
            aria-expanded={aberto}
            aria-controls={idDoDetalhe}
            className="btn-fantasma px-2.5 py-1.5 text-xs"
          >
            {aberto ? "Ocultar" : "Ver detalhes"}
          </button>
          {tela && (
            <Link
              href={tela}
              className="inline-flex items-center gap-1 px-1 text-xs font-semibold text-tijolo-700 hover:underline"
            >
              Abrir <IconeSeta className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
      <div id={idDoDetalhe} hidden={!aberto} className="sm:pl-11">
        {aberto && <Detalhe banco={banco} registro={registro} />}
      </div>
    </li>
  );
}

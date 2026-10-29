"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { IconeCheck, IconeCongelado } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { HOJE } from "@/lib/banco/constantes";
import { gerarMensalidades } from "@/lib/banco/operacoes/financeiro";
import {
  mesSugeridoParaGerar,
  nomeDoMes,
  previaDasMensalidades,
  somarMesesNaCompetencia,
  type PreviaMensalidades,
} from "@/lib/consultas/financeiro";
import { formatarDiaMes } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { BadgeCongelado } from "./Etiquetas";

const MES_ATUAL = HOJE.slice(0, 7);

function mensalidades(n: number): string {
  return `${n} ${n === 1 ? "mensalidade" : "mensalidades"}`;
}

function Numero({ rotulo, valor, className = "" }: { rotulo: string; valor: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-areia-200 bg-areia-50 px-3 py-2.5 ${className}`}>
      <p className="text-xs font-medium text-areia-500">{rotulo}</p>
      <p className="mt-0.5 text-lg font-semibold text-areia-900">{valor}</p>
    </div>
  );
}

/**
 * Gera a mensalidade de cada matrícula vigente que ainda não tem a do mês.
 * Mostra antes quantas e quanto; depois, o resultado. Rodar de novo não
 * duplica (a regra é a mesma da prévia).
 */
export function ModalGerarMensalidades({
  aoFechar,
  aoVerNaLista,
}: {
  aoFechar: () => void;
  aoVerNaLista: (competencia: string) => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const [competencia, setCompetencia] = useState(() => mesSugeridoParaGerar(banco, HOJE));
  const [gerado, setGerado] = useState<PreviaMensalidades | null>(null);
  const previa = useMemo(() => previaDasMensalidades(banco, competencia), [banco, competencia]);
  const nome = nomeDoMes(competencia);

  function gerar(evento: FormEvent) {
    evento.preventDefault();
    const n = previa.itens.length;
    const mensagem = `${mensalidades(n)} de ${nome} ${n === 1 ? "gerada" : "geradas"}.`;
    if (gravar(gerarMensalidades, { competencia }, mensagem)) setGerado(previa);
  }

  if (gerado) {
    const vencimentos = gerado.itens.map((i) => i.vencimento).sort();
    return (
      <Modal aberto aoFechar={aoFechar} titulo="Mensalidades geradas" largura="md">
        <div className="space-y-3 px-5 py-5 text-sm text-areia-700">
          <p className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-emerald-900">
            <IconeCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              <strong>{mensalidades(gerado.itens.length)}</strong> de {nomeDoMes(gerado.competencia)}{" "}
              {gerado.itens.length === 1 ? "gerada" : "geradas"}, total{" "}
              <strong>{formatarMoeda(gerado.total)}</strong>
              {vencimentos.length > 0 &&
                `, com vencimentos de ${formatarDiaMes(vencimentos[0])} a ${formatarDiaMes(vencimentos[vencimentos.length - 1])}`}
              .
            </span>
          </p>
          {gerado.congeladas > 0 && (
            <p className="flex items-start gap-2.5">
              <IconeCongelado className="mt-0.5 h-4 w-4 shrink-0 text-[#1E3A8A]" />
              <span>
                {gerado.congeladas === 1
                  ? "1 aluno está com o plano congelado: a cobrança saiu normalmente"
                  : `${gerado.congeladas} alunos estão com o plano congelado: as cobranças saíram normalmente`}{" "}
                e aparecem marcadas na lista (hipótese H4).
              </span>
            </p>
          )}
          <p>Elas já aparecem como pendentes em Contas a receber.</p>
        </div>
        <footer className="flex flex-col-reverse gap-2 border-t border-areia-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={aoFechar} className="btn-secundario">
            Fechar
          </button>
          <button type="button" onClick={() => aoVerNaLista(gerado.competencia)} className="btn-primario">
            Ver na lista
          </button>
        </footer>
      </Modal>
    );
  }

  const n = previa.itens.length;

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Gerar mensalidades do mês"
      descricao="Uma cobrança para cada matrícula vigente que ainda não tem a do mês."
      largura="lg"
    >
      <form onSubmit={gerar}>
        <div className="space-y-4 px-5 py-4">
          <Campo rotulo="Mês" className="sm:max-w-xs">
            <select value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="campo">
              {[-1, 0, 1, 2].map((k) => {
                const mes = somarMesesNaCompetencia(MES_ATUAL, k);
                return (
                  <option key={mes} value={mes}>
                    {nomeDoMes(mes)}
                  </option>
                );
              })}
            </select>
          </Campo>

          {/* No celular o total vai numa linha só: três colunas cortariam o valor. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            <Numero rotulo="A gerar" valor={String(n)} />
            <Numero
              rotulo="Total"
              valor={formatarMoeda(previa.total)}
              className="order-first col-span-2 sm:order-none sm:col-span-1"
            />
            <Numero rotulo="Já existiam" valor={String(previa.jaGeradas)} />
          </div>

          {previa.congeladas > 0 && (
            <p className="flex items-start gap-2 text-sm text-areia-700">
              <IconeCongelado className="mt-0.5 h-4 w-4 shrink-0 text-[#1E3A8A]" />
              <span>
                {previa.congeladas === 1
                  ? "1 aluno está com o plano congelado."
                  : `${previa.congeladas} alunos estão com o plano congelado.`}{" "}
                Pela hipótese H4 a mensalidade é gerada normalmente; ela fica marcada na lista.
              </span>
            </p>
          )}

          {n > 0 ? (
            <ul className="max-h-72 divide-y divide-areia-100 overflow-y-auto rounded-xl border border-areia-200 rolagem-suave">
              {previa.itens.map((item) => (
                <li key={item.matriculaId} className="flex items-center gap-3 px-3 py-2">
                  {item.aluno && (
                    <Avatar id={item.aluno.id} nome={item.aluno.nome} src={item.aluno.fotoUrl} tamanho="sm" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-areia-900">
                      {item.aluno?.nome ?? "Aluno removido"}
                    </span>
                    <span className="block truncate text-xs text-areia-500">
                      {item.plano}
                      {item.nomePagante && item.nomePagante !== item.aluno?.nome
                        ? ` · pagante: ${item.nomePagante}`
                        : ""}
                    </span>
                  </span>
                  {item.congelada && (
                    <span className="hidden sm:block">
                      <BadgeCongelado />
                    </span>
                  )}
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-areia-900">
                      {formatarMoeda(item.valor)}
                    </span>
                    <span className="block text-xs text-areia-500">
                      vence {formatarDiaMes(item.vencimento)}
                      {item.congelada && <span className="sm:hidden"> · congelado</span>}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-areia-200 bg-areia-50 px-4 py-6 text-center text-sm text-areia-600">
              {previa.jaGeradas > 0
                ? `Todas as matrículas vigentes já têm a mensalidade de ${nome}. Nada a gerar.`
                : `Nenhuma matrícula vigente em ${nome}.`}
            </p>
          )}
        </div>

        <RodapeDoFormulario
          aoCancelar={aoFechar}
          rotuloConfirmar={n > 0 ? `Gerar ${mensalidades(n)}` : "Nada a gerar"}
          desabilitado={n === 0}
        />
      </form>
    </Modal>
  );
}

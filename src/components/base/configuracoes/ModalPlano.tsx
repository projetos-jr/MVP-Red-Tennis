"use client";

import { useState, type FormEvent } from "react";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { Modal } from "@/components/ui/Modal";
import { editarPlano, incluirPlano } from "@/lib/banco/operacoes/configuracoes";
import { TIPOS_DE_PLANO, type DadosDoPlano } from "@/lib/banco/regras/configuracoes";
import type { Plano, TipoPlano } from "@/lib/banco/tipos";
import { useGravar } from "@/store/useGravar";
import { paraNumero } from "./Pecas";

interface Rascunho {
  nome: string;
  tipo: TipoPlano;
  valorMensal: string;
  aulasPorSemana: string;
  duracaoMinutos: string;
  tabela: Plano["tabela"];
  ativo: boolean;
}

/**
 * Incluir ou editar um plano do catalogo (Hipoteses H2 e H3). Mudar o valor
 * nao muda as matriculas: cada aluno mantem o valor combinado.
 */
export function ModalPlano({
  plano,
  matriculas,
  aoFechar,
}: {
  /** Vazio = plano novo. */
  plano?: Plano;
  /** Matriculas (vigentes e antigas) do plano: trava o tipo. */
  matriculas: number;
  aoFechar: () => void;
}) {
  const gravar = useGravar();
  const [rascunho, setRascunho] = useState<Rascunho>(() => ({
    nome: plano?.nome ?? "",
    tipo: plano?.tipo ?? "Individual",
    valorMensal: plano ? String(plano.valorMensal) : "",
    aulasPorSemana: String(plano?.aulasPorSemana ?? 1),
    duracaoMinutos: String(plano?.duracaoMinutos ?? 60),
    tabela: plano?.tabela ?? "nova",
    ativo: plano?.ativo ?? true,
  }));
  const tipoTravado = Boolean(plano) && matriculas > 0;

  function mudar<Chave extends keyof Rascunho>(campo: Chave, valor: Rascunho[Chave]) {
    setRascunho((atual) => ({ ...atual, [campo]: valor }));
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const dados: DadosDoPlano = {
      nome: rascunho.nome,
      tipo: rascunho.tipo,
      valorMensal: paraNumero(rascunho.valorMensal),
      aulasPorSemana: paraNumero(rascunho.aulasPorSemana),
      duracaoMinutos: paraNumero(rascunho.duracaoMinutos),
      tabela: rascunho.tabela,
      ativo: rascunho.ativo,
    };
    const gravou = plano
      ? gravar(editarPlano, { ...dados, id: plano.id }, "Plano atualizado.")
      : gravar(incluirPlano, dados, "Plano incluído no catálogo.");
    if (gravou) aoFechar();
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={plano ? "Editar plano" : "Novo plano"}
      descricao="Catálogo de planos que podem ser oferecidos na matrícula."
    >
      <form onSubmit={enviar} noValidate>
        <div className="space-y-4 px-5 py-4">
          <Campo rotulo="Nome do plano" obrigatorio ajuda="Como aparece na matrícula e na cobrança.">
            <input
              className="campo"
              value={rascunho.nome}
              onChange={(e) => mudar("nome", e.target.value)}
              placeholder="Ex.: Individual · 2x por semana"
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Tipo"
              obrigatorio
              ajuda={tipoTravado ? "O plano já tem matrículas: o tipo não muda." : undefined}
            >
              <select
                className="campo"
                value={rascunho.tipo}
                onChange={(e) => mudar("tipo", e.target.value as TipoPlano)}
                disabled={tipoTravado}
              >
                {TIPOS_DE_PLANO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo === "Plano de locação" ? "Plano de locação (H2, a confirmar)" : tipo}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Valor mensal (R$)" obrigatorio>
              <input
                className="campo tabular-nums"
                type="number"
                inputMode="decimal"
                step={0.01}
                value={rascunho.valorMensal}
                onChange={(e) => mudar("valorMensal", e.target.value)}
                placeholder="0,00"
              />
            </Campo>
            <Campo rotulo="Aulas por semana" obrigatorio ajuda="Na locação mensal, horários por semana.">
              <input
                className="campo tabular-nums"
                type="number"
                inputMode="numeric"
                value={rascunho.aulasPorSemana}
                onChange={(e) => mudar("aulasPorSemana", e.target.value)}
              />
            </Campo>
            <Campo rotulo="Duração de cada aula (minutos)" obrigatorio>
              <input
                className="campo tabular-nums"
                type="number"
                inputMode="numeric"
                step={15}
                value={rascunho.duracaoMinutos}
                onChange={(e) => mudar("duracaoMinutos", e.target.value)}
              />
            </Campo>
          </div>

          <fieldset>
            <legend className="mb-1.5 flex items-center gap-2 text-sm font-medium text-areia-800">
              Tabela de preços <span className="text-xs font-normal text-areia-500">(hipótese H3)</span>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(["nova", "antiga"] as const).map((tabela) => (
                <label
                  key={tabela}
                  className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-saibro-600 ${
                    rascunho.tabela === tabela
                      ? "border-saibro-500 bg-saibro-50 ring-2 ring-saibro-500/20"
                      : "border-areia-200 hover:border-saibro-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="tabela"
                    className="sr-only"
                    checked={rascunho.tabela === tabela}
                    onChange={() => mudar("tabela", tabela)}
                  />
                  <span className="block font-semibold text-areia-900">
                    {tabela === "nova" ? "Tabela nova" : "Tabela antiga"}
                  </span>
                  <span className="block text-xs text-areia-500">
                    {tabela === "nova" ? "Preços atuais." : "Preços de quem já era aluno."}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-start gap-3 rounded-xl border border-areia-200 px-3.5 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-tijolo-600"
              checked={rascunho.ativo}
              onChange={(e) => mudar("ativo", e.target.checked)}
            />
            <span className="text-sm">
              <span className="block font-medium text-areia-900">Plano ativo</span>
              <span className="block text-xs text-areia-500">
                Só os planos ativos são oferecidos em matrículas novas. Quem já tem o plano continua com ele.
              </span>
            </span>
          </label>

          {plano && (
            <p className="rounded-xl bg-areia-50 px-3.5 py-3 text-xs leading-relaxed text-areia-600">
              Mudar o valor não muda quem já está matriculado: cada aluno mantém o valor combinado na
              matrícula (hipótese H3).
            </p>
          )}
        </div>

        <RodapeDoFormulario aoCancelar={aoFechar} rotuloConfirmar={plano ? "Salvar plano" : "Incluir plano"} />
      </form>
    </Modal>
  );
}

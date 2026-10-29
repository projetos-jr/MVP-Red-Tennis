"use client";

import { useState, type FormEvent } from "react";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { Modal } from "@/components/ui/Modal";
import {
  editarSigla,
  incluirSigla,
  type DadosDaSigla,
} from "@/lib/banco/operacoes/configuracoes";
import type { SiglaReposicao } from "@/lib/banco/tipos";
import { useGravar } from "@/store/useGravar";

const OPCOES_DE_ONDE_VALE: Array<{
  valor: SiglaReposicao["aplicaA"];
  rotulo: string;
  descricao: string;
}> = [
  { valor: "ocupacao", rotulo: "Aula inteira", descricao: "Cancela a aula de todos (chuva, falta do professor)." },
  { valor: "aluno", rotulo: "Um aluno", descricao: "Falta de um aluno só (aviso com 24h)." },
  { valor: "ambos", rotulo: "Os dois casos", descricao: "Pode ser usada na aula inteira ou num aluno." },
];

const SIGLA_VAZIA: DadosDaSigla = {
  codigo: "",
  nome: "",
  descricao: "",
  geraCredito: true,
  aplicaA: "ocupacao",
};

/**
 * Incluir ou editar uma sigla de reposicao (Hipotese H1). O codigo de uma
 * sigla ja usada fica travado: aulas e creditos antigos guardam o codigo.
 */
export function ModalSigla({
  sigla,
  usos,
  aoFechar,
}: {
  /** Vazio = sigla nova. */
  sigla?: SiglaReposicao;
  /** Quantas vezes a sigla ja foi gravada (trava o codigo). */
  usos: number;
  aoFechar: () => void;
}) {
  const gravar = useGravar();
  const [dados, setDados] = useState<DadosDaSigla>(() => {
    if (!sigla) return SIGLA_VAZIA;
    return {
      codigo: sigla.codigo,
      nome: sigla.nome,
      descricao: sigla.descricao,
      geraCredito: sigla.geraCredito,
      aplicaA: sigla.aplicaA,
    };
  });
  const codigoTravado = Boolean(sigla) && usos > 0;

  function mudar<Chave extends keyof DadosDaSigla>(campo: Chave, valor: DadosDaSigla[Chave]) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const gravou = sigla
      ? gravar(editarSigla, { codigoAtual: sigla.codigo, sigla: dados }, `Sigla ${dados.codigo.trim()} atualizada.`)
      : gravar(incluirSigla, dados, `Sigla ${dados.codigo.trim()} incluída.`);
    if (gravou) aoFechar();
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={sigla ? `Editar sigla ${sigla.codigo}` : "Incluir sigla de reposição"}
      descricao="Siglas dizem por que uma aula não aconteceu (hipótese H1)."
    >
      <form onSubmit={enviar} noValidate>
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <Campo
              rotulo="Código"
              obrigatorio
              ajuda={codigoTravado ? `Já usada ${usos} vezes: o código não muda.` : "Até 6 letras ou números."}
            >
              <input
                className="campo"
                value={dados.codigo}
                onChange={(e) => mudar("codigo", e.target.value)}
                maxLength={6}
                disabled={codigoTravado}
                placeholder="Ex.: AT"
                autoComplete="off"
              />
            </Campo>
            <Campo rotulo="Nome" obrigatorio>
              <input
                className="campo"
                value={dados.nome}
                onChange={(e) => mudar("nome", e.target.value)}
                placeholder="Ex.: Atestado médico"
              />
            </Campo>
          </div>

          <Campo rotulo="Descrição" ajuda="Explique quando a recepção deve usar esta sigla.">
            <textarea
              className="campo resize-none"
              rows={2}
              value={dados.descricao}
              onChange={(e) => mudar("descricao", e.target.value)}
            />
          </Campo>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-areia-800">Gera crédito de reposição?</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { valor: true, rotulo: "Sim", descricao: "O aluno ganha os minutos da aula." },
                { valor: false, rotulo: "Não", descricao: "Só registra o motivo." },
              ].map((opcao) => (
                <label
                  key={opcao.rotulo}
                  className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-saibro-600 ${
                    dados.geraCredito === opcao.valor
                      ? "border-saibro-500 bg-saibro-50 ring-2 ring-saibro-500/20"
                      : "border-areia-200 hover:border-saibro-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="gera-credito"
                    className="sr-only"
                    checked={dados.geraCredito === opcao.valor}
                    onChange={() => mudar("geraCredito", opcao.valor)}
                  />
                  <span className="block font-semibold text-areia-900">{opcao.rotulo}</span>
                  <span className="block text-xs text-areia-500">{opcao.descricao}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-areia-800">Onde a sigla vale</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {OPCOES_DE_ONDE_VALE.map((opcao) => (
                <label
                  key={opcao.valor}
                  className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-saibro-600 ${
                    dados.aplicaA === opcao.valor
                      ? "border-saibro-500 bg-saibro-50 ring-2 ring-saibro-500/20"
                      : "border-areia-200 hover:border-saibro-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="onde-vale"
                    className="sr-only"
                    checked={dados.aplicaA === opcao.valor}
                    onChange={() => mudar("aplicaA", opcao.valor)}
                  />
                  <span className="block font-semibold text-areia-900">{opcao.rotulo}</span>
                  <span className="block text-xs leading-snug text-areia-500">{opcao.descricao}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <RodapeDoFormulario
          aoCancelar={aoFechar}
          rotuloConfirmar={sigla ? "Salvar sigla" : "Incluir sigla"}
        />
      </form>
    </Modal>
  );
}

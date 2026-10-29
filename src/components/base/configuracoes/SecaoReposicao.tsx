"use client";

import { useMemo, useState } from "react";
import { IconeEtiqueta, IconeLapis } from "@/components/base/Icones";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { IconeMais } from "@/components/ui/Icons";
import {
  desativarSigla,
  reativarSigla,
  salvarParametros,
} from "@/lib/banco/operacoes/configuracoes";
import type { SiglaReposicao } from "@/lib/banco/tipos";
import { usoDasSiglas } from "@/lib/consultas/configuracoes";
import { estiloDaSigla } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { ModalSigla } from "./ModalSigla";
import {
  CampoDeConfiguracao,
  EntradaComUnidade,
  FormularioDeSecao,
  RodapeDeSalvar,
  SecaoDeConfiguracao,
  SeloHipotese,
  erroDeInteiro,
  paraNumero,
} from "./Pecas";

const ONDE_VALE: Record<SiglaReposicao["aplicaA"], string> = {
  ocupacao: "Aula inteira",
  aluno: "Um aluno",
  ambos: "Aula ou aluno",
};

/** Validade dos creditos e siglas de falta e cancelamento (Hipotese H1). */
export function SecaoReposicao() {
  const { banco } = useApp();
  const gravar = useGravar();
  const { siglas } = banco.configuracoes;
  const validadeSalva = String(banco.configuracoes.validadeReposicaoMeses);
  const [validade, setValidade] = useState(validadeSalva);
  const [modal, setModal] = useState<{ sigla?: SiglaReposicao } | null>(null);
  const [desativando, setDesativando] = useState<SiglaReposicao | null>(null);
  const usos = useMemo(() => usoDasSiglas(banco), [banco]);

  const erroDaValidade = erroDeInteiro(validade, 1, "Use um número inteiro de meses, a partir de 1.");

  function salvarValidade() {
    gravar(
      salvarParametros,
      { validadeReposicaoMeses: paraNumero(validade) },
      "Validade da reposição salva.",
    );
  }

  function confirmarDesativacao() {
    if (!desativando) return;
    if (gravar(desativarSigla, { codigo: desativando.codigo }, `Sigla ${desativando.codigo} desativada.`)) {
      setDesativando(null);
    }
  }

  return (
    <SecaoDeConfiguracao
      id="reposicao"
      titulo="Reposição de aulas"
      descricao="Validade dos créditos e siglas que dizem por que uma aula não aconteceu."
      icone={<IconeEtiqueta className="h-5 w-5" />}
    >
      <FormularioDeSecao aoSalvar={salvarValidade}>
        <CampoDeConfiguracao
          rotulo="Validade do crédito de reposição"
          ajuda="Quanto tempo o aluno tem para usar os minutos de uma aula perdida com direito a reposição. Combinado com a arena: 3 meses. Mudar a validade vale para os créditos novos."
          erro={validade !== validadeSalva ? erroDaValidade : undefined}
        >
          {(id) => (
            <EntradaComUnidade
              id={id}
              valor={validade}
              aoMudar={setValidade}
              unidade="meses"
              invalido={validade !== validadeSalva && Boolean(erroDaValidade)}
            />
          )}
        </CampoDeConfiguracao>
        <RodapeDeSalvar
          alterado={validade !== validadeSalva}
          aoDesfazer={() => setValidade(validadeSalva)}
          rotulo="Salvar validade"
        />
      </FormularioDeSecao>

      <div className="border-t border-areia-200">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-2 pt-4">
          <div className="max-w-2xl">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-areia-900">
              Siglas de falta e cancelamento <SeloHipotese numero={1} />
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-areia-600">
              As siglas que geram crédito dão ao aluno minutos de reposição iguais à duração da
              aula. O código de uma sigla já usada não muda: para trocar, inclua outra e desative
              a antiga. Desativar tira a sigla dos formulários sem mexer no que já foi registrado.
            </p>
          </div>
          <button type="button" onClick={() => setModal({})} className="btn-secundario">
            <IconeMais className="h-4 w-4" />
            Incluir sigla
          </button>
        </div>

        <ul className="divide-y divide-areia-100">
          {siglas.map((sigla) => {
            const estilo = estiloDaSigla(sigla.codigo);
            const vezes = usos.get(sigla.codigo) ?? 0;
            return (
              <li
                key={sigla.codigo}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 ${
                  sigla.desativada ? "bg-areia-50/70" : ""
                }`}
              >
                <span
                  className="chip min-w-[3.25rem] justify-center font-bold"
                  style={{ color: estilo.cor, backgroundColor: estilo.fundo }}
                >
                  {sigla.codigo}
                </span>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-areia-900">
                    {sigla.nome}
                    {sigla.desativada && (
                      <span className="chip border border-areia-300 bg-white px-2 py-0.5 text-[10px] text-areia-600">
                        Desativada
                      </span>
                    )}
                  </p>
                  {sigla.descricao && <p className="text-xs text-areia-500">{sigla.descricao}</p>}
                </div>
                <dl className="grid grid-cols-3 gap-x-5 text-xs sm:w-80">
                  <div>
                    <dt className="text-areia-500">Gera crédito</dt>
                    <dd className={`font-medium ${sigla.geraCredito ? "text-emerald-800" : "text-areia-700"}`}>
                      {sigla.geraCredito ? "Sim" : "Não"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-areia-500">Vale para</dt>
                    <dd className="font-medium text-areia-700">{ONDE_VALE[sigla.aplicaA]}</dd>
                  </div>
                  <div>
                    <dt className="text-areia-500">Já usada</dt>
                    <dd className="font-medium tabular-nums text-areia-700">
                      {vezes === 0 ? "nunca" : `${vezes}×`}
                    </dd>
                  </div>
                </dl>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setModal({ sigla })}
                    className="btn-fantasma px-2.5 py-1.5 text-xs"
                    aria-label={`Editar a sigla ${sigla.codigo}`}
                  >
                    <IconeLapis className="h-4 w-4" />
                    Editar
                  </button>
                  {sigla.desativada ? (
                    <button
                      type="button"
                      onClick={() =>
                        gravar(reativarSigla, { codigo: sigla.codigo }, `Sigla ${sigla.codigo} reativada.`)
                      }
                      className="btn-fantasma px-2.5 py-1.5 text-xs text-emerald-800"
                    >
                      Reativar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDesativando(sigla)}
                      className="btn-fantasma px-2.5 py-1.5 text-xs text-tijolo-700"
                    >
                      Desativar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {modal && (
        <ModalSigla
          sigla={modal.sigla}
          usos={modal.sigla ? (usos.get(modal.sigla.codigo) ?? 0) : 0}
          aoFechar={() => setModal(null)}
        />
      )}

      <Confirmacao
        aberto={desativando !== null}
        titulo={`Desativar a sigla ${desativando?.codigo ?? ""}?`}
        mensagem={
          <>
            A sigla <strong>{desativando?.nome}</strong> sai dos formulários de cancelamento e de
            falta. As aulas e os créditos que já usam {desativando?.codigo} continuam como estão.
            Dá para reativar depois.
          </>
        }
        rotuloConfirmar="Desativar sigla"
        perigoso
        aoConfirmar={confirmarDesativacao}
        aoCancelar={() => setDesativando(null)}
      />
    </SecaoDeConfiguracao>
  );
}

"use client";

import { useState } from "react";
import { IconeFechar, IconeFinanceiro, IconeMais } from "@/components/ui/Icons";
import { salvarParametros } from "@/lib/banco/operacoes/configuracoes";
import { mesmoTexto } from "@/lib/banco/regras/configuracoes";
import type { Configuracoes } from "@/lib/banco/tipos";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import {
  CampoDeConfiguracao,
  EntradaComUnidade,
  FormularioDeSecao,
  RodapeDeSalvar,
  SecaoDeConfiguracao,
  erroDeInteiro,
  paraNumero,
} from "./Pecas";

function rascunhoDe(c: Configuracoes) {
  return {
    formas: c.formasPagamento,
    prazoConsumo: String(c.prazoPagamentoConsumoDias),
    precoQuadra: String(c.precoLocacaoHora),
    precoParedao: String(c.precoParedaoHora),
  };
}

function erroDePreco(texto: string): string | undefined {
  const valor = paraNumero(texto);
  return Number.isFinite(valor) && valor > 0 ? undefined : "Use um valor maior que zero.";
}

/** Formas de pagamento, prazo do consumo do balcao (H13) e precos da locacao avulsa. */
export function SecaoFinanceiro() {
  const { banco } = useApp();
  const gravar = useGravar();
  const salvo = rascunhoDe(banco.configuracoes);
  const [rascunho, setRascunho] = useState(salvo);
  const alterado = JSON.stringify(rascunho) !== JSON.stringify(salvo);

  const repetidas = rascunho.formas.filter(
    (forma, i) => forma.trim() && rascunho.formas.findIndex((outra) => mesmoTexto(outra, forma)) !== i,
  );
  const erroDasFormas =
    rascunho.formas.length === 0
      ? "Deixe pelo menos uma forma de pagamento."
      : rascunho.formas.some((forma) => !forma.trim())
        ? "Há uma forma de pagamento sem nome."
        : repetidas.length > 0
          ? `"${repetidas[0].trim()}" aparece duas vezes.`
          : undefined;
  const erroDoPrazo = erroDeInteiro(rascunho.prazoConsumo, 1, "Use um número inteiro de dias, a partir de 1.");

  function mudarForma(indice: number, valor: string) {
    setRascunho({ ...rascunho, formas: rascunho.formas.map((f, i) => (i === indice ? valor : f)) });
  }

  function salvar() {
    gravar(
      salvarParametros,
      {
        formasPagamento: rascunho.formas,
        prazoPagamentoConsumoDias: paraNumero(rascunho.prazoConsumo),
        precoLocacaoHora: paraNumero(rascunho.precoQuadra),
        precoParedaoHora: paraNumero(rascunho.precoParedao),
      },
      "Regras do financeiro salvas.",
    );
  }

  return (
    <SecaoDeConfiguracao
      id="financeiro"
      titulo="Financeiro e balcão"
      descricao="Formas de pagamento, prazo para pagar o consumo e preço da locação avulsa."
      icone={<IconeFinanceiro className="h-5 w-5" />}
    >
      <FormularioDeSecao aoSalvar={salvar}>
        <div className="divide-y divide-areia-100">
          <CampoDeConfiguracao
            rotulo="Formas de pagamento"
            ajuda="Aparecem como opções nos formulários de pagamento. Tirar uma forma da lista não muda os pagamentos já registrados com ela. Não há integração com banco, maquininha ou convênio: é só a lista de opções."
            erro={alterado ? erroDasFormas : undefined}
          >
            {(id) => (
              <div className="space-y-1.5">
                {rascunho.formas.map((forma, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      id={i === 0 ? id : undefined}
                      value={forma}
                      onChange={(e) => mudarForma(i, e.target.value)}
                      aria-label={`Forma de pagamento ${i + 1}`}
                      className="campo py-2"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setRascunho({ ...rascunho, formas: rascunho.formas.filter((_, j) => j !== i) })
                      }
                      className="btn-fantasma shrink-0 p-2"
                      aria-label={`Tirar "${forma || "forma sem nome"}" da lista`}
                    >
                      <IconeFechar className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setRascunho({ ...rascunho, formas: [...rascunho.formas, ""] })}
                  className="btn-fantasma w-full justify-start px-2.5 py-2 text-xs"
                >
                  <IconeMais className="h-4 w-4" />
                  Adicionar forma de pagamento
                </button>
              </div>
            )}
          </CampoDeConfiguracao>

          <CampoDeConfiguracao
            rotulo="Prazo para pagar o consumo do balcão"
            hipotese={13}
            ajuda="O que a pessoa consome no balcão vira uma cobrança que vence depois deste número de dias. Valor de teste: 7 dias. Vale para os consumos novos."
            erro={rascunho.prazoConsumo !== salvo.prazoConsumo ? erroDoPrazo : undefined}
          >
            {(id) => (
              <EntradaComUnidade
                id={id}
                valor={rascunho.prazoConsumo}
                aoMudar={(valor) => setRascunho({ ...rascunho, prazoConsumo: valor })}
                unidade="dias"
                invalido={rascunho.prazoConsumo !== salvo.prazoConsumo && Boolean(erroDoPrazo)}
              />
            )}
          </CampoDeConfiguracao>

          <CampoDeConfiguracao
            rotulo="Preço da hora de locação avulsa: quadras"
            ajuda="Usado para calcular o valor de cada reserva avulsa nas quadras 1 a 4 (valor de teste). Mudar o preço não altera as reservas já lançadas."
            erro={rascunho.precoQuadra !== salvo.precoQuadra ? erroDePreco(rascunho.precoQuadra) : undefined}
          >
            {(id) => (
              <EntradaComUnidade
                id={id}
                valor={rascunho.precoQuadra}
                aoMudar={(valor) => setRascunho({ ...rascunho, precoQuadra: valor })}
                antes="R$"
                unidade="por hora"
                passo={0.01}
                invalido={rascunho.precoQuadra !== salvo.precoQuadra && Boolean(erroDePreco(rascunho.precoQuadra))}
              />
            )}
          </CampoDeConfiguracao>

          <CampoDeConfiguracao
            rotulo="Preço da hora de locação avulsa: paredão"
            ajuda="Valor de teste para a locação avulsa do paredão."
            erro={rascunho.precoParedao !== salvo.precoParedao ? erroDePreco(rascunho.precoParedao) : undefined}
          >
            {(id) => (
              <EntradaComUnidade
                id={id}
                valor={rascunho.precoParedao}
                aoMudar={(valor) => setRascunho({ ...rascunho, precoParedao: valor })}
                antes="R$"
                unidade="por hora"
                passo={0.01}
                invalido={rascunho.precoParedao !== salvo.precoParedao && Boolean(erroDePreco(rascunho.precoParedao))}
              />
            )}
          </CampoDeConfiguracao>
        </div>
        <RodapeDeSalvar alterado={alterado} aoDesfazer={() => setRascunho(salvo)} />
      </FormularioDeSecao>
    </SecaoDeConfiguracao>
  );
}

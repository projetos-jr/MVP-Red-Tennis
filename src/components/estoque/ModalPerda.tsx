"use client";

import { useState, type FormEvent } from "react";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { Modal } from "@/components/ui/Modal";
import { registrarPerda } from "@/lib/banco/operacoes/estoque";
import type { ProdutoComSaldo } from "@/lib/consultas/estoque";
import { formatarMoeda } from "@/lib/theme";
import { useGravar } from "@/store/useGravar";
import { CampoQuantidade } from "./CampoQuantidade";
import { lerInteiro } from "./formatos";
import { ResumoDoSaldo } from "./ResumoDoSaldo";

/** Atalhos para os motivos mais comuns; a pessoa pode escrever outro. */
const MOTIVOS_COMUNS = ["Quebra ou derramado", "Vencido", "Cortesia", "Estragado"];

/** Baixa por perda (quebra, vencimento, cortesia...). Nunca passa do saldo. */
export function ModalPerda({ item, aoFechar }: { item: ProdutoComSaldo; aoFechar: () => void }) {
  const gravar = useGravar();
  const { produto, saldo } = item;
  const [quantidade, setQuantidade] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<{ quantidade?: string; motivo?: string }>({});

  const numero = lerInteiro(quantidade);
  const quantidadeValida = Number.isInteger(numero) && numero > 0;

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    const novos: typeof erros = {};
    if (!quantidadeValida) novos.quantidade = "Informe quantas unidades foram perdidas.";
    if (!motivo.trim()) novos.motivo = "Escolha ou escreva o motivo.";
    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    // Quantidade acima do saldo vai para a regra, que recusa com a mensagem certa.
    const gravou = gravar(
      registrarPerda,
      { produtoId: produto.id, quantidade: numero, motivo },
      `Perda de ${numero} unidade(s) de ${produto.nome} registrada.`,
    );
    if (gravou) aoFechar();
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Registrar perda"
      descricao={`${produto.nome} · ${produto.unidade}`}
      largura="sm"
    >
      <form onSubmit={salvar} noValidate>
        <div className="space-y-4 px-5 py-4">
          <CampoQuantidade
            id="perda-quantidade"
            rotulo="Quantidade perdida"
            obrigatorio
            valor={quantidade}
            aoMudar={setQuantidade}
            maximo={Math.max(saldo, 1)}
            erro={erros.quantidade}
            ajuda={`Há ${saldo} em estoque.`}
          />

          <div>
            <Campo rotulo="Motivo" obrigatorio erro={erros.motivo}>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: garrafa quebrada"
                className="campo"
                maxLength={120}
              />
            </Campo>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Motivos comuns">
              {MOTIVOS_COMUNS.map((comum) => (
                <button
                  key={comum}
                  type="button"
                  onClick={() => setMotivo(comum)}
                  aria-pressed={motivo === comum}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    motivo === comum
                      ? "bg-tijolo-600 text-white"
                      : "bg-areia-100 text-areia-700 hover:bg-areia-200"
                  }`}
                >
                  {comum}
                </button>
              ))}
            </div>
          </div>

          <ResumoDoSaldo
            saldoAtual={saldo}
            saldoDepois={quantidadeValida && numero <= saldo ? saldo - numero : undefined}
            estoqueMinimo={produto.estoqueMinimo}
            extra={
              quantidadeValida
                ? { rotulo: "Custo perdido", valor: formatarMoeda(produto.precoCusto * numero) }
                : undefined
            }
          />
        </div>

        <RodapeDoFormulario aoCancelar={aoFechar} rotuloConfirmar="Registrar perda" perigoso />
      </form>
    </Modal>
  );
}

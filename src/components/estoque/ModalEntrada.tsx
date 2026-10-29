"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { Modal } from "@/components/ui/Modal";
import { registrarEntrada } from "@/lib/banco/operacoes/estoque";
import {
  fornecedoresConhecidos,
  ultimoFornecedorDoProduto,
  type ProdutoComSaldo,
} from "@/lib/consultas/estoque";
import { formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { CampoQuantidade } from "./CampoQuantidade";
import { lerInteiro, lerValor, valorParaCampo } from "./formatos";
import { ResumoDoSaldo } from "./ResumoDoSaldo";

type Erros = Partial<Record<"quantidade" | "favorecido" | "valor" | "vencimento", string>>;

/**
 * Entrada de mercadoria. Opcionalmente lanca, na mesma gravacao, a conta a
 * pagar ao fornecedor (valor sugerido: custo × quantidade, editavel).
 */
export function ModalEntrada({
  item,
  quantidadeSugerida,
  aoFechar,
}: {
  item: ProdutoComSaldo;
  /** Quantidade ja preenchida (a sugestao da lista de compras). */
  quantidadeSugerida?: number;
  aoFechar: () => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const { produto, saldo } = item;

  const [quantidade, setQuantidade] = useState(
    quantidadeSugerida ? String(quantidadeSugerida) : "",
  );
  const [observacao, setObservacao] = useState("");
  const [comConta, setComConta] = useState(false);
  const [favorecido, setFavorecido] = useState(
    () => ultimoFornecedorDoProduto(banco, produto.id) ?? "",
  );
  // null = valor automatico (custo × quantidade); texto = a pessoa digitou.
  const [valorDigitado, setValorDigitado] = useState<string | null>(null);
  const [vencimento, setVencimento] = useState("");
  const [erros, setErros] = useState<Erros>({});

  const fornecedores = useMemo(() => fornecedoresConhecidos(banco), [banco]);
  const numero = lerInteiro(quantidade);
  const quantidadeValida = Number.isInteger(numero) && numero > 0;
  const custoEstimado = quantidadeValida ? produto.precoCusto * numero : 0;
  const valorDaConta = valorDigitado ?? (quantidadeValida ? valorParaCampo(custoEstimado) : "");

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    const novos: Erros = {};
    if (!quantidadeValida) novos.quantidade = "Informe quantas unidades chegaram.";
    if (comConta) {
      if (!favorecido.trim()) novos.favorecido = "Informe o fornecedor.";
      const valor = lerValor(valorDaConta);
      if (!(valor > 0)) novos.valor = "Informe um valor maior que zero, como 120,00.";
      if (!vencimento) novos.vencimento = "Informe o vencimento (data do boleto).";
    }
    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    const gravou = gravar(
      registrarEntrada,
      {
        produtoId: produto.id,
        quantidade: numero,
        observacao,
        contaAPagar: comConta
          ? { favorecido, valor: lerValor(valorDaConta), vencimento }
          : undefined,
      },
      comConta
        ? `Entrada de ${numero} registrada e conta a pagar lançada no financeiro.`
        : `Entrada de ${numero} unidade(s) de ${produto.nome} registrada.`,
    );
    if (gravou) aoFechar();
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Entrada de mercadoria"
      descricao={`${produto.nome} · ${produto.unidade}`}
    >
      <form onSubmit={salvar} noValidate>
        <div className="space-y-4 px-5 py-4">
          <CampoQuantidade
            id="entrada-quantidade"
            rotulo="Quantidade que chegou"
            obrigatorio
            valor={quantidade}
            aoMudar={setQuantidade}
            erro={erros.quantidade}
            ajuda={quantidadeSugerida ? `Sugestão da lista de compras: ${quantidadeSugerida}.` : undefined}
          />

          <Campo rotulo="Observação" ajuda="Opcional: nota fiscal, lote, quem entregou…">
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: NF 1234"
              className="campo"
              maxLength={120}
            />
          </Campo>

          <div className="rounded-xl border border-areia-200">
            <label className="flex cursor-pointer items-start gap-3 px-3.5 py-3">
              <input
                type="checkbox"
                checked={comConta}
                onChange={(e) => setComConta(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-areia-300 text-saibro-600 focus:ring-saibro-500"
              />
              <span className="text-sm">
                <span className="font-medium text-areia-900">
                  Lançar conta a pagar ao fornecedor
                </span>
                <span className="block text-xs text-areia-500">
                  Aparece no Financeiro, em &ldquo;A pagar&rdquo;, junto com a entrada.
                </span>
              </span>
            </label>

            {comConta && (
              <div className="space-y-4 border-t border-areia-200 px-3.5 py-3.5">
                <Campo rotulo="Fornecedor (favorecido)" obrigatorio erro={erros.favorecido}>
                  <input
                    value={favorecido}
                    onChange={(e) => setFavorecido(e.target.value)}
                    list="fornecedores-conhecidos"
                    placeholder="Ex.: Distribuidora de bebidas"
                    className="campo"
                    maxLength={80}
                  />
                </Campo>
                <datalist id="fornecedores-conhecidos">
                  {fornecedores.map((nome) => (
                    <option key={nome} value={nome} />
                  ))}
                </datalist>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo
                    rotulo="Valor (R$)"
                    obrigatorio
                    erro={erros.valor}
                    ajuda={
                      valorDigitado === null
                        ? "Custo × quantidade. Pode alterar."
                        : `Custo × quantidade: ${formatarMoeda(custoEstimado)}`
                    }
                  >
                    <input
                      value={valorDaConta}
                      onChange={(e) => setValorDigitado(e.target.value)}
                      inputMode="decimal"
                      placeholder="0,00"
                      className="campo tabular-nums"
                    />
                  </Campo>
                  <Campo rotulo="Vencimento" obrigatorio erro={erros.vencimento}>
                    <input
                      type="date"
                      value={vencimento}
                      onChange={(e) => setVencimento(e.target.value)}
                      className="campo"
                    />
                  </Campo>
                </div>
              </div>
            )}
          </div>

          <ResumoDoSaldo
            saldoAtual={saldo}
            saldoDepois={quantidadeValida ? saldo + numero : undefined}
            estoqueMinimo={produto.estoqueMinimo}
            extra={
              quantidadeValida
                ? { rotulo: "Custo estimado da compra", valor: formatarMoeda(custoEstimado) }
                : undefined
            }
          />
        </div>

        <RodapeDoFormulario aoCancelar={aoFechar} rotuloConfirmar="Registrar entrada" />
      </form>
    </Modal>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { IconeAlerta } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { cadastrarProduto, editarProduto } from "@/lib/banco/operacoes/estoque";
import { vendaAbaixoDoCusto } from "@/lib/banco/regras/estoque";
import type { CategoriaProduto, Produto } from "@/lib/banco/tipos";
import { CATEGORIAS_PRODUTO } from "@/lib/consultas/estoque";
import { formatarMoeda } from "@/lib/theme";
import { useGravar } from "@/store/useGravar";
import { lerInteiro, lerValor, valorParaCampo } from "./formatos";

type Erros = Partial<Record<"nome" | "categoria" | "unidade" | "precoCusto" | "precoVenda" | "estoqueMinimo", string>>;

/**
 * Cadastro (sem `produto`) ou edicao (com `produto`) de um item do balcao.
 * Os precos aceitam virgula ("5,50"). Venda abaixo do custo so gera aviso.
 * O nome repetido e recusado pela regra da operacao.
 */
export function ModalProduto({
  produto,
  categoriaInicial,
  aoFechar,
}: {
  produto?: Produto;
  /** Categoria ja escolhida no cadastro (a do filtro da tela). */
  categoriaInicial?: CategoriaProduto;
  aoFechar: () => void;
}) {
  const gravar = useGravar();
  const edicao = Boolean(produto);
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [categoria, setCategoria] = useState<CategoriaProduto | "">(
    produto?.categoria ?? categoriaInicial ?? "",
  );
  const [unidade, setUnidade] = useState(produto?.unidade ?? "");
  const [precoCusto, setPrecoCusto] = useState(produto ? valorParaCampo(produto.precoCusto) : "");
  const [precoVenda, setPrecoVenda] = useState(produto ? valorParaCampo(produto.precoVenda) : "");
  const [estoqueMinimo, setEstoqueMinimo] = useState(produto ? String(produto.estoqueMinimo) : "");
  const [erros, setErros] = useState<Erros>({});

  const custo = lerValor(precoCusto);
  const venda = lerValor(precoVenda);
  const precosLidos = Number.isFinite(custo) && Number.isFinite(venda) && custo >= 0 && venda >= 0;
  const margem = venda - custo;

  function conferir(): Erros {
    const novos: Erros = {};
    if (!nome.trim()) novos.nome = "Informe o nome do produto.";
    if (!categoria) novos.categoria = "Escolha a categoria.";
    if (!unidade.trim()) novos.unidade = "Informe como o item é vendido.";
    if (Number.isNaN(custo)) novos.precoCusto = "Informe um valor, como 4,50.";
    if (Number.isNaN(venda)) novos.precoVenda = "Informe um valor, como 10,00.";
    const minimo = lerInteiro(estoqueMinimo);
    if (Number.isNaN(minimo) || minimo < 0) {
      novos.estoqueMinimo = "Informe um número inteiro, zero ou maior.";
    }
    return novos;
  }

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    const novos = conferir();
    setErros(novos);
    if (Object.keys(novos).length > 0 || !categoria) return;

    const dados = {
      nome,
      categoria,
      unidade,
      precoCusto: custo,
      precoVenda: venda,
      estoqueMinimo: lerInteiro(estoqueMinimo),
    };
    const gravou = produto
      ? gravar(editarProduto, { ...dados, id: produto.id }, "Cadastro do produto atualizado.")
      : gravar(
          cadastrarProduto,
          dados,
          "Produto cadastrado. Registre a entrada da mercadoria para ele ter saldo.",
        );
    if (gravou) aoFechar();
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={edicao ? "Editar produto" : "Novo produto"}
      descricao={
        edicao
          ? "Mudar o nome ou o preço não altera o que já foi vendido."
          : "O saldo começa em zero e sobe com as entradas de mercadoria."
      }
    >
      <form onSubmit={salvar} noValidate>
        <div className="space-y-4 px-5 py-4">
          <Campo rotulo="Nome do produto" obrigatorio erro={erros.nome}>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Água mineral sem gás"
              className="campo"
              autoFocus
              maxLength={60}
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Categoria" obrigatorio erro={erros.categoria}>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaProduto)}
                className="campo"
              >
                <option value="">Escolha…</option>
                {CATEGORIAS_PRODUTO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              rotulo="Unidade"
              obrigatorio
              erro={erros.unidade}
              ajuda="Como é vendido: lata 350ml, unidade…"
            >
              <input
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                placeholder="Ex.: garrafa 500ml"
                className="campo"
                maxLength={30}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Preço de custo (R$)" obrigatorio erro={erros.precoCusto}>
              <input
                value={precoCusto}
                onChange={(e) => setPrecoCusto(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="campo tabular-nums"
              />
            </Campo>
            <Campo rotulo="Preço de venda (R$)" obrigatorio erro={erros.precoVenda}>
              <input
                value={precoVenda}
                onChange={(e) => setPrecoVenda(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="campo tabular-nums"
              />
            </Campo>
          </div>

          {precosLidos &&
            (vendaAbaixoDoCusto(custo, venda) ? (
              <p
                role="status"
                className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
              >
                <IconeAlerta className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  A venda está abaixo do custo: cada unidade vendida dá{" "}
                  <strong>{formatarMoeda(-margem)}</strong> de prejuízo. Dá para salvar
                  assim mesmo (promoção, cortesia).
                </span>
              </p>
            ) : (
              <p className="rounded-xl bg-areia-50 px-3.5 py-2.5 text-sm text-areia-600">
                Margem de <strong className="text-areia-800">{formatarMoeda(margem)}</strong> por
                unidade
                {custo > 0 && ` (${Math.round((margem / custo) * 100)}% sobre o custo)`}.
              </p>
            ))}

          <Campo
            rotulo="Estoque mínimo"
            obrigatorio
            erro={erros.estoqueMinimo}
            ajuda="Abaixo disso o produto entra na lista de compras."
          >
            <input
              value={estoqueMinimo}
              onChange={(e) => setEstoqueMinimo(e.target.value)}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="Ex.: 12"
              className="campo tabular-nums sm:max-w-[10rem]"
            />
          </Campo>
        </div>

        <RodapeDoFormulario
          aoCancelar={aoFechar}
          rotuloConfirmar={edicao ? "Salvar alterações" : "Cadastrar produto"}
        />
      </form>
    </Modal>
  );
}

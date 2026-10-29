"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CampoQuantidade } from "@/components/estoque/CampoQuantidade";
import { lerInteiro } from "@/components/estoque/formatos";
import { SeloDoNivel } from "@/components/estoque/NivelDoEstoque";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { RodapeDoFormulario } from "@/components/ui/Formulario";
import { IconeBusca, IconeCopo } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { HOJE } from "@/lib/banco/constantes";
import { lancarConsumo } from "@/lib/banco/operacoes/estoque";
import type { CategoriaProduto } from "@/lib/banco/tipos";
import {
  CATEGORIAS_PRODUTO,
  buscarPessoasDoBalcao,
  filtrarProdutos,
  pessoasDoBalcao,
  produtosParaVenda,
  vencimentoDoConsumo,
  type PessoaDoBalcao,
} from "@/lib/consultas/estoque";
import { formatarDiaMes } from "@/lib/date";
import { ESTILO_CATEGORIA_PRODUTO, formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";

export type PessoaDoConsumo = Pick<PessoaDoBalcao, "id" | "tipo" | "nome">;

/**
 * Lancamento de consumo no balcao. Ao confirmar, numa gravacao so, o item
 * sai do estoque, entra na conta da pessoa e vira um lancamento a receber
 * no financeiro.
 *
 * Aberto pela ficha, a pessoa ja vem escolhida (`pessoa`); aberto pela tela
 * do estoque, o modal pergunta para quem e.
 */
export function ModalConsumo({
  pessoa: pessoaFixa,
  aoFechar,
}: {
  pessoa?: PessoaDoConsumo;
  aoFechar: () => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();

  const [pessoaEscolhida, setPessoaEscolhida] = useState<PessoaDoConsumo | null>(null);
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const [categoria, setCategoria] = useState<CategoriaProduto | "todas">("todas");
  const [busca, setBusca] = useState("");
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState("1");
  const [erro, setErro] = useState<string>();

  const pessoa = pessoaFixa ?? pessoaEscolhida;
  const pessoas = useMemo(() => pessoasDoBalcao(banco), [banco]);
  const encontradas = buscarPessoasDoBalcao(pessoas, buscaPessoa);
  const produtos = useMemo(() => produtosParaVenda(banco), [banco]);
  const lista = filtrarProdutos(produtos, {
    categoria,
    busca,
    apenasRepor: false,
    incluirInativos: false,
  });

  // Relido a cada renderizacao: o saldo pode mudar com o modal aberto.
  const selecionado = produtos.find((item) => item.produto.id === produtoId);
  const numero = lerInteiro(quantidade);
  const quantidadeValida = Number.isInteger(numero) && numero > 0;
  const total = selecionado && quantidadeValida ? selecionado.produto.precoVenda * numero : 0;

  function confirmar(evento: FormEvent) {
    evento.preventDefault();
    const falta = !pessoa
      ? "Escolha para quem é o consumo."
      : !selecionado
        ? "Escolha o produto."
        : !quantidadeValida
          ? "Informe a quantidade."
          : undefined;
    setErro(falta);
    if (falta || !pessoa || !selecionado) return;

    // Quantidade acima do saldo vai para a regra, que recusa com a mensagem certa.
    const gravou = gravar(
      lancarConsumo,
      {
        pessoaId: pessoa.id,
        pessoaTipo: pessoa.tipo,
        produtoId: selecionado.produto.id,
        quantidade: numero,
      },
      `${numero}× ${selecionado.produto.nome} lançado na conta de ${pessoa.nome}.`,
    );
    if (gravou) aoFechar();
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Lançar consumo"
      descricao={
        pessoa
          ? `O item sai do estoque e entra na conta de ${pessoa.nome}.`
          : "O item sai do estoque e entra na conta da pessoa."
      }
    >
      <form onSubmit={confirmar} noValidate>
        <div className="space-y-4 px-5 py-4">
          {/* Para quem */}
          {!pessoaFixa && (
            <section aria-label="Para quem é o consumo">
              {pessoaEscolhida ? (
                <div className="flex items-center gap-3 rounded-xl border border-areia-200 bg-areia-50 px-3 py-2.5">
                  <Avatar
                    id={pessoaEscolhida.id}
                    nome={pessoaEscolhida.nome}
                    src={pessoas.find((p) => p.id === pessoaEscolhida.id)?.fotoUrl}
                    tamanho="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-areia-900">
                      {pessoaEscolhida.nome}
                    </p>
                    <p className="text-xs text-areia-500">
                      {pessoaEscolhida.tipo === "aluno" ? "Aluno" : "Professor"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPessoaEscolhida(null)}
                    className="btn-fantasma px-2.5 py-1.5 text-xs"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <>
                  <label
                    htmlFor="consumo-pessoa"
                    className="mb-1.5 block text-sm font-medium text-areia-800"
                  >
                    Para quem?<span className="ml-0.5 text-tijolo-600">*</span>
                  </label>
                  <div className="relative">
                    <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
                    <input
                      id="consumo-pessoa"
                      value={buscaPessoa}
                      onChange={(e) => setBuscaPessoa(e.target.value)}
                      placeholder="Digite o nome do aluno ou professor…"
                      className="campo pl-9"
                      autoComplete="off"
                    />
                  </div>
                  {buscaPessoa.trim() && (
                    <ul className="mt-2 max-h-48 divide-y divide-areia-100 overflow-y-auto rounded-xl border border-areia-200 rolagem-suave">
                      {encontradas.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setPessoaEscolhida(p);
                              setBuscaPessoa("");
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-areia-50"
                          >
                            <Avatar id={p.id} nome={p.nome} src={p.fotoUrl} tamanho="xs" />
                            <span className="min-w-0 flex-1 truncate text-sm text-areia-900">
                              {p.nome}
                            </span>
                            <span className="shrink-0 text-xs text-areia-500">
                              {p.tipo === "aluno" ? "Aluno" : "Professor"}
                            </span>
                          </button>
                        </li>
                      ))}
                      {encontradas.length === 0 && (
                        <li className="px-3 py-4 text-center text-sm text-areia-500">
                          Ninguém encontrado com esse nome.
                        </li>
                      )}
                    </ul>
                  )}
                </>
              )}
            </section>
          )}

          {/* Produto */}
          <section aria-label="Produto" className="space-y-3">
            <div className="relative">
              <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto…"
                className="campo pl-9"
                aria-label="Buscar produto"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categoria">
              {(["todas", ...CATEGORIAS_PRODUTO] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  aria-pressed={categoria === c}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    categoria === c
                      ? "bg-saibro-600 text-white"
                      : "bg-areia-100 text-areia-700 hover:bg-areia-200"
                  }`}
                >
                  {c === "todas" ? "Todas" : c}
                </button>
              ))}
            </div>

            <ul className="max-h-60 divide-y divide-areia-100 overflow-y-auto rounded-xl border border-areia-200 rolagem-suave">
              {lista.map((item) => {
                const { produto, saldo } = item;
                const esgotado = saldo <= 0;
                const marcado = produto.id === produtoId;
                const cat = ESTILO_CATEGORIA_PRODUTO[produto.categoria];
                return (
                  <li key={produto.id}>
                    <button
                      type="button"
                      disabled={esgotado}
                      aria-pressed={marcado}
                      onClick={() => {
                        setProdutoId(produto.id);
                        setQuantidade("1");
                      }}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        marcado ? "bg-saibro-50 ring-1 ring-inset ring-saibro-300" : "hover:bg-areia-50"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-areia-900">
                          {produto.nome}
                        </span>
                        <span className="block truncate text-xs text-areia-500">
                          {produto.unidade} · {saldo} em estoque
                        </span>
                      </span>
                      <Badge
                        cor={cat.cor}
                        fundo={cat.fundo}
                        borda={cat.borda}
                        className="hidden shrink-0 text-[10px] sm:inline-flex"
                      >
                        {produto.categoria}
                      </Badge>
                      {esgotado ? (
                        <SeloDoNivel nivel="esgotado" className="shrink-0 text-[10px]" />
                      ) : (
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-areia-800">
                          {formatarMoeda(produto.precoVenda)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}

              {lista.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-areia-500">
                  Nenhum produto encontrado.
                </li>
              )}
            </ul>
          </section>

          {selecionado && (
            <div className="rounded-xl border border-saibro-200 bg-saibro-50/60 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-areia-900">
                <IconeCopo className="h-4 w-4 text-saibro-700" />
                {selecionado.produto.nome}
              </p>
              <p className="text-xs text-areia-500">
                {formatarMoeda(selecionado.produto.precoVenda)} · {selecionado.produto.unidade} ·{" "}
                {selecionado.saldo} em estoque
              </p>

              <div className="mt-3">
                <CampoQuantidade
                  id="consumo-quantidade"
                  rotulo="Quantidade"
                  valor={quantidade}
                  aoMudar={setQuantidade}
                  maximo={Math.max(selecionado.saldo, 1)}
                />
              </div>

              <p className="mt-3 flex items-center justify-between border-t border-saibro-200 pt-2.5 text-sm">
                <span className="text-areia-600">
                  Total · vence em {formatarDiaMes(vencimentoDoConsumo(banco, HOJE))}
                </span>
                <span className="text-lg font-bold tabular-nums text-saibro-800">
                  {formatarMoeda(total)}
                </span>
              </p>
            </div>
          )}

          {erro && (
            <p role="alert" className="text-sm font-medium text-tijolo-700">
              {erro}
            </p>
          )}
        </div>

        <RodapeDoFormulario
          aoCancelar={aoFechar}
          rotuloConfirmar={total > 0 ? `Lançar ${formatarMoeda(total)} na conta` : "Lançar na conta"}
          desabilitado={!pessoa || !selecionado}
        />
      </form>
    </Modal>
  );
}

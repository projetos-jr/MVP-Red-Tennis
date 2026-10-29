"use client";

import { useState, type FormEvent } from "react";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { Modal } from "@/components/ui/Modal";
import { Segmentado } from "@/components/ui/Segmentado";
import { HOJE } from "@/lib/banco/constantes";
import { criarLancamento, type DadosNovoLancamento } from "@/lib/banco/operacoes/financeiro";
import type { Aluno, CategoriaLancamento, TipoLancamento } from "@/lib/banco/tipos";
import {
  categoriasDoTipo,
  nomeDoMes,
  professoresAtivos,
  somarMesesNaCompetencia,
} from "@/lib/consultas/financeiro";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { BuscaDeAluno } from "./BuscaDeAluno";
import { CampoComprovante } from "./CampoComprovante";
import { lerValor } from "./utilitarios";

const EXEMPLO_DE_ITEM: Record<CategoriaLancamento, string> = {
  Mensalidade: "Mensalidade de novembro",
  "Aula avulsa": "Aula avulsa de 30/10",
  Locação: "Locação da quadra 2 · 30/10 às 18h",
  Consumo: "2× Água mineral",
  Torneio: "Inscrição · Torneio interno",
  Despesa: "Energia elétrica · outubro",
  Fornecedor: "Compra de bolas",
  Repasse: "Adiantamento de repasse",
  Outros: "Descreva o lançamento",
};

const MES_ATUAL = HOJE.slice(0, 7);

/**
 * Novo lançamento a receber (aluno, quem pagou, item...) ou a pagar
 * (favorecido, item...). A validação que vale é a da operação: aqui só se
 * monta o pedido.
 */
export function ModalNovoLancamento({
  tipoInicial,
  podePagar,
  aoFechar,
  aoConcluir,
}: {
  tipoInicial: TipoLancamento;
  /** H9: só quem vê as contas a pagar pode lançá-las. */
  podePagar: boolean;
  aoFechar: () => void;
  aoConcluir: (tipo: TipoLancamento) => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const professores = professoresAtivos(banco);

  const [tipo, setTipo] = useState<TipoLancamento>(podePagar ? tipoInicial : "receber");
  const [aluno, setAluno] = useState<Aluno | undefined>();
  const [nomePagante, setNomePagante] = useState("");
  const [categoria, setCategoria] = useState<CategoriaLancamento>(
    tipo === "receber" ? "Aula avulsa" : "Despesa",
  );
  const [item, setItem] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(HOJE);
  const [forma, setForma] = useState("");
  const [comprovante, setComprovante] = useState("");
  const [jaPago, setJaPago] = useState(false);
  const [pagoEm, setPagoEm] = useState(HOJE);
  const [convenio, setConvenio] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [competencia, setCompetencia] = useState(somarMesesNaCompetencia(MES_ATUAL, -1));

  const receber = tipo === "receber";
  const repasse = !receber && categoria === "Repasse";

  function trocarTipo(novo: TipoLancamento) {
    setTipo(novo);
    setCategoria(novo === "receber" ? "Aula avulsa" : "Despesa");
    setNomePagante("");
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const dados: DadosNovoLancamento = {
      tipo,
      categoria,
      pessoaId: receber ? aluno?.id : repasse ? professorId || undefined : undefined,
      nomePagante,
      item,
      valor: lerValor(valor) ?? 0,
      vencimento,
      formaPagamento: forma || undefined,
      comprovante,
      pagoEm: jaPago ? pagoEm : undefined,
      valorConvenio: jaPago && receber ? lerValor(convenio) : undefined,
      competencia: repasse ? competencia : undefined,
    };
    const mensagem = jaPago ? "Lançamento criado, já como pago." : "Lançamento criado.";
    if (gravar(criarLancamento, dados, mensagem)) aoConcluir(tipo);
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Novo lançamento"
      descricao="Uma cobrança a receber ou uma conta a pagar."
      largura="lg"
    >
      <form onSubmit={enviar} noValidate>
        <div className="space-y-4 px-5 py-4">
          {podePagar && (
            <Segmentado
              aria="Tipo de lançamento"
              valor={tipo}
              aoMudar={trocarTipo}
              opcoes={[
                { valor: "receber", rotulo: "A receber" },
                { valor: "pagar", rotulo: "A pagar" },
              ]}
            />
          )}

          {receber ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <BuscaDeAluno selecionado={aluno} aoEscolher={setAluno} />
              <Campo
                rotulo="Quem paga"
                ajuda="Pode ser outra pessoa: pai, mãe, empresa. Vazio = o próprio aluno."
              >
                <input
                  value={nomePagante}
                  onChange={(e) => setNomePagante(e.target.value)}
                  placeholder={aluno?.nome ?? "Nome de quem paga"}
                  className="campo"
                />
              </Campo>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Categoria"
              obrigatorio
              ajuda={
                categoria === "Mensalidade"
                  ? "Fica ligada à matrícula do aluno; o mês é o do vencimento."
                  : undefined
              }
            >
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaLancamento)}
                className="campo"
              >
                {categoriasDoTipo(tipo).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Campo>

            {!receber && !repasse && (
              <Campo rotulo="Favorecido" obrigatorio ajuda="Quem vai receber o pagamento.">
                <input
                  value={nomePagante}
                  onChange={(e) => setNomePagante(e.target.value)}
                  placeholder="Ex.: Companhia de energia"
                  className="campo"
                />
              </Campo>
            )}
            {repasse && (
              <Campo rotulo="Professor" obrigatorio>
                <select
                  value={professorId}
                  onChange={(e) => setProfessorId(e.target.value)}
                  className="campo"
                >
                  <option value="">Escolha…</option>
                  {professores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            {receber && (
              <Campo rotulo="Item" obrigatorio>
                <input
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  placeholder={EXEMPLO_DE_ITEM[categoria]}
                  className="campo"
                />
              </Campo>
            )}
          </div>

          {!receber && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Item" obrigatorio className={repasse ? "" : "sm:col-span-2"}>
                <input
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  placeholder={EXEMPLO_DE_ITEM[categoria]}
                  className="campo"
                />
              </Campo>
              {repasse && (
                <Campo
                  rotulo="Mês de referência"
                  obrigatorio
                  ajuda="O fechamento do mês desconta o que já foi lançado."
                >
                  <select
                    value={competencia}
                    onChange={(e) => setCompetencia(e.target.value)}
                    className="campo"
                  >
                    {[-3, -2, -1, 0].map((k) => {
                      const mes = somarMesesNaCompetencia(MES_ATUAL, k);
                      return (
                        <option key={mes} value={mes}>
                          {nomeDoMes(mes)}
                        </option>
                      );
                    })}
                  </select>
                </Campo>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Valor (R$)" obrigatorio>
              <input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="campo"
              />
            </Campo>
            <Campo rotulo="Vencimento" obrigatorio>
              <input
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                className="campo"
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Forma de pagamento"
              obrigatorio={jaPago}
              ajuda={jaPago ? undefined : "Opcional enquanto não for pago."}
            >
              <select value={forma} onChange={(e) => setForma(e.target.value)} className="campo">
                <option value="">{jaPago ? "Escolha…" : "Ainda não definida"}</option>
                {banco.configuracoes.formasPagamento.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Campo>
            <CampoComprovante nome={comprovante} aoEscolher={setComprovante} />
          </div>

          <fieldset className="rounded-xl border border-areia-200 px-4 py-3">
            <legend className="sr-only">Pagamento</legend>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-areia-800">
              <input
                type="checkbox"
                checked={jaPago}
                onChange={(e) => setJaPago(e.target.checked)}
                className="h-4 w-4 rounded border-areia-300 accent-tijolo-600"
              />
              Já foi pago
            </label>
            {jaPago && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Campo rotulo="Data do pagamento" obrigatorio>
                  <input
                    type="date"
                    value={pagoEm}
                    max={HOJE}
                    onChange={(e) => setPagoEm(e.target.value)}
                    className="campo"
                  />
                </Campo>
                {receber && (
                  <Campo
                    rotulo="Parte coberta por convênio (R$)"
                    ajuda="Opcional. Só registro, sem ligação com o convênio."
                  >
                    <input
                      inputMode="decimal"
                      value={convenio}
                      onChange={(e) => setConvenio(e.target.value)}
                      placeholder="0,00"
                      className="campo"
                    />
                  </Campo>
                )}
              </div>
            )}
          </fieldset>
        </div>

        <RodapeDoFormulario aoCancelar={aoFechar} rotuloConfirmar="Lançar" />
      </form>
    </Modal>
  );
}

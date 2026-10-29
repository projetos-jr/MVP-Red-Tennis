"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAvisos } from "@/components/ui/Avisos";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { IconeAlerta, IconeCheck } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { Segmentado } from "@/components/ui/Segmentado";
import { HOJE } from "@/lib/banco/constantes";
import { criarTorneio, editarTorneio } from "@/lib/banco/operacoes/ranking";
import { previaDaChave } from "@/lib/banco/regras/torneios";
import type { CategoriaRanking, FormatoTorneio, Torneio, TorneioInscrito } from "@/lib/banco/tipos";
import { EXPLICACAO_FORMATO, ROTULO_FORMATO } from "@/lib/consultas/ranking";
import { somarDias } from "@/lib/date";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { EditorDeInscricoes, type InscricaoNoFormulario } from "./EditorDeInscricoes";

const FORMATOS: FormatoTorneio[] = ["eliminatoria", "grupos_eliminatoria", "todos_contra_todos"];
const CATEGORIAS: CategoriaRanking[] = ["A", "B", "C", "D"];

/**
 * Criar ou editar torneio: nome, data, formato, categoria, simples ou duplas,
 * inscricoes e cabecas de chave. Depois que a chave e gerada, so nome, data e
 * categoria mudam. Use com `key` para recomecar a cada abertura.
 */
export function ModalTorneio({
  torneio,
  inscritos = [],
  aoFechar,
}: {
  /** Vazio = criar torneio novo. */
  torneio?: Torneio;
  inscritos?: TorneioInscrito[];
  aoFechar: () => void;
}) {
  const { banco, executar } = useApp();
  const gravar = useGravar();
  const { avisar } = useAvisos();
  const router = useRouter();

  const [nome, setNome] = useState(torneio?.nome ?? "");
  const [data, setData] = useState(torneio?.data ?? somarDias(HOJE, 14));
  const [formato, setFormato] = useState<FormatoTorneio>(torneio?.formato ?? "eliminatoria");
  const [categoria, setCategoria] = useState<CategoriaRanking | "">(torneio?.categoria ?? "");
  const [duplas, setDuplas] = useState(torneio?.duplas ?? false);
  const [inscricoes, setInscricoes] = useState<InscricaoNoFormulario[]>(() =>
    inscritos.map((i) => ({
      chave: i.id,
      id: i.id,
      alunosIds: i.alunosIds,
      cabecaDeChave: i.cabecaDeChave,
    })),
  );

  const chaveGerada = Boolean(torneio && torneio.situacao !== "inscricoes");
  const previa = previaDaChave(formato, inscricoes.length, banco.configuracoes.classificadosPorGrupo);

  function trocarDuplas(valor: "simples" | "duplas") {
    // Simples e duplas tem inscricoes diferentes: trocar recomeca a lista.
    if ((valor === "duplas") === duplas) return;
    setDuplas(valor === "duplas");
    setInscricoes([]);
  }

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    const dados = {
      nome,
      data,
      formato,
      categoria: categoria || undefined,
      duplas,
      inscricoes: inscricoes.map(({ id, alunosIds, cabecaDeChave }) => ({ id, alunosIds, cabecaDeChave })),
    };

    if (torneio) {
      const ok = gravar(
        editarTorneio,
        { ...dados, id: torneio.id, inscricoes: chaveGerada ? undefined : dados.inscricoes },
        "Torneio atualizado.",
      );
      if (ok) aoFechar();
      return;
    }

    // Aqui se usa `executar` (e nao `useGravar`) para saber o id do torneio
    // criado e abrir a tela dele em seguida.
    const resultado = executar(criarTorneio, dados);
    if (!resultado.ok) {
      avisar("erro", resultado.erro);
      return;
    }
    const novo = resultado.banco.torneios[resultado.banco.torneios.length - 1];
    avisar("sucesso", "Torneio criado. Confira as inscrições e gere a chave quando estiver pronto.");
    aoFechar();
    router.push(`/ranking/torneio?id=${novo.id}`);
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={torneio ? "Editar torneio" : "Novo torneio"}
      descricao={
        chaveGerada
          ? "A chave já foi gerada: só o nome, a data e a categoria podem mudar."
          : "Dados do torneio, inscrições e cabeças de chave."
      }
      largura="lg"
    >
      <form onSubmit={salvar}>
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <Campo rotulo="Nome" obrigatorio>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Torneio de Verão · Categoria C"
                className="campo"
              />
            </Campo>
            <Campo rotulo="Data" obrigatorio>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="campo" />
            </Campo>
            <Campo rotulo="Categoria" ajuda="Vazio = torneio livre">
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaRanking | "")}
                className="campo"
              >
                <option value="">Livre</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    Categoria {c}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div className={`space-y-4 ${chaveGerada ? "opacity-60" : ""}`}>
            <fieldset disabled={chaveGerada}>
              <legend className="mb-1.5 block text-sm font-medium text-areia-800">
                Formato<span className="ml-0.5 text-tijolo-600">*</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {FORMATOS.map((opcao) => {
                  const escolhido = formato === opcao;
                  return (
                    <label key={opcao} className="block cursor-pointer">
                      <input
                        type="radio"
                        name="formato-do-torneio"
                        value={opcao}
                        checked={escolhido}
                        onChange={() => setFormato(opcao)}
                        className="peer sr-only"
                      />
                      <span
                        className={`block h-full rounded-xl border px-3 py-2.5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-saibro-500 ${
                          escolhido
                            ? "border-saibro-500 bg-saibro-50"
                            : "border-areia-300 bg-white hover:border-saibro-300"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-areia-900">
                          {escolhido && <IconeCheck className="h-4 w-4 text-saibro-600" />}
                          {ROTULO_FORMATO[opcao]}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-areia-600">
                          {EXPLICACAO_FORMATO[opcao]}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset disabled={chaveGerada}>
              <legend className="mb-1.5 block text-sm font-medium text-areia-800">Modalidade</legend>
              <Segmentado
                aria="Simples ou duplas"
                valor={duplas ? "duplas" : "simples"}
                aoMudar={trocarDuplas}
                opcoes={[
                  { valor: "simples", rotulo: "Simples" },
                  { valor: "duplas", rotulo: "Duplas" },
                ]}
              />
            </fieldset>
          </div>

          {chaveGerada ? (
            <p className="rounded-xl border border-areia-200 bg-areia-50 px-3.5 py-3 text-sm text-areia-700">
              {inscricoes.length} inscrições. Para mudar inscrições ou formato, desfaça a chave na
              tela do torneio (só é possível enquanto nenhum resultado foi registrado).
            </p>
          ) : (
            <>
              <EditorDeInscricoes
                duplas={duplas}
                categoria={categoria || undefined}
                inscricoes={inscricoes}
                aoMudar={setInscricoes}
              />
              <p
                className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${
                  previa.valida ? "bg-saibro-50 text-saibro-900" : "bg-areia-100 text-areia-700"
                }`}
              >
                {previa.valida ? (
                  <IconeCheck className="mt-0.5 h-4 w-4 shrink-0 text-saibro-600" />
                ) : (
                  <IconeAlerta className="mt-0.5 h-4 w-4 shrink-0 text-areia-500" />
                )}
                <span>
                  <strong className="font-semibold">Chave: </strong>
                  {previa.mensagem}
                </span>
              </p>
            </>
          )}
        </div>

        <RodapeDoFormulario aoCancelar={aoFechar} rotuloConfirmar={torneio ? "Salvar" : "Criar torneio"} />
      </form>
    </Modal>
  );
}

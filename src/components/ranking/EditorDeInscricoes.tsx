"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Campo } from "@/components/ui/Formulario";
import { IconeBusca, IconeLixeira, IconeMais } from "@/components/ui/Icons";
import type { Aluno, CategoriaRanking } from "@/lib/banco/tipos";
import { alunosParaInscricao } from "@/lib/consultas/ranking";
import { ESTILO_CATEGORIA } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { AvataresDoLado } from "./AvataresDoLado";

/** Inscricao enquanto o formulario esta aberto (`id` so nas que ja existem). */
export interface InscricaoNoFormulario {
  chave: string;
  id?: string;
  alunosIds: string[];
  cabecaDeChave?: number;
}

type Publico = "categoria" | "ranking" | "todos";

let proximaChave = 1;
export function novaChave(): string {
  proximaChave += 1;
  return `nova-${proximaChave}`;
}

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function SeloCategoria({ categoria }: { categoria?: CategoriaRanking }) {
  if (!categoria) return null;
  const estilo = ESTILO_CATEGORIA[categoria];
  return (
    <span
      className="shrink-0 rounded-full border px-1.5 text-[10px] font-semibold"
      style={{ color: estilo.cor, backgroundColor: estilo.fundo, borderColor: estilo.borda }}
      title={estilo.label}
    >
      {categoria}
    </span>
  );
}

/**
 * Inscricoes de um torneio: escolher alunos (simples) ou montar duplas, e
 * numerar os cabecas de chave. As regras (ninguem duas vezes, cabecas em
 * sequencia) sao conferidas de novo na gravacao.
 */
export function EditorDeInscricoes({
  duplas,
  categoria,
  inscricoes,
  aoMudar,
}: {
  duplas: boolean;
  categoria?: CategoriaRanking;
  inscricoes: InscricaoNoFormulario[];
  aoMudar: (inscricoes: InscricaoNoFormulario[]) => void;
}) {
  const { banco } = useApp();
  const alunos = useMemo(() => alunosParaInscricao(banco), [banco]);
  const porId = useMemo(() => new Map(alunos.map((a) => [a.id, a])), [alunos]);
  const [publico, setPublico] = useState<Publico>(categoria ? "categoria" : "ranking");
  const [busca, setBusca] = useState("");
  const [primeiro, setPrimeiro] = useState("");
  const [segundo, setSegundo] = useState("");

  const inscritos = new Set(inscricoes.flatMap((i) => i.alunosIds));
  const publicoAtual: Publico = publico === "categoria" && !categoria ? "ranking" : publico;
  const candidatos = alunos.filter((aluno) => {
    if (inscritos.has(aluno.id)) return false;
    if (publicoAtual === "ranking" && !aluno.inscritoRanking) return false;
    if (publicoAtual === "categoria" && (!aluno.inscritoRanking || aluno.categoriaRanking !== categoria)) {
      return false;
    }
    return !busca.trim() || semAcento(aluno.nome).includes(semAcento(busca.trim()));
  });

  const nomeDe = (id: string) => porId.get(id)?.nome ?? "Aluno removido";
  const cabecasEmSequencia = inscricoes
    .map((i) => i.cabecaDeChave)
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b)
    .every((n, i) => n === i + 1);

  function inscrever(alunosIds: string[]) {
    aoMudar([...inscricoes, { chave: novaChave(), alunosIds }]);
  }

  function adicionarDupla() {
    if (!primeiro || !segundo || primeiro === segundo) return;
    inscrever([primeiro, segundo]);
    setPrimeiro("");
    setSegundo("");
  }

  function remover(chave: string) {
    aoMudar(inscricoes.filter((i) => i.chave !== chave));
  }

  function mudarCabeca(chave: string, valor: string) {
    aoMudar(
      inscricoes.map((i) =>
        i.chave === chave ? { ...i, cabecaDeChave: valor ? Number(valor) : undefined } : i,
      ),
    );
  }

  const opcoesDoPublico = (
    <Campo rotulo="Mostrar">
      <select value={publicoAtual} onChange={(e) => setPublico(e.target.value as Publico)} className="campo">
        {categoria && <option value="categoria">Ranking · Categoria {categoria}</option>}
        <option value="ranking">Todo o ranking</option>
        <option value="todos">Todos os alunos ativos</option>
      </select>
    </Campo>
  );

  return (
    <div className="space-y-3">
      {duplas ? (
        <div className="space-y-3 rounded-xl border border-areia-200 p-3">
          {opcoesDoPublico}
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            {[
              { rotulo: "Jogador 1", valor: primeiro, mudar: setPrimeiro, outro: segundo },
              { rotulo: "Jogador 2", valor: segundo, mudar: setSegundo, outro: primeiro },
            ].map((campo) => (
              <Campo key={campo.rotulo} rotulo={campo.rotulo}>
                <select value={campo.valor} onChange={(e) => campo.mudar(e.target.value)} className="campo">
                  <option value="">Escolha…</option>
                  {candidatos
                    .filter((a) => a.id !== campo.outro)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                        {a.categoriaRanking ? ` · Cat. ${a.categoriaRanking}` : ""}
                      </option>
                    ))}
                </select>
              </Campo>
            ))}
            <button
              type="button"
              onClick={adicionarDupla}
              disabled={!primeiro || !segundo}
              className="btn-secundario"
            >
              <IconeMais className="h-4 w-4" />
              Adicionar dupla
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-areia-200">
          <div className="grid gap-2 border-b border-areia-200 p-3 sm:grid-cols-2 sm:items-end">
            <Campo rotulo="Buscar aluno">
              <span className="relative block">
                <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome…"
                  className="campo pl-9"
                />
              </span>
            </Campo>
            {opcoesDoPublico}
          </div>
          <ul className="max-h-52 divide-y divide-areia-100 overflow-y-auto rolagem-suave">
            {candidatos.map((aluno: Aluno) => (
              <li key={aluno.id} className="flex items-center gap-2.5 px-3 py-2">
                <Avatar id={aluno.id} nome={aluno.nome} src={aluno.fotoUrl} tamanho="xs" />
                <span className="min-w-0 flex-1 truncate text-sm text-areia-800">{aluno.nome}</span>
                <SeloCategoria categoria={aluno.categoriaRanking} />
                <button
                  type="button"
                  onClick={() => inscrever([aluno.id])}
                  aria-label={`Inscrever ${aluno.nome}`}
                  className="btn-fantasma px-2 py-1 text-xs text-saibro-700"
                >
                  <IconeMais className="h-3.5 w-3.5" />
                  Inscrever
                </button>
              </li>
            ))}
            {candidatos.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-areia-500">Ninguém a mostrar.</li>
            )}
          </ul>
          {candidatos.length > 1 && (
            <div className="border-t border-areia-200 px-3 py-2 text-right">
              <button
                type="button"
                onClick={() =>
                  aoMudar([
                    ...inscricoes,
                    ...candidatos.map((a) => ({ chave: novaChave(), alunosIds: [a.id] })),
                  ])
                }
                className="text-xs font-semibold text-saibro-700 hover:underline"
              >
                Inscrever os {candidatos.length} da lista
              </button>
            </div>
          )}
        </div>
      )}

      <div>
        <p className="mb-1.5 text-sm font-medium text-areia-800">
          Inscritos ({inscricoes.length})
        </p>
        {inscricoes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-areia-300 px-3 py-4 text-center text-xs text-areia-500">
            Ninguém inscrito ainda. As inscrições podem ser completadas depois, até a chave ser
            gerada.
          </p>
        ) : (
          <ol className="divide-y divide-areia-100 rounded-xl border border-areia-200">
            {inscricoes.map((inscricao, i) => {
              const nome = inscricao.alunosIds.map(nomeDe).join(" / ");
              return (
                <li key={inscricao.chave} className="flex items-center gap-2.5 px-3 py-2">
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-areia-400">
                    {i + 1}
                  </span>
                  <AvataresDoLado
                    alunos={inscricao.alunosIds
                      .map((id) => porId.get(id))
                      .filter((a): a is Aluno => Boolean(a))}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-areia-900">{nome}</span>
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-areia-600">
                    <span aria-hidden="true" className="hidden sm:inline">
                      Cabeça de chave
                    </span>
                    <select
                      aria-label={`Cabeça de chave de ${nome}`}
                      value={inscricao.cabecaDeChave ?? ""}
                      onChange={(e) => mudarCabeca(inscricao.chave, e.target.value)}
                      className="rounded-lg border border-areia-300 bg-white px-1.5 py-1 text-xs text-areia-900 focus:border-saibro-500 focus:outline-none"
                    >
                      <option value="">—</option>
                      {inscricoes.map((_, n) => (
                        <option key={n} value={n + 1}>
                          {n + 1}º
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => remover(inscricao.chave)}
                    aria-label={`Remover ${nome}`}
                    className="btn-fantasma shrink-0 px-1.5 py-1 text-tijolo-700"
                  >
                    <IconeLixeira className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        {!cabecasEmSequencia && (
          <p className="mt-1.5 text-xs font-medium text-tijolo-700">
            Numere os cabeças de chave em sequência (1, 2, 3…), sem repetir nem pular.
          </p>
        )}
      </div>
    </div>
  );
}

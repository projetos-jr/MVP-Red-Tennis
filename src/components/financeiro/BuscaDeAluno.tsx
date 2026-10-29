"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { HOJE } from "@/lib/banco/constantes";
import type { SituacaoAluno } from "@/lib/banco/regras/alunos";
import type { Aluno } from "@/lib/banco/tipos";
import { buscarAlunosParaCobranca } from "@/lib/consultas/financeiro";
import { useApp } from "@/store/AppStore";

const ROTULO_SITUACAO: Record<SituacaoAluno, string> = {
  ativo: "ativo",
  congelado: "plano congelado",
  avulso: "sem plano mensal",
  inativo: "inativo",
};

/**
 * Campo "Aluno" com busca pelo nome: digita, escolhe na lista (mouse ou
 * setas + Enter). Depois de escolhido, mostra o aluno e o botão "Trocar".
 */
export function BuscaDeAluno({
  selecionado,
  aoEscolher,
}: {
  selecionado?: Aluno;
  aoEscolher: (aluno: Aluno | undefined) => void;
}) {
  const { banco } = useApp();
  const id = useId();
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const resultados = useMemo(() => buscarAlunosParaCobranca(banco, termo, HOJE), [banco, termo]);

  if (selecionado) {
    return (
      <div>
        <span className="mb-1.5 block text-sm font-medium text-areia-800">Aluno</span>
        <div className="flex items-center gap-3 rounded-xl border border-areia-300 bg-areia-50 px-3 py-2">
          <Avatar id={selecionado.id} nome={selecionado.nome} src={selecionado.fotoUrl} tamanho="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-areia-900">
            {selecionado.nome}
          </span>
          <button
            type="button"
            onClick={() => aoEscolher(undefined)}
            className="shrink-0 rounded-md px-1.5 py-1 text-xs font-semibold text-tijolo-700 hover:bg-tijolo-50"
            aria-label={`Trocar o aluno (${selecionado.nome})`}
          >
            Trocar
          </button>
        </div>
      </div>
    );
  }

  const listaId = `${id}-lista`;
  const mostrarLista = aberto && termo.trim().length > 0;
  const atual = resultados[Math.min(destaque, resultados.length - 1)];

  function escolher(aluno: Aluno) {
    aoEscolher(aluno);
    setTermo("");
    setAberto(false);
  }

  function teclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAberto(true);
      setDestaque((d) => Math.min(d + 1, Math.max(resultados.length - 1, 0)));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
    } else if (evento.key === "Enter" && mostrarLista && atual) {
      // Enter escolhe o aluno em vez de enviar o formulário.
      evento.preventDefault();
      escolher(atual.aluno);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-areia-800">
        Aluno
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={mostrarLista && resultados.length > 0}
        aria-controls={mostrarLista && resultados.length > 0 ? listaId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={mostrarLista && atual ? `${id}-opcao-${atual.aluno.id}` : undefined}
        aria-describedby={`${id}-ajuda`}
        autoComplete="off"
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value);
          setAberto(true);
          setDestaque(0);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onKeyDown={teclar}
        placeholder="Digite o nome do aluno…"
        className="campo"
      />
      {mostrarLista && resultados.length > 0 && (
        <ul
          id={listaId}
          role="listbox"
          aria-label="Alunos encontrados"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-areia-200 bg-white py-1 shadow-card-hover rolagem-suave"
        >
          {resultados.map((resultado, indice) => {
            const ativo = resultado === atual;
            return (
              <li
                key={resultado.aluno.id}
                id={`${id}-opcao-${resultado.aluno.id}`}
                role="option"
                aria-selected={ativo}
                // mousedown (e não click): escolhe antes de o campo perder o foco.
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(resultado.aluno);
                }}
                onMouseEnter={() => setDestaque(indice)}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 ${ativo ? "bg-saibro-50" : ""}`}
              >
                <Avatar
                  id={resultado.aluno.id}
                  nome={resultado.aluno.nome}
                  src={resultado.aluno.fotoUrl}
                  tamanho="sm"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-areia-900">
                    {resultado.aluno.nome}
                  </span>
                  <span className="block truncate text-xs text-areia-500">
                    {resultado.plano ?? "Sem plano mensal"} · {ROTULO_SITUACAO[resultado.situacao]}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {mostrarLista && resultados.length === 0 && (
        <p className="absolute z-20 mt-1 w-full rounded-xl border border-areia-200 bg-white px-3 py-2.5 text-sm text-areia-500 shadow-card-hover">
          Nenhum aluno com esse nome.
        </p>
      )}
      <span id={`${id}-ajuda`} className="mt-1 block text-xs text-areia-500">
        Opcional: sem aluno, informe quem vai pagar.
      </span>
    </div>
  );
}

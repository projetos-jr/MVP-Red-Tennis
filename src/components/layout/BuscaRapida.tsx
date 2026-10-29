"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/Avatar";
import { IconeBusca, IconeFechar } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import type { SituacaoAluno } from "@/lib/banco/regras/alunos";
import { buscarAlunosRapido, type AlunoEncontrado } from "@/lib/consultas/painel";
import { useApp } from "@/store/AppStore";

const ROTULO_DA_SITUACAO: Record<SituacaoAluno, string> = {
  ativo: "Ativo",
  congelado: "Congelado",
  avulso: "Sem plano",
  inativo: "Inativo",
};

/**
 * Busca rapida de aluno na barra do topo, para achar a ficha durante uma
 * ligacao. No computador e um campo com sugestoes (atalho: tecla "/"); no
 * celular, um botao que abre a busca em tela cheia.
 */
export function BuscaRapida() {
  const [abertaNoCelular, setAbertaNoCelular] = useState(false);

  return (
    <>
      <div className="hidden md:block">
        <CaixaDeBusca variante="barra" />
      </div>
      <button
        type="button"
        onClick={() => setAbertaNoCelular(true)}
        className="btn-fantasma px-2.5 py-2 md:hidden"
        aria-label="Buscar aluno"
      >
        <IconeBusca className="h-5 w-5" />
      </button>
      {abertaNoCelular && <BuscaEmTelaCheia aoFechar={() => setAbertaNoCelular(false)} />}
    </>
  );
}

/**
 * Vai direto para o `body` (portal): a barra do topo usa `backdrop-blur`, e um
 * elemento `fixed` dentro dela ficaria preso ao tamanho da barra.
 */
function BuscaEmTelaCheia({ aoFechar }: { aoFechar: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buscar aluno"
      className="fixed inset-0 z-50 bg-white md:hidden"
    >
      <CaixaDeBusca
        variante="tela"
        aoTerminar={aoFechar}
        fechar={
          <button
            type="button"
            onClick={aoFechar}
            className="btn-fantasma shrink-0 px-2.5 py-2"
            aria-label="Fechar a busca"
          >
            <IconeFechar className="h-5 w-5" />
          </button>
        }
      />
    </div>,
    document.body,
  );
}

/** Tira acentos e maiusculas sem mudar o tamanho do texto (para achar o trecho a destacar). */
function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Nome com os pedacos digitados em destaque ("gui lim" -> **Gui**lherme **Lim**a). */
function destacar(nome: string, termo: string): ReactNode {
  const base = semAcento(nome);
  if (base.length !== nome.length) return nome;
  const marcado = new Array<boolean>(nome.length).fill(false);

  semAcento(termo)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .forEach((pedaco) => {
      let inicio = -1;
      let posicao = 0;
      for (const palavra of base.split(" ")) {
        if (palavra.startsWith(pedaco)) {
          inicio = posicao;
          break;
        }
        posicao += palavra.length + 1;
      }
      if (inicio < 0) inicio = base.indexOf(pedaco);
      if (inicio < 0) return;
      for (let i = inicio; i < inicio + pedaco.length; i += 1) marcado[i] = true;
    });

  const partes: ReactNode[] = [];
  let i = 0;
  while (i < nome.length) {
    let fim = i;
    while (fim < nome.length && marcado[fim] === marcado[i]) fim += 1;
    const trecho = nome.slice(i, fim);
    partes.push(
      marcado[i] ? (
        <mark key={i} className="bg-transparent font-semibold text-tijolo-700">
          {trecho}
        </mark>
      ) : (
        trecho
      ),
    );
    i = fim;
  }
  return partes;
}

/**
 * Campo com lista de sugestoes (padrao "combobox" de acessibilidade):
 * setas sobem e descem, Enter abre a ficha, Esc fecha.
 */
function CaixaDeBusca({
  variante,
  fechar,
  aoTerminar,
}: {
  variante: "barra" | "tela";
  /** Botao de fechar, ao lado do campo, na versao de tela cheia. */
  fechar?: ReactNode;
  /** Chamado depois de abrir uma ficha ou de apertar Esc (fecha a tela cheia). */
  aoTerminar?: () => void;
}) {
  const router = useRouter();
  const { banco, colaborador } = useApp();
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [listaAberta, setListaAberta] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();
  const idDaLista = `${id}-lista`;
  const telaCheia = variante === "tela";

  // Professor ve so os proprios alunos (Hipotese H9).
  const professorId = colaborador.perfil === "professor" ? colaborador.professorId : undefined;
  const resultado = useMemo(
    () => buscarAlunosRapido(banco, termo, { hoje: HOJE, professorId }),
    [banco, termo, professorId],
  );
  const digitou = termo.trim() !== "";
  const mostrarLista = digitou && (telaCheia || listaAberta);
  const indiceAtivo = Math.min(ativo, resultado.itens.length - 1);

  useEffect(() => {
    if (telaCheia) {
      campo.current?.focus();
      return;
    }
    // Atalho "/" (fora de campos de texto) leva o cursor para a busca.
    function aoTeclarNaPagina(evento: globalThis.KeyboardEvent) {
      if (evento.key !== "/" || evento.ctrlKey || evento.metaKey || evento.altKey) return;
      const alvo = evento.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, select, [contenteditable='true']")) return;
      evento.preventDefault();
      campo.current?.focus();
    }
    document.addEventListener("keydown", aoTeclarNaPagina);
    return () => document.removeEventListener("keydown", aoTeclarNaPagina);
  }, [telaCheia]);

  function limpar() {
    setTermo("");
    setAtivo(0);
    setListaAberta(false);
  }

  function abrir(encontrado: AlunoEncontrado | undefined) {
    if (!encontrado) return;
    router.push(`/alunos/${encontrado.aluno.id}`);
    limpar();
    campo.current?.blur();
    aoTerminar?.();
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    const quantidade = resultado.itens.length;
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      if (quantidade === 0) return;
      evento.preventDefault();
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      setListaAberta(true);
      setAtivo(listaAberta || telaCheia ? (indiceAtivo + passo + quantidade) % quantidade : 0);
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      abrir(resultado.itens[Math.max(indiceAtivo, 0)]);
    } else if (evento.key === "Escape") {
      evento.preventDefault();
      if (telaCheia) aoTerminar?.();
      else if (listaAberta && digitou) setListaAberta(false);
      else limpar();
    }
  }

  function aoSairDoCampo(evento: FocusEvent<HTMLDivElement>) {
    if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setListaAberta(false);
  }

  const placeholder =
    colaborador.perfil === "professor" ? "Buscar entre meus alunos…" : "Buscar aluno…";

  const campoDeBusca = (
    <div className="relative min-w-0 flex-1">
      <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
      <input
        ref={campo}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls={idDaLista}
        aria-autocomplete="list"
        aria-activedescendant={
          mostrarLista && indiceAtivo >= 0 ? `${id}-opcao-${indiceAtivo}` : undefined
        }
        aria-label="Buscar aluno pelo nome ou telefone"
        placeholder={placeholder}
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value);
          setAtivo(0);
          setListaAberta(true);
        }}
        onFocus={() => setListaAberta(true)}
        onKeyDown={aoTeclar}
        autoComplete="off"
        spellCheck={false}
        className={`campo pl-9 ${telaCheia ? "py-2.5 text-base" : "py-2 pr-9"}`}
      />
      {!telaCheia && !termo && (
        <kbd
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-areia-300 bg-areia-50 px-1.5 text-[11px] font-medium leading-5 text-areia-500"
          title="Atalho: tecla /"
        >
          /
        </kbd>
      )}
    </div>
  );

  const lista = (
    <>
      <ul
        id={idDaLista}
        role="listbox"
        aria-label="Alunos encontrados"
        className={telaCheia ? "" : "max-h-[22rem] overflow-y-auto py-1"}
      >
        {resultado.itens.map((encontrado, i) => {
          const { aluno, plano, situacao } = encontrado;
          const escolhido = i === indiceAtivo;
          return (
            <li
              key={aluno.id}
              id={`${id}-opcao-${i}`}
              role="option"
              aria-selected={escolhido}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setAtivo(i)}
              onClick={() => abrir(encontrado)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${
                escolhido ? "bg-saibro-50" : ""
              } ${telaCheia ? "border-b border-areia-100 py-3" : ""}`}
            >
              <span aria-hidden="true">
                <Avatar id={aluno.id} nome={aluno.nome} src={aluno.fotoUrl} tamanho="sm" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-areia-900">
                  {destacar(aluno.nome, termo)}
                </span>
                <span className="block truncate text-xs text-areia-500">
                  {plano?.nome ?? "Sem plano mensal"} · {aluno.telefone}
                </span>
              </span>
              {situacao !== "ativo" && (
                <span className="chip shrink-0 border border-areia-200 bg-areia-50 text-[11px] text-areia-600">
                  {ROTULO_DA_SITUACAO[situacao]}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {resultado.itens.length === 0 && (
        <div className="px-4 py-5 text-sm text-areia-600">
          <p>
            Nenhum aluno encontrado para <strong className="font-semibold">“{termo.trim()}”</strong>.
          </p>
          <p className="mt-1 text-xs text-areia-500">
            Dica: busque por um pedaço do nome ou pelos números do telefone.
          </p>
        </div>
      )}

      {(!telaCheia || resultado.total > resultado.itens.length) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-areia-100 bg-areia-50/70 px-4 py-2 text-[11px] text-areia-500">
          {!telaCheia && <span>↑ ↓ para escolher · Enter abre a ficha · Esc fecha</span>}
          {resultado.total > resultado.itens.length && (
            <Link
              href={`/alunos?busca=${encodeURIComponent(termo.trim())}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                limpar();
                aoTerminar?.();
              }}
              className="font-semibold text-tijolo-700 hover:underline"
            >
              Ver os {resultado.total} na lista de alunos
            </Link>
          )}
        </div>
      )}
    </>
  );

  const aviso = (
    <p className="sr-only" aria-live="polite">
      {digitou
        ? `${resultado.total} ${resultado.total === 1 ? "aluno encontrado" : "alunos encontrados"}`
        : ""}
    </p>
  );

  if (telaCheia) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-areia-200 px-4 py-3">
          {campoDeBusca}
          {fechar}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div hidden={!digitou}>{lista}</div>
          {!digitou && (
            <p className="px-4 py-6 text-sm text-areia-500">
              Digite o nome ou o telefone do aluno para abrir a ficha.
            </p>
          )}
        </div>
        {aviso}
      </div>
    );
  }

  return (
    <div className="relative w-56 lg:w-72 xl:w-80" onBlur={aoSairDoCampo}>
      {campoDeBusca}
      <div
        hidden={!mostrarLista}
        className="absolute right-0 top-full z-40 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-areia-200 bg-white shadow-card-hover"
      >
        {lista}
      </div>
      {aviso}
    </div>
  );
}

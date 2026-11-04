"use client";

import Link from "next/link";
import { useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { FormularioAluno } from "@/components/aluno/FormularioAluno";
import { ModalInativar } from "@/components/aluno/ModaisCadastro";
import {
  CLIENTES_POR_VEZ,
  TabelaDeClientes,
  type OrdemDosClientes,
} from "@/components/aluno/TabelaDeClientes";
import { BotaoFiltro } from "@/components/ui/BotaoFiltro";
import { CabecalhoDaPagina } from "@/components/ui/CabecalhoDaPagina";
import { Card } from "@/components/ui/Card";
import { Carregando } from "@/components/ui/Carregando";
import { IconeBusca, IconeMais, IconeUsuarios } from "@/components/ui/Icons";
import { Segmentado } from "@/components/ui/Segmentado";
import { HOJE } from "@/lib/banco/constantes";
import type { Aluno } from "@/lib/banco/tipos";
import {
  ORDEM_CATEGORIAS,
  ROTULO_CATEGORIA,
  filtrarAlunos,
  linhasDaListaDeAlunos,
  opcoesDePlano,
  podeAlterarCadastros,
  professoresAtivos,
  type EstadoDoCliente,
  type FiltroDeCategoria,
  type FiltroDeSituacao,
  type SituacaoAluno,
} from "@/lib/consultas/alunos";
import { useApp } from "@/store/AppStore";

export default function PaginaClientes() {
  return (
    <Suspense fallback={<Carregando />}>
      <ListaDeAlunosPelaUrl />
    </Suspense>
  );
}

/**
 * Le os filtros do endereco. Quando o endereco muda com a tela aberta (a busca
 * rapida do topo leva para /alunos?busca=ana), a `key` monta a lista de novo
 * com os filtros novos. A lista nao escreve no endereco: os filtros escolhidos
 * na tela ficam so no estado dela.
 */
function ListaDeAlunosPelaUrl() {
  const parametros = useSearchParams();
  return <ListaDeClientes key={parametros.toString()} parametros={parametros} />;
}

/** Situacoes de quem esta ativo; "inativo" vira o botao Inativos. */
const SITUACOES_DOS_ATIVOS: { valor: SituacaoAluno; rotulo: string }[] = [
  { valor: "ativo", rotulo: "Com plano valendo" },
  { valor: "congelado", rotulo: "Plano congelado" },
  { valor: "avulso", rotulo: "Sem plano mensal" },
];

const ESTADOS: { valor: EstadoDoCliente; rotulo: string }[] = [
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "inativos", rotulo: "Inativos" },
  { valor: "todos", rotulo: "Todos" },
];

interface Filtros {
  busca: string;
  plano: string;
  professor: string;
  situacao: FiltroDeSituacao;
  estado: EstadoDoCliente;
  categoria: FiltroDeCategoria;
}

const PADRAO: Filtros = {
  busca: "",
  plano: "todos",
  professor: "todos",
  situacao: "todas",
  estado: "ativos",
  categoria: "todas",
};

/**
 * Filtros que vem no endereco: /alunos?busca=ana, ?professor=prof-1,
 * ?situacao=congelado, ?plano=tipo:Dupla, ?estado=inativos, ?categoria=torneio.
 * Quem chega pela busca rapida ve ativos e inativos (como a busca do topo).
 */
function filtrosDaUrl(parametros: ReadonlyURLSearchParams): Filtros {
  const busca = parametros.get("busca") ?? "";
  const situacaoUrl = parametros.get("situacao");
  const estadoUrl = parametros.get("estado");
  const categoriaUrl = parametros.get("categoria");
  const situacao: FiltroDeSituacao =
    SITUACOES_DOS_ATIVOS.find((s) => s.valor === situacaoUrl)?.valor ?? "todas";
  const estado: EstadoDoCliente =
    ESTADOS.find((e) => e.valor === estadoUrl)?.valor ??
    (situacaoUrl === "inativo" ? "inativos" : busca.trim() ? "todos" : "ativos");
  return {
    busca,
    plano: parametros.get("plano") ?? "todos",
    professor: parametros.get("professor") ?? "todos",
    situacao: estado === "inativos" ? "todas" : situacao,
    estado,
    categoria: ORDEM_CATEGORIAS.find((c) => c === categoriaUrl) ?? "todas",
  };
}

/** Numero pequeno ao lado do rotulo de um filtro. */
function Contagem({ valor, ativo }: { valor: number; ativo: boolean }) {
  return (
    <span
      className={`ml-1.5 inline-block min-w-[1.5rem] rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums ${
        ativo ? "bg-saibro-800 text-white" : "bg-white text-areia-700 ring-1 ring-inset ring-areia-200"
      }`}
    >
      {valor}
    </span>
  );
}

type AcaoNaLista = { tipo: "editar" | "inativar"; aluno: Aluno };

/**
 * Clientes (rota /alunos): Ativos/Inativos/Todos, grupos (Ranking, Alunos,
 * Aluguel, Torneio — Hipotese H15), busca, plano, professor e situacao, e a
 * tabela densa com editar e inativar para quem pode alterar cadastros.
 */
function ListaDeClientes({ parametros }: { parametros: ReadonlyURLSearchParams }) {
  const router = useRouter();
  const { banco, colaborador } = useApp();
  const podeEditar = podeAlterarCadastros(colaborador);
  // Hipotese H9: o professor ve so os proprios alunos.
  const soDoProfessorId = colaborador.perfil === "professor" ? colaborador.professorId : undefined;

  const [filtros, setFiltros] = useState<Filtros>(() => filtrosDaUrl(parametros));
  const [ordem, setOrdem] = useState<OrdemDosClientes>("asc");
  const [limite, setLimite] = useState(CLIENTES_POR_VEZ);
  const [novoAberto, setNovoAberto] = useState(false);
  const [acao, setAcao] = useState<AcaoNaLista | null>(null);

  const linhas = useMemo(() => linhasDaListaDeAlunos(banco, HOJE), [banco]);
  const resultado = useMemo(
    () => filtrarAlunos(banco, linhas, { ...filtros, soDoProfessorId }, HOJE),
    [banco, linhas, filtros, soDoProfessorId],
  );
  // Resumo do cabecalho: todos os clientes que o perfil enxerga, sem filtro.
  const geral = useMemo(
    () => filtrarAlunos(banco, linhas, { ...PADRAO, estado: "todos", soDoProfessorId }, HOJE),
    [banco, linhas, soDoProfessorId],
  );
  const { tipos, planos } = useMemo(() => opcoesDePlano(banco), [banco]);
  const professores = useMemo(() => professoresAtivos(banco), [banco]);
  const ordenadas = useMemo(
    () => (ordem === "asc" ? resultado.linhas : [...resultado.linhas].reverse()),
    [resultado.linhas, ordem],
  );

  const filtrando = (Object.keys(PADRAO) as (keyof Filtros)[]).some((k) => filtros[k] !== PADRAO[k]);

  /** Muda um filtro e volta a lista para o começo. */
  function mudar(novos: Partial<Filtros>) {
    setFiltros((atual) => ({ ...atual, ...novos }));
    setLimite(CLIENTES_POR_VEZ);
  }

  function limparFiltros() {
    setFiltros(PADRAO);
    setLimite(CLIENTES_POR_VEZ);
  }

  const { contagem } = geral;
  const descricao = [
    `${geral.total} ${geral.total === 1 ? "cliente" : "clientes"}`,
    `${contagem.ativo} com plano`,
    contagem.congelado > 0 && `${contagem.congelado} ${contagem.congelado === 1 ? "congelado" : "congelados"}`,
    contagem.avulso > 0 && `${contagem.avulso} sem plano`,
    contagem.inativo > 0 && `${contagem.inativo} ${contagem.inativo === 1 ? "inativo" : "inativos"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5">
      <CabecalhoDaPagina
        titulo="Clientes"
        descricao={descricao}
        acoes={
          <>
            <Link href="/professores" className="btn-secundario">
              <IconeUsuarios className="h-4 w-4" />
              Professores
            </Link>
            {podeEditar && (
              <button type="button" onClick={() => setNovoAberto(true)} className="btn-primario">
                <IconeMais className="h-4 w-4" />
                Novo cliente
              </button>
            )}
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-areia-200 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
            <Segmentado
              aria="Ativos ou inativos"
              valor={filtros.estado}
              aoMudar={(estado) =>
                mudar(estado === "inativos" ? { estado, situacao: "todas" } : { estado })
              }
              opcoes={ESTADOS.map(({ valor, rotulo }) => ({
                valor,
                rotulo: (
                  <span className="inline-flex items-center">
                    {rotulo}
                    <Contagem valor={resultado.porEstado[valor]} ativo={filtros.estado === valor} />
                  </span>
                ),
              }))}
            />
            <div role="group" aria-label="Grupo de clientes" className="flex flex-wrap gap-1.5">
              {(["todas", ...ORDEM_CATEGORIAS] as FiltroDeCategoria[]).map((categoria) => {
                const ativo = filtros.categoria === categoria;
                return (
                  <BotaoFiltro key={categoria} ativo={ativo} aoClicar={() => mudar({ categoria })}>
                    {categoria === "todas" ? "Todos" : ROTULO_CATEGORIA[categoria]}
                    <Contagem valor={resultado.porCategoria[categoria]} ativo={ativo} />
                  </BotaoFiltro>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-[minmax(0,1fr)_12.5rem_12.5rem_12.5rem]">
            <div className="relative col-span-2 md:col-span-3 lg:col-span-1">
              <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
              <input
                type="search"
                value={filtros.busca}
                onChange={(e) => mudar({ busca: e.target.value })}
                placeholder="Buscar por nome, telefone ou e-mail…"
                className="campo py-2 pl-9"
                aria-label="Buscar cliente por nome, telefone ou e-mail"
              />
            </div>
            <select
              value={filtros.plano}
              onChange={(e) => mudar({ plano: e.target.value })}
              className="campo py-2"
              aria-label="Filtrar por plano"
            >
              <option value="todos">Todos os planos</option>
              <option value="sem">Sem plano mensal</option>
              <optgroup label="Por tipo de plano">
                {tipos.map((tipo) => (
                  <option key={tipo} value={`tipo:${tipo}`}>
                    {tipo}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Por plano">
                {planos.map((p) => (
                  <option key={p.id} value={`plano:${p.id}`}>
                    {p.nome}
                  </option>
                ))}
              </optgroup>
            </select>
            <select
              value={filtros.professor}
              onChange={(e) => mudar({ professor: e.target.value })}
              className="campo py-2"
              aria-label="Filtrar por professor principal"
            >
              <option value="todos">Todos os professores</option>
              <option value="sem">Sem professor principal</option>
              {professores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <select
              value={filtros.situacao}
              onChange={(e) => {
                const situacao = e.target.value as FiltroDeSituacao;
                // Escolher uma situacao de quem esta ativo sai de "Inativos".
                mudar(
                  situacao !== "todas" && filtros.estado === "inativos"
                    ? { situacao, estado: "ativos" }
                    : { situacao },
                );
              }}
              className="campo col-span-2 py-2 md:col-span-1"
              aria-label="Filtrar por situação do plano"
            >
              <option value="todas">Todas as situações</option>
              {SITUACOES_DOS_ATIVOS.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo} ({resultado.contagem[s.valor]})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex min-h-[2.25rem] flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-areia-200 px-4 py-1.5 text-xs text-areia-600">
          <span aria-live="polite">
            <strong className="font-semibold text-areia-900">{resultado.linhas.length}</strong>{" "}
            {resultado.linhas.length === 1 ? "cliente encontrado" : "clientes encontrados"}
          </span>
          {filtrando && (
            <button type="button" onClick={limparFiltros} className="link-acao alvo-de-toque">
              Limpar filtros
            </button>
          )}
        </div>

        <TabelaDeClientes
          linhas={ordenadas}
          limite={limite}
          ordem={ordem}
          podeAlterar={podeEditar}
          aoAlternarOrdem={() => setOrdem((atual) => (atual === "asc" ? "desc" : "asc"))}
          aoMostrarMais={() => setLimite((atual) => atual + CLIENTES_POR_VEZ)}
          aoEditar={(aluno) => setAcao({ tipo: "editar", aluno })}
          aoInativar={(aluno) => setAcao({ tipo: "inativar", aluno })}
          vazio={
            <>
              Nenhum cliente encontrado com esses filtros.
              {filtrando && (
                <>
                  {" "}
                  <button type="button" onClick={limparFiltros} className="link-acao">
                    Limpar filtros
                  </button>
                </>
              )}
            </>
          }
        />
      </Card>

      <FormularioAluno
        aberto={novoAberto}
        aoFechar={() => setNovoAberto(false)}
        aoSalvar={(id) => router.push(`/alunos/${id}`)}
      />
      {/* Montados so quando abertos: o formulario comeca com os dados do cliente clicado. */}
      {acao?.tipo === "editar" && (
        <FormularioAluno aberto aoFechar={() => setAcao(null)} aluno={acao.aluno} />
      )}
      {acao?.tipo === "inativar" && (
        <ModalInativar aberto aoFechar={() => setAcao(null)} aluno={acao.aluno} />
      )}
    </div>
  );
}

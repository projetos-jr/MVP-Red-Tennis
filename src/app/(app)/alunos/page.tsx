"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  ESTADOS_DO_CLIENTE,
  FILTROS_PADRAO_DA_LISTA,
  ORDEM_CATEGORIAS,
  ROTULO_CATEGORIA,
  SITUACOES_DO_FILTRO,
  enderecoDaListaDeClientes,
  filtrarAlunos,
  filtrosDaListaPeloEndereco,
  linhasDaListaDeAlunos,
  opcoesDePlano,
  podeAlterarCadastros,
  professoresAtivos,
  type EstadoDoCliente,
  type FiltroDeCategoria,
  type FiltroDeSituacao,
  type FiltrosDaListaDeClientes,
  type SituacaoAluno,
} from "@/lib/consultas/alunos";
import { podeAcessar } from "@/lib/consultas/base";
import { useApp } from "@/store/AppStore";

export default function PaginaClientes() {
  return (
    <Suspense fallback={<Carregando />}>
      <ListaDeClientes />
    </Suspense>
  );
}

const ROTULO_DO_ESTADO: Record<EstadoDoCliente, string> = {
  ativos: "Ativos",
  inativos: "Inativos",
  todos: "Todos",
};

/** Rotulos do filtro de situacao ("inativo" e o botao Inativos). */
const ROTULO_DA_SITUACAO: Record<SituacaoAluno, string> = {
  ativo: "Com plano valendo",
  congelado: "Plano congelado",
  avulso: "Sem plano mensal",
  inativo: "Inativo",
};

type Filtros = FiltrosDaListaDeClientes;

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
 *
 * O ENDERECO e a fonte da verdade dos filtros (ver `filtrosDaListaPeloEndereco`
 * em `consultas/alunos.ts`): cada mudanca reescreve o endereco com
 * `history.replaceState` e a tela acompanha. Assim o "Ver os N na lista" da
 * busca rapida sempre vale (e outro endereco), e voltar da ficha devolve os
 * mesmos filtros. Ordem, "Mostrar mais" e janelas abertas ficam so na tela.
 */
function ListaDeClientes() {
  const router = useRouter();
  const parametros = useSearchParams();
  const { banco, colaborador } = useApp();
  const podeEditar = podeAlterarCadastros(colaborador);
  const podeVerProfessores = podeAcessar(banco, colaborador, "professores");
  // Hipotese H9: o professor ve so os proprios alunos.
  const soDoProfessorId = colaborador.perfil === "professor" ? colaborador.professorId : undefined;

  const consulta = parametros.toString();
  const filtros = useMemo(
    () => filtrosDaListaPeloEndereco(new URLSearchParams(consulta)),
    [consulta],
  );
  // O Next atualiza o endereco lido pela tela um instante depois do
  // replaceState. Enquanto a pessoa digita, o campo mostra o que ela digitou
  // (senao o cursor pularia); fora do campo, mostra a busca do endereco.
  const [rascunhoDaBusca, setRascunhoDaBusca] = useState<string | null>(null);
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
    () =>
      filtrarAlunos(
        banco,
        linhas,
        { ...FILTROS_PADRAO_DA_LISTA, estado: "todos", soDoProfessorId },
        HOJE,
      ),
    [banco, linhas, soDoProfessorId],
  );
  const { tipos, planos } = useMemo(() => opcoesDePlano(banco), [banco]);
  const professores = useMemo(() => professoresAtivos(banco), [banco]);
  const ordenadas = useMemo(
    () => (ordem === "asc" ? resultado.linhas : [...resultado.linhas].reverse()),
    [resultado.linhas, ordem],
  );

  const filtrando = (Object.keys(FILTROS_PADRAO_DA_LISTA) as (keyof Filtros)[]).some(
    (k) => filtros[k] !== FILTROS_PADRAO_DA_LISTA[k],
  );

  /**
   * Muda filtros (reescreve o endereco; a tela acompanha) e volta a lista
   * para o começo. Parte do endereco de AGORA, e nao do ultimo desenho: duas
   * mudancas seguidas, antes de a tela acompanhar, nao se perdem.
   */
  function mudar(novos: Partial<Filtros> | ((atual: Filtros) => Partial<Filtros>)) {
    const atual = filtrosDaListaPeloEndereco(new URLSearchParams(window.location.search));
    const mudancas = typeof novos === "function" ? novos(atual) : novos;
    window.history.replaceState(null, "", enderecoDaListaDeClientes({ ...atual, ...mudancas }));
    setLimite(CLIENTES_POR_VEZ);
  }

  function limparFiltros() {
    setRascunhoDaBusca((rascunho) => (rascunho === null ? null : ""));
    window.history.replaceState(null, "", enderecoDaListaDeClientes(FILTROS_PADRAO_DA_LISTA));
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
            {/* So para quem abre a tela de professores (o perfil de professor nao abre). */}
            {podeVerProfessores && (
              <Link href="/professores" className="btn-secundario">
                <IconeUsuarios className="h-4 w-4" />
                Professores
              </Link>
            )}
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
              opcoes={ESTADOS_DO_CLIENTE.map((valor) => ({
                valor,
                rotulo: (
                  <span className="inline-flex items-center">
                    {ROTULO_DO_ESTADO[valor]}
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
                value={rascunhoDaBusca ?? filtros.busca}
                onFocus={() => setRascunhoDaBusca(filtros.busca)}
                onBlur={() => setRascunhoDaBusca(null)}
                onChange={(e) => {
                  setRascunhoDaBusca(e.target.value);
                  mudar({ busca: e.target.value });
                }}
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
                mudar((atual) =>
                  situacao !== "todas" && atual.estado === "inativos"
                    ? { situacao, estado: "ativos" }
                    : { situacao },
                );
              }}
              className="campo col-span-2 py-2 md:col-span-1"
              aria-label="Filtrar por situação do plano"
            >
              <option value="todas">Todas as situações</option>
              {SITUACOES_DO_FILTRO.map((situacao) => (
                <option key={situacao} value={situacao}>
                  {ROTULO_DA_SITUACAO[situacao]} ({resultado.contagem[situacao]})
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

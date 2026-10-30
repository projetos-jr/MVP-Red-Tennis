"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type CSSProperties } from "react";
import { FormularioAluno } from "@/components/aluno/FormularioAluno";
import {
  ESTILO_SITUACAO_ALUNO,
  ESTILO_TABELA,
  ORDEM_SITUACOES,
} from "@/components/aluno/estilos";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { CabecalhoDaPagina } from "@/components/ui/CabecalhoDaPagina";
import { Card } from "@/components/ui/Card";
import { IconeBusca, IconeCheck, IconeMais, IconeUsuarios } from "@/components/ui/Icons";
import { ITENS_POR_PAGINA, MostrarMais } from "@/components/ui/MostrarMais";
import { HOJE } from "@/lib/banco/constantes";
import {
  filtrarAlunos,
  linhasDaListaDeAlunos,
  opcoesDePlano,
  podeAlterarCadastros,
  professoresAtivos,
  type FiltroDeSituacao,
  type LinhaDaListaDeAlunos,
  type SituacaoAluno,
} from "@/lib/consultas/alunos";
import { formatarMinutos, formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";

export default function PaginaAlunos() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <ListaDeAlunos />
    </Suspense>
  );
}

function situacaoDaUrl(valor: string | null): FiltroDeSituacao {
  return valor && (ORDEM_SITUACOES as string[]).includes(valor) ? (valor as SituacaoAluno) : "todas";
}

/**
 * Lista de alunos: busca (nome, telefone ou e-mail), filtros por plano,
 * professor e situacao, contadores e cadastro de aluno novo. Os filtros podem
 * vir na URL (/alunos?professor=prof-1&situacao=congelado).
 */
function ListaDeAlunos() {
  const parametros = useSearchParams();
  const router = useRouter();
  const { banco, colaborador } = useApp();
  const podeEditar = podeAlterarCadastros(colaborador);

  const [busca, setBusca] = useState("");
  const [plano, setPlano] = useState(parametros.get("plano") ?? "todos");
  const [professor, setProfessor] = useState(parametros.get("professor") ?? "todos");
  const [situacao, setSituacao] = useState<FiltroDeSituacao>(() =>
    situacaoDaUrl(parametros.get("situacao")),
  );
  const [formularioAberto, setFormularioAberto] = useState(false);
  // A lista mostra 20 alunos por vez e volta ao começo quando um filtro muda.
  const [limite, setLimite] = useState(ITENS_POR_PAGINA);

  const linhas = useMemo(() => linhasDaListaDeAlunos(banco, HOJE), [banco]);
  const resultado = useMemo(
    () =>
      filtrarAlunos(
        banco,
        linhas,
        {
          busca,
          plano,
          professor,
          situacao,
          // Hipotese H9: o professor ve so os proprios alunos.
          soDoProfessorId: colaborador.perfil === "professor" ? colaborador.professorId : undefined,
        },
        HOJE,
      ),
    [banco, linhas, busca, plano, professor, situacao, colaborador],
  );
  const { tipos, planos } = useMemo(() => opcoesDePlano(banco), [banco]);
  const professores = useMemo(() => professoresAtivos(banco), [banco]);

  const filtrando = busca.trim() !== "" || plano !== "todos" || professor !== "todos" || situacao !== "todas";

  function limparFiltros() {
    setBusca("");
    setPlano("todos");
    setProfessor("todos");
    setSituacao("todas");
    setLimite(ITENS_POR_PAGINA);
  }

  return (
    <div className="space-y-5">
      <CabecalhoDaPagina
        titulo="Alunos"
        descricao={`${banco.alunos.length} cadastrados · ${
          linhas.filter((l) => l.situacao === "ativo").length
        } com plano ativo`}
        acoes={
          <>
            <Link href="/professores" className="btn-secundario">
              <IconeUsuarios className="h-4 w-4" />
              Professores
            </Link>
            {podeEditar && (
              <button type="button" onClick={() => setFormularioAberto(true)} className="btn-primario">
                <IconeMais className="h-4 w-4" />
                Novo aluno
              </button>
            )}
          </>
        }
      />

      {/* Contadores, que tambem filtram por situacao */}
      <div
        role="group"
        aria-label="Filtrar por situação"
        className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
      >
        {ORDEM_SITUACOES.map((chave) => (
          <Contador
            key={chave}
            situacao={chave}
            quantidade={resultado.contagem[chave]}
            selecionado={situacao === chave}
            aoClicar={() => {
              setSituacao(situacao === chave ? "todas" : chave);
              setLimite(ITENS_POR_PAGINA);
            }}
          />
        ))}
      </div>

      <Card>
        <div className="grid gap-3 border-b border-areia-200 p-4 md:grid-cols-[minmax(0,1fr)_14rem_13rem]">
          <div className="relative">
            <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
            <input
              type="search"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setLimite(ITENS_POR_PAGINA);
              }}
              placeholder="Buscar por nome, telefone ou e-mail…"
              className="campo py-2 pl-9"
              aria-label="Buscar aluno por nome, telefone ou e-mail"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:contents">
            <select
              value={plano}
              onChange={(e) => {
                setPlano(e.target.value);
                setLimite(ITENS_POR_PAGINA);
              }}
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
              value={professor}
              onChange={(e) => {
                setProfessor(e.target.value);
                setLimite(ITENS_POR_PAGINA);
              }}
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
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-areia-100 px-4 py-2 text-xs text-areia-500">
          <span aria-live="polite">
            {resultado.linhas.length === 1
              ? "1 aluno encontrado"
              : `${resultado.linhas.length} alunos encontrados`}
            {situacao !== "todas" && ` · ${ESTILO_SITUACAO_ALUNO[situacao].rotulo.toLowerCase()}`}
          </span>
          {filtrando && (
            <button
              type="button"
              onClick={limparFiltros}
              className="font-medium text-saibro-700 hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Cabecalho das colunas (so no computador) */}
        <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1.1fr)_7.5rem] gap-4 border-b border-areia-100 px-4 py-2 text-xs font-medium uppercase tracking-wide text-areia-500 md:grid">
          <span>Aluno</span>
          <span>Plano</span>
          <span>Professor</span>
          <span className="text-right">Situação</span>
        </div>

        <ul className="divide-y divide-areia-100">
          {resultado.linhas.slice(0, limite).map((linha) => (
            <LinhaDoAluno key={linha.aluno.id} linha={linha} />
          ))}
          {resultado.linhas.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-areia-500">
              Nenhum aluno encontrado com esses filtros.
              {filtrando && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={limparFiltros}
                    className="font-medium text-saibro-700 hover:underline"
                  >
                    Limpar filtros
                  </button>
                </>
              )}
            </li>
          )}
        </ul>
        <MostrarMais
          mostrando={Math.min(limite, resultado.linhas.length)}
          total={resultado.linhas.length}
          aoMostrarMais={() => setLimite((atual) => atual + ITENS_POR_PAGINA)}
        />
      </Card>

      <FormularioAluno
        aberto={formularioAberto}
        aoFechar={() => setFormularioAberto(false)}
        aoSalvar={(id) => router.push(`/alunos/${id}`)}
      />
    </div>
  );
}

function Contador({
  situacao,
  quantidade,
  selecionado,
  aoClicar,
}: {
  situacao: SituacaoAluno;
  quantidade: number;
  selecionado: boolean;
  aoClicar: () => void;
}) {
  const estilo = ESTILO_SITUACAO_ALUNO[situacao];
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={selecionado}
      className={`flex items-start justify-between gap-2 rounded-2xl border bg-white p-3 text-left shadow-card transition-colors sm:p-4 ${
        selecionado ? "ring-2 ring-offset-1" : "hover:border-areia-300"
      }`}
      // A cor da borda e do anel acompanha a situacao.
      style={
        {
          borderColor: selecionado ? estilo.cor : undefined,
          "--tw-ring-color": estilo.cor,
        } as CSSProperties
      }
    >
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-areia-500">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: estilo.cor }} />
          {estilo.rotulo}
        </span>
        <span className="mt-1 block text-xl font-semibold leading-none text-areia-900 sm:text-2xl sm:leading-none">
          {quantidade}
        </span>
        <span className="mt-1.5 hidden text-xs text-areia-600 sm:block">{estilo.descricao}</span>
      </span>
      {selecionado && <IconeCheck className="h-5 w-5 shrink-0" style={{ color: estilo.cor }} />}
    </button>
  );
}

function LinhaDoAluno({ linha }: { linha: LinhaDaListaDeAlunos }) {
  const { aluno, plano, professor, situacao, saldoReposicao, valorEmAtraso } = linha;
  const estilo = ESTILO_SITUACAO_ALUNO[situacao];
  return (
    <li>
      <Link
        href={`/alunos/${aluno.id}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-areia-50 md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1.1fr)_7.5rem] md:gap-4"
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar id={aluno.id} nome={aluno.nome} src={aluno.fotoUrl} tamanho="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-areia-900">{aluno.nome}</span>
            {/* No celular, plano e professor vao embaixo do nome */}
            <span className="block truncate text-xs text-areia-500 md:hidden">
              {plano?.nome ?? "Sem plano mensal"}
              {professor && ` · ${professor.nome}`}
            </span>
            <span className="hidden truncate text-xs tabular-nums text-areia-500 md:block">
              {aluno.telefone || aluno.email || "Sem contato"}
            </span>
          </span>
        </span>

        <span className="hidden min-w-0 md:block">
          <span className="block truncate text-sm text-areia-800">
            {plano?.nome ?? <span className="text-areia-500">Sem plano mensal</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {plano?.tabela === "antiga" && (
              <Badge
                cor={ESTILO_TABELA.antiga.cor}
                fundo={ESTILO_TABELA.antiga.fundo}
                className="px-2 py-0.5 text-[10px]"
              >
                {ESTILO_TABELA.antiga.rotulo}
              </Badge>
            )}
            {saldoReposicao > 0 && (
              <span className="text-[11px] text-areia-500">
                Reposição: {formatarMinutos(saldoReposicao)}
              </span>
            )}
          </span>
        </span>

        <span className="hidden truncate text-sm text-areia-700 md:block">
          {professor?.nome ?? <span className="text-areia-400">—</span>}
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          <Badge cor={estilo.cor} fundo={estilo.fundo} borda={estilo.borda}>
            {estilo.rotulo}
          </Badge>
          {valorEmAtraso > 0 && (
            <span className="text-[11px] font-semibold text-tijolo-700">
              {formatarMoeda(valorEmAtraso)} em atraso
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

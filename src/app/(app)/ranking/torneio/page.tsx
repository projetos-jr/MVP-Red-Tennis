"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AvataresDoLado } from "@/components/ranking/AvataresDoLado";
import { CaixaDaPartida } from "@/components/ranking/CaixaDaPartida";
import { ChaveEliminatoria } from "@/components/ranking/ChaveEliminatoria";
import { SituacaoDoTorneio } from "@/components/ranking/ListaTorneios";
import { MatrizDeConfrontos } from "@/components/ranking/MatrizDeConfrontos";
import { ModalPartidaDoTorneio } from "@/components/ranking/ModalPartidaDoTorneio";
import { ModalTorneio } from "@/components/ranking/ModalTorneio";
import { TabelaClassificacao } from "@/components/ranking/TabelaClassificacao";
import { ComentariosDoRegistro } from "@/components/registro/ComentariosDoRegistro";
import { HistoricoDoRegistro } from "@/components/registro/HistoricoDoRegistro";
import { LinkDeVolta } from "@/components/ui/CabecalhoDaPagina";
import { Card, CardHeader } from "@/components/ui/Card";
import { Carregando } from "@/components/ui/Carregando";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { EstadoVazio } from "@/components/ui/EstadoVazio";
import {
  IconeAlerta,
  IconeBola,
  IconeBusca,
  IconeCheck,
  IconeTrofeu,
  IconeUsuarios,
} from "@/components/ui/Icons";
import { desfazerChaveDoTorneio, gerarChaveDoTorneio } from "@/lib/banco/operacoes/ranking";
import {
  detalheDoTorneio,
  ROTULO_FORMATO,
  type CaixaDePartida,
  type DetalheDoTorneio,
  type InscricaoNaTela,
} from "@/lib/consultas/ranking";
import { formatarData, formatarDataExtenso } from "@/lib/date";
import { ESTILO_CATEGORIA } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";

const ROTULOS_DO_TORNEIO: Record<string, string> = {
  nome: "Nome",
  data: "Data",
  formato: "Formato",
  categoria: "Categoria",
  duplas: "Duplas",
  situacao: "Situação",
};

export default function PaginaTorneio() {
  // O torneio vem da URL (?id=t-1); o Next pede um Suspense em volta.
  return (
    <Suspense fallback={<Carregando />}>
      <ConteudoDoTorneio />
    </Suspense>
  );
}

function ListaDeInscricoes({ inscricoes, comGrupo }: { inscricoes: InscricaoNaTela[]; comGrupo: boolean }) {
  if (inscricoes.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-areia-500">Ninguém inscrito ainda.</p>;
  }
  return (
    <ol className="divide-y divide-areia-100">
      {inscricoes.map(({ inscricao, nome, alunos }, i) => (
        <li key={inscricao.id} className="flex items-center gap-3 px-5 py-2.5">
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-areia-500">{i + 1}</span>
          <AvataresDoLado alunos={alunos} tamanho="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-areia-900">
            {alunos.length === 1 ? (
              <Link href={`/alunos/${alunos[0].id}`} className="hover:text-tijolo-700 hover:underline">
                {nome}
              </Link>
            ) : (
              nome
            )}
          </span>
          {alunos.length === 1 && alunos[0].categoriaRanking && (
            <span
              className="hidden shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold sm:inline"
              style={{
                color: ESTILO_CATEGORIA[alunos[0].categoriaRanking].cor,
                backgroundColor: ESTILO_CATEGORIA[alunos[0].categoriaRanking].fundo,
                borderColor: ESTILO_CATEGORIA[alunos[0].categoriaRanking].borda,
              }}
            >
              Cat. {alunos[0].categoriaRanking}
            </span>
          )}
          {comGrupo && inscricao.grupo && (
            <span className="shrink-0 rounded-full bg-areia-100 px-2 py-0.5 text-[11px] font-semibold text-areia-700">
              Grupo {inscricao.grupo}
            </span>
          )}
          {inscricao.cabecaDeChave && (
            <span className="shrink-0 rounded-full border border-saibro-200 bg-saibro-50 px-2 py-0.5 text-[11px] font-semibold text-saibro-800">
              Cabeça {inscricao.cabecaDeChave}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function BannerDoCampeao({ campeao, duplas }: { campeao: InscricaoNaTela; duplas: boolean }) {
  return (
    <div className="flex items-center gap-4 border-t border-saibro-200 bg-gradient-to-r from-saibro-50 via-white to-saibro-50 px-5 py-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-saibro-600 text-white shadow-card">
        <IconeTrofeu className="h-7 w-7" />
      </span>
      <AvataresDoLado alunos={campeao.alunos} tamanho="md" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-saibro-700">
          {duplas ? "Dupla campeã" : "Campeão"}
        </p>
        <p className="truncate text-lg font-bold text-areia-900">{campeao.nome}</p>
      </div>
    </div>
  );
}

function GradeDeJogos({ jogos, aoAbrir }: { jogos: CaixaDePartida[]; aoAbrir: (id: string) => void }) {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {jogos.map((caixa) => (
        <li key={caixa.partida.id}>
          <CaixaDaPartida caixa={caixa} aoAbrir={aoAbrir} />
        </li>
      ))}
    </ul>
  );
}

/** Jogos agrupados por rodada (todos contra todos). */
function JogosPorRodada({ detalhe, aoAbrir }: { detalhe: DetalheDoTorneio; aoAbrir: (id: string) => void }) {
  const rodadas = [...new Set(detalhe.jogos.map((c) => c.partida.rodada ?? 1))];
  return (
    <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
      {rodadas.map((rodada) => {
        const jogos = detalhe.jogos.filter((c) => (c.partida.rodada ?? 1) === rodada);
        const jogando = new Set(jogos.flatMap((c) => [c.partida.inscricaoAId, c.partida.inscricaoBId]));
        const deFolga = detalhe.inscricoes.filter((i) => !jogando.has(i.inscricao.id));
        return (
          <section key={rodada}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-areia-600">
              Rodada {rodada}
            </h3>
            <ul className="space-y-2">
              {jogos.map((caixa) => (
                <li key={caixa.partida.id}>
                  <CaixaDaPartida caixa={caixa} aoAbrir={aoAbrir} />
                </li>
              ))}
            </ul>
            {deFolga.length > 0 && (
              <p className="mt-1.5 text-[11px] text-areia-500">
                De folga: {deFolga.map((i) => i.nome).join(", ")}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ConteudoDoTorneio() {
  const { banco } = useApp();
  const gravar = useGravar();
  const id = useSearchParams().get("id") ?? "";
  const detalhe = useMemo(() => detalheDoTorneio(banco, id), [banco, id]);

  const [editando, setEditando] = useState<number | null>(null);
  const [gerando, setGerando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [partidaAberta, setPartidaAberta] = useState<string | null>(null);

  if (!detalhe) {
    return (
      <EstadoVazio
        className="mx-auto max-w-lg"
        icone={<IconeBusca className="h-6 w-6" />}
        titulo="Torneio não encontrado"
        tituloDaPagina
        acoes={
          <Link href="/ranking?aba=torneios" className="btn-secundario">
            Voltar para os torneios
          </Link>
        }
      />
    );
  }

  const { torneio, previa } = detalhe;
  const caixaAberta = partidaAberta
    ? detalhe.jogos.find((c) => c.partida.id === partidaAberta)
    : undefined;
  const emInscricoes = torneio.situacao === "inscricoes";
  const unidade = torneio.duplas ? "duplas" : "inscritos";
  const faltamNosGrupos = detalhe.grupos.reduce((soma, g) => soma + g.restantes, 0);

  function gerar() {
    if (gravar(gerarChaveDoTorneio, { id: torneio.id }, "Chave gerada. Bom torneio!")) setGerando(false);
  }

  function desfazer() {
    if (
      gravar(
        desfazerChaveDoTorneio,
        { id: torneio.id },
        "Chave desfeita. As inscrições estão abertas de novo.",
      )
    ) {
      setDesfazendo(false);
    }
  }

  return (
    <div className="space-y-6">
      <LinkDeVolta href="/ranking?aba=torneios">Torneios</LinkDeVolta>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-areia-900">{torneio.nome}</h1>
              <SituacaoDoTorneio situacao={torneio.situacao} />
            </div>
            <p className="mt-1.5 text-sm text-areia-600">
              {[
                formatarDataExtenso(torneio.data),
                torneio.duplas ? "Duplas" : "Simples",
                ROTULO_FORMATO[torneio.formato],
                torneio.categoria ? `Categoria ${torneio.categoria}` : "Livre",
                `${detalhe.inscricoes.length} ${unidade}`,
              ].join(" · ")}
            </p>
            {detalhe.total > 0 && (
              <div className="mt-3 flex max-w-sm items-center gap-3">
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-areia-100"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={detalhe.total}
                  aria-valuenow={detalhe.jogadas}
                  aria-label="Jogos com resultado"
                >
                  <div
                    className="h-full rounded-full bg-saibro-500"
                    style={{ width: `${Math.round((detalhe.jogadas / detalhe.total) * 100)}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs text-areia-600">
                  {detalhe.jogadas} de {detalhe.total} jogos
                </span>
              </div>
            )}
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setEditando(Date.now())}
              className="btn-secundario flex-1 sm:flex-none"
            >
              {emInscricoes ? "Editar e inscrever" : "Editar dados"}
            </button>
            {emInscricoes && (
              <button
                type="button"
                onClick={() => setGerando(true)}
                disabled={!previa.valida}
                className="btn-primario flex-1 sm:flex-none"
              >
                <IconeBola className="h-4 w-4" />
                Gerar chave
              </button>
            )}
            {detalhe.podeDesfazerChave && (
              <button
                type="button"
                onClick={() => setDesfazendo(true)}
                className="btn-fantasma flex-1 text-tijolo-700 sm:flex-none"
              >
                Desfazer chave
              </button>
            )}
          </div>
        </div>
        {detalhe.campeao && <BannerDoCampeao campeao={detalhe.campeao} duplas={torneio.duplas} />}
      </Card>

      {emInscricoes && (
        <Card>
          <CardHeader
            titulo="Inscrições abertas"
            descricao="Confira os inscritos e os cabeças de chave. Gerar a chave fecha as inscrições."
            icone={<IconeUsuarios className="h-5 w-5" />}
          />
          <ListaDeInscricoes inscricoes={detalhe.inscricoes} comGrupo={false} />
          <footer
            className={`flex items-start gap-2.5 border-t border-areia-200 px-5 py-3.5 text-sm ${
              previa.valida ? "text-saibro-900" : "text-areia-700"
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
          </footer>
        </Card>
      )}

      {!emInscricoes && torneio.formato === "eliminatoria" && (
        <Card>
          <CardHeader
            titulo="Chave"
            descricao="Clique num jogo para registrar o resultado: o vencedor avança sozinho."
            icone={<IconeTrofeu className="h-5 w-5" />}
          />
          <ChaveEliminatoria rodadas={detalhe.eliminatoria} campeao={detalhe.campeao} aoAbrir={setPartidaAberta} />
        </Card>
      )}

      {!emInscricoes && torneio.formato === "grupos_eliminatoria" && (
        <>
          <div className="grid items-start gap-6 xl:grid-cols-2">
            {detalhe.grupos.map((grupo) => (
              <Card key={grupo.letra}>
                <CardHeader
                  titulo={`Grupo ${grupo.letra}`}
                  descricao={
                    grupo.restantes
                      ? `${grupo.restantes} ${grupo.restantes === 1 ? "jogo" : "jogos"} por registrar · passam ${detalhe.classificadosPorGrupo}`
                      : `Grupo encerrado · passam ${detalhe.classificadosPorGrupo}`
                  }
                  icone={<IconeUsuarios className="h-5 w-5" />}
                />
                <TabelaClassificacao
                  linhas={grupo.classificacao}
                  rotuloDestaque="passa para a eliminatória"
                  definido={grupo.restantes === 0}
                />
                <div className="border-t border-areia-200 p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-areia-600">
                    Jogos do grupo
                  </h3>
                  <GradeDeJogos jogos={grupo.jogos} aoAbrir={setPartidaAberta} />
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              titulo="Fase eliminatória"
              descricao={`Passam ${detalhe.classificadosPorGrupo} de cada grupo (Configurações); quem é do mesmo grupo cai em lados opostos.`}
              icone={<IconeTrofeu className="h-5 w-5" />}
            />
            {detalhe.eliminatoria.length > 0 ? (
              <ChaveEliminatoria
                rodadas={detalhe.eliminatoria}
                campeao={detalhe.campeao}
                aoAbrir={setPartidaAberta}
              />
            ) : (
              <p className="px-5 py-8 text-center text-sm text-areia-600">
                A chave é montada sozinha quando os jogos dos grupos terminarem
                {faltamNosGrupos > 0 && ` (faltam ${faltamNosGrupos})`}.
              </p>
            )}
          </Card>
        </>
      )}

      {!emInscricoes && torneio.formato === "todos_contra_todos" && (
        <>
          <div className="grid items-start gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-2">
              <CardHeader
                titulo="Classificação"
                descricao="Desempate pelos critérios das Configurações."
                icone={<IconeTrofeu className="h-5 w-5" />}
              />
              <TabelaClassificacao
                linhas={detalhe.classificacao}
                rotuloDestaque={torneio.duplas ? "dupla campeã" : "campeão"}
                definido={torneio.situacao === "encerrado"}
              />
            </Card>
            <Card className="hidden md:block xl:col-span-3">
              <CardHeader
                titulo="Confrontos"
                descricao="Resultado de cada linha contra cada coluna. Clique para abrir o jogo."
                icone={<IconeBola className="h-5 w-5" />}
              />
              <MatrizDeConfrontos matriz={detalhe.matriz} aoAbrir={setPartidaAberta} />
            </Card>
          </div>
          <Card>
            <CardHeader
              titulo="Jogos por rodada"
              descricao="Cada inscrição joga uma vez por rodada."
              icone={<IconeBola className="h-5 w-5" />}
            />
            <JogosPorRodada detalhe={detalhe} aoAbrir={setPartidaAberta} />
          </Card>
        </>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {!emInscricoes && (
          <Card>
            <CardHeader
              titulo="Inscrições"
              descricao={`${detalhe.inscricoes.length} ${unidade}${
                detalhe.inscricoes.some((i) => i.inscricao.cabecaDeChave) ? ", com os cabeças de chave" : ""
              }${torneio.formato === "grupos_eliminatoria" ? " e os grupos" : ""}.`}
              icone={<IconeUsuarios className="h-5 w-5" />}
            />
            <ListaDeInscricoes
              inscricoes={detalhe.inscricoes}
              comGrupo={torneio.formato === "grupos_eliminatoria"}
            />
          </Card>
        )}
        <div className={emInscricoes ? "lg:col-span-2" : undefined}>
          <ComentariosDoRegistro
            entidade="torneio"
            entidadeId={torneio.id}
            descricao="Combinados, avisos e observações do torneio."
          />
        </div>
        <HistoricoDoRegistro tabela="torneios" registroId={torneio.id} rotulos={ROTULOS_DO_TORNEIO} />
      </div>

      {editando !== null && (
        <ModalTorneio
          key={editando}
          torneio={torneio}
          inscritos={detalhe.inscricoes.map((i) => i.inscricao)}
          aoFechar={() => setEditando(null)}
        />
      )}

      {caixaAberta && (
        <ModalPartidaDoTorneio
          key={caixaAberta.partida.id}
          torneio={torneio}
          caixa={caixaAberta}
          aoFechar={() => setPartidaAberta(null)}
        />
      )}

      <Confirmacao
        aberto={gerando}
        titulo="Gerar a chave?"
        mensagem={
          <>
            <p>{previa.mensagem}</p>
            <p className="mt-2">
              Os cabeças de chave ficam nas posições deles e os demais são sorteados. Depois disso as
              inscrições fecham; enquanto nenhum resultado for registrado, dá para desfazer a chave.
            </p>
            <p className="mt-2 text-xs text-areia-500">Data do torneio: {formatarData(torneio.data)}.</p>
          </>
        }
        rotuloConfirmar="Gerar chave"
        aoConfirmar={gerar}
        aoCancelar={() => setGerando(false)}
      />

      <Confirmacao
        aberto={desfazendo}
        titulo="Desfazer a chave?"
        mensagem="Os jogos gerados são apagados e o torneio volta para inscrições abertas. Você pode ajustar as inscrições e gerar a chave de novo (com novo sorteio)."
        rotuloConfirmar="Desfazer chave"
        perigoso
        aoConfirmar={desfazer}
        aoCancelar={() => setDesfazendo(false)}
      />
    </div>
  );
}

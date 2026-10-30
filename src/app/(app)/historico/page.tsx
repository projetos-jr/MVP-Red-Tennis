"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconeHistorico } from "@/components/base/Icones";
import { RegistroDoHistorico } from "@/components/base/historico/RegistroDoHistorico";
import { moduloDaRota } from "@/components/layout/abas";
import { CabecalhoDaPagina } from "@/components/ui/CabecalhoDaPagina";
import { Card } from "@/components/ui/Card";
import { EstadoVazio } from "@/components/ui/EstadoVazio";
import { IconeFiltro } from "@/components/ui/Icons";
import { ITENS_POR_PAGINA, MostrarMais } from "@/components/ui/MostrarMais";
import type { RegistroAuditoria, TabelaDoBanco } from "@/lib/banco/tipos";
import { podeAcessar } from "@/lib/consultas/base";
import {
  NOMES_DAS_ACOES,
  NOMES_DAS_TABELAS,
  filtrarHistorico,
  pessoasDoHistorico,
  tabelasDoHistorico,
  telaDoRegistro,
  type FiltroDoHistorico,
} from "@/lib/consultas/configuracoes";
import { useApp } from "@/store/AppStore";

const POR_PAGINA = ITENS_POR_PAGINA;

type Filtro = Required<FiltroDoHistorico>;

const SEM_FILTRO: Filtro = {
  usuarioId: "",
  tabela: "",
  acao: "",
  de: "",
  ate: "",
};

/**
 * Historico de alteracoes (so o dono): tudo o que foi criado, alterado ou
 * apagado, lido da auditoria automatica. Ninguem edita nem apaga.
 */
export default function PaginaHistorico() {
  const { banco, colaborador } = useApp();
  const [filtro, setFiltro] = useState(SEM_FILTRO);
  const [limite, setLimite] = useState(POR_PAGINA);

  const registros = useMemo(() => filtrarHistorico(banco, filtro), [banco, filtro]);
  const pessoas = useMemo(() => pessoasDoHistorico(banco), [banco]);
  const tabelas = useMemo(() => tabelasDoHistorico(banco), [banco]);
  const filtrando = Object.values(filtro).some(Boolean);
  const visiveis = registros.slice(0, limite);

  function mudar<Chave extends keyof Filtro>(campo: Chave, valor: Filtro[Chave]) {
    setFiltro((atual) => ({ ...atual, [campo]: valor }));
    setLimite(POR_PAGINA);
  }

  /** Link "Abrir" so para telas que o perfil pode abrir. */
  function telaPermitida(registro: RegistroAuditoria): string | undefined {
    const tela = telaDoRegistro(banco, registro);
    const modulo = tela ? moduloDaRota(tela.split(/[?#]/)[0]) : undefined;
    return tela && (!modulo || podeAcessar(banco, colaborador, modulo)) ? tela : undefined;
  }

  return (
    <div className="space-y-6">
      <CabecalhoDaPagina
        className="max-w-3xl"
        titulo="Histórico de alterações"
        descricao={
          <p className="leading-relaxed">
            Tudo o que foi criado, alterado ou apagado, com quem fez, quando e como era antes. O
            registro é automático: ninguém edita nem apaga.
          </p>
        }
      />

      {banco.auditoria.length === 0 ? (
        <HistoricoVazio podeAbrirConfiguracoes={podeAcessar(banco, colaborador, "configuracoes")} />
      ) : (
        <>
          <Card>
            <div className="flex items-center gap-2 border-b border-areia-200 px-5 py-3">
              <IconeFiltro className="h-4 w-4 text-areia-500" />
              <h2 className="text-sm font-semibold text-areia-900">Filtrar</h2>
              {filtrando && (
                <button
                  type="button"
                  onClick={() => {
                    setFiltro(SEM_FILTRO);
                    setLimite(POR_PAGINA);
                  }}
                  className="ml-auto text-xs font-semibold text-tijolo-700 hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-areia-800">Pessoa</span>
                <select
                  className="campo"
                  value={filtro.usuarioId}
                  onChange={(e) => mudar("usuarioId", e.target.value)}
                >
                  <option value="">Todas as pessoas</option>
                  {pessoas.map((pessoa) => (
                    <option key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-areia-800">Tipo de registro</span>
                <select
                  className="campo"
                  value={filtro.tabela}
                  onChange={(e) => mudar("tabela", e.target.value as TabelaDoBanco | "")}
                >
                  <option value="">Todos os tipos</option>
                  {tabelas.map((tabela) => (
                    <option key={tabela} value={tabela}>
                      {NOMES_DAS_TABELAS[tabela]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-areia-800">Ação</span>
                <select
                  className="campo"
                  value={filtro.acao}
                  onChange={(e) => mudar("acao", e.target.value as RegistroAuditoria["acao"] | "")}
                >
                  <option value="">Todas as ações</option>
                  {(Object.keys(NOMES_DAS_ACOES) as Array<RegistroAuditoria["acao"]>).map((acao) => (
                    <option key={acao} value={acao}>
                      {NOMES_DAS_ACOES[acao]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-areia-800">De</span>
                <input
                  type="date"
                  className="campo"
                  value={filtro.de}
                  max={filtro.ate || undefined}
                  onChange={(e) => mudar("de", e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-areia-800">Até</span>
                <input
                  type="date"
                  className="campo"
                  value={filtro.ate}
                  min={filtro.de || undefined}
                  onChange={(e) => mudar("ate", e.target.value)}
                />
              </label>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-areia-200 px-5 py-3">
              <h2 className="text-sm font-semibold text-areia-900" aria-live="polite">
                {registros.length === 1 ? "1 alteração" : `${registros.length} alterações`}
                {filtrando && " com estes filtros"}
              </h2>
              <p className="text-xs text-areia-500">Da mais recente para a mais antiga</p>
            </div>
            {registros.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-areia-600">
                <p>Nenhuma alteração com estes filtros.</p>
                <button
                  type="button"
                  onClick={() => setFiltro(SEM_FILTRO)}
                  className="btn-secundario mt-4"
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-areia-100">
                {visiveis.map((registro) => (
                  <RegistroDoHistorico
                    key={registro.id}
                    banco={banco}
                    registro={registro}
                    tela={telaPermitida(registro)}
                  />
                ))}
              </ul>
            )}
            <MostrarMais
              mostrando={visiveis.length}
              total={registros.length}
              aoMostrarMais={() => setLimite((atual) => atual + POR_PAGINA)}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function HistoricoVazio({ podeAbrirConfiguracoes }: { podeAbrirConfiguracoes: boolean }) {
  return (
    <EstadoVazio
      icone={<IconeHistorico className="h-6 w-6" />}
      titulo="Nenhuma alteração nesta sessão ainda"
      acoes={
        <>
          {podeAbrirConfiguracoes && (
            <Link href="/configuracoes" className="btn-primario">
              Abrir Configurações
            </Link>
          )}
          <Link href="/dashboard" className="btn-secundario">
            Voltar ao painel
          </Link>
        </>
      }
    >
      Nesta demonstração os dados de exemplo são carregados de novo a cada visita, então o
      histórico começa vazio. Assim que alguém criar, alterar ou apagar algo (um comentário na
      ficha de um aluno, uma aula cancelada, um prazo nas Configurações), aparece aqui quem fez,
      quando e o que mudou. Com o banco de dados de verdade, o histórico fica guardado para sempre.
    </EstadoVazio>
  );
}

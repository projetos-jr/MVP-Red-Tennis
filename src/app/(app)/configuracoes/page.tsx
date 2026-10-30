"use client";

import Link from "next/link";
import { IconeInfo } from "@/components/base/Icones";
import { SecaoFinanceiro } from "@/components/base/configuracoes/SecaoFinanceiro";
import { SecaoPermissoes } from "@/components/base/configuracoes/SecaoPermissoes";
import { SecaoPlanos } from "@/components/base/configuracoes/SecaoPlanos";
import { SecaoRanking } from "@/components/base/configuracoes/SecaoRanking";
import { SecaoRepasse } from "@/components/base/configuracoes/SecaoRepasse";
import { SecaoReposicao } from "@/components/base/configuracoes/SecaoReposicao";
import { SecaoReservasEAgenda } from "@/components/base/configuracoes/SecaoReservasEAgenda";
import { CabecalhoDaPagina } from "@/components/ui/CabecalhoDaPagina";
import { podeAcessar } from "@/lib/consultas/base";
import { useApp } from "@/store/AppStore";

const SECOES = [
  { id: "reposicao", rotulo: "Reposição" },
  { id: "reservas", rotulo: "Reservas e agenda" },
  { id: "ranking", rotulo: "Ranking e torneios" },
  { id: "financeiro", rotulo: "Financeiro e balcão" },
  { id: "planos", rotulo: "Planos" },
  { id: "permissoes", rotulo: "Permissões" },
  { id: "repasse", rotulo: "Repasse" },
];

/**
 * Configuracoes (so o dono): as regras que a arena ainda nao confirmou
 * (hipoteses da secao 4 do documento de modelo), o catalogo de planos e as
 * permissoes de cada perfil. Cada secao salva sozinha e cada mudanca vai
 * para o Historico de alteracoes.
 */
export default function PaginaConfiguracoes() {
  const { banco, colaborador } = useApp();
  const podeVerHistorico = podeAcessar(banco, colaborador, "historico");

  return (
    <div className="space-y-6">
      <CabecalhoDaPagina
        className="max-w-3xl"
        titulo="Configurações"
        descricao={
          <p className="leading-relaxed">
            Regras que a arena ainda está confirmando, catálogo de planos e quem vê cada área. Os selos{" "}
            <span className="font-semibold text-saibro-800">H1 a H13</span> indicam a hipótese usada até
            a arena responder: quando a resposta chegar, basta trocar o valor aqui, sem programar.
          </p>
        }
      />

      <p className="flex items-start gap-2.5 rounded-2xl border border-saibro-200 bg-saibro-50/70 px-4 py-3 text-sm text-saibro-900">
        <IconeInfo className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Só o dono altera as configurações. Cada seção tem o próprio botão de salvar, e toda
          mudança fica registrada
          {podeVerHistorico ? (
            <>
              {" "}no{" "}
              <Link href="/historico" className="font-semibold underline-offset-2 hover:underline">
                Histórico de alterações
              </Link>
            </>
          ) : (
            " no histórico de alterações"
          )}
          .
        </span>
      </p>

      <div className="lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:items-start lg:gap-6">
        <nav aria-label="Partes das configurações" className="mb-6 lg:sticky lg:top-32 lg:mb-0">
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 rolagem-suave lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
            {SECOES.map((secao) => (
              <li key={secao.id} className="shrink-0">
                <a
                  href={`#${secao.id}`}
                  className="alvo-de-toque flex items-center whitespace-nowrap rounded-full border border-areia-200 bg-white px-3.5 py-1.5 text-sm font-medium text-areia-700 hover:border-saibro-300 hover:text-saibro-800 lg:rounded-xl lg:border-transparent lg:bg-transparent lg:px-3 lg:py-2 lg:hover:bg-white"
                >
                  {secao.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <SecaoReposicao />
          <SecaoReservasEAgenda />
          <SecaoRanking />
          <SecaoFinanceiro />
          <SecaoPlanos />
          <SecaoPermissoes />
          <SecaoRepasse />
        </div>
      </div>
    </div>
  );
}

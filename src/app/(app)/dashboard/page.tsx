"use client";

import { useMemo } from "react";
import { useHoraAtual } from "@/components/base/useHoraAtual";
import { AtencaoDoInicio } from "@/components/inicio/AtencaoDoInicio";
import { FaixaDasQuadras } from "@/components/inicio/FaixaDasQuadras";
import { MosaicoDeAtalhos } from "@/components/inicio/MosaicoDeAtalhos";
import { atalhosPermitidos } from "@/components/layout/atalhos";
import { HOJE } from "@/lib/banco/constantes";
import { podeAcessar } from "@/lib/consultas/base";
import { ocupacaoDasQuadras, precisaDeAtencao, saudacao } from "@/lib/consultas/painel";
import { DIAS_SEMANA_LONGO, diaDaSemana, formatarDataExtenso } from "@/lib/date";
import { useApp } from "@/store/AppStore";

/**
 * Início (rota /dashboard), no molde da tela que o cliente usa no sistema
 * antigo: só as entradas, de cima para baixo:
 *  1. a faixa das quadras: quem esta jogando agora em cada quadra;
 *  2. o mosaico de atalhos laranja (so as telas que o perfil abre);
 *  3. a placa de atenção, so quando ha pendencia; ela abre a janela
 *     "Precisa de atenção" com as listas.
 * Os dados vem de `lib/consultas/painel.ts` e `components/layout/atalhos.ts`.
 */
export default function PaginaInicio() {
  const { banco, colaborador } = useApp();
  const agora = useHoraAtual();

  const quadras = useMemo(() => ocupacaoDasQuadras(banco, HOJE, agora), [banco, agora]);
  const atalhos = useMemo(() => atalhosPermitidos(banco, colaborador), [banco, colaborador]);
  const atencao = useMemo(
    () => precisaDeAtencao(banco, colaborador, HOJE, agora),
    [banco, colaborador, agora],
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Saudacao discreta: o que importa sao as quadras e os botoes. */}
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <h1 className="font-display text-xl font-semibold leading-tight text-areia-800 sm:text-2xl">
          {saudacao(agora)}, {colaborador.nome.split(" ")[0]}
        </h1>
        <p className="text-base text-areia-600">
          {DIAS_SEMANA_LONGO[diaDaSemana(HOJE)]}, {formatarDataExtenso(HOJE)}
        </p>
      </header>

      <FaixaDasQuadras
        quadras={quadras}
        agora={agora}
        podeAbrirAgenda={podeAcessar(banco, colaborador, "agenda")}
      />

      <MosaicoDeAtalhos atalhos={atalhos} />

      <AtencaoDoInicio
        atencao={atencao}
        configuracoes={banco.configuracoes}
        podeRegistrarPagamento={podeAcessar(banco, colaborador, "financeiro")}
      />
    </div>
  );
}

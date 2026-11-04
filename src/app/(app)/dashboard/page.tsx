"use client";

import { useMemo } from "react";
import { useHoraAtual } from "@/components/base/useHoraAtual";
import { PrecisaDeAtencao } from "@/components/dashboard/PrecisaDeAtencao";
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
 * antigo, de cima para baixo:
 *  1. a faixa das quadras: quem esta jogando agora em cada quadra;
 *  2. o mosaico de atalhos laranja (so as telas que o perfil abre);
 *  3. o quadro "Precisa de atenção".
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
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <h1 className="font-display text-2xl font-bold leading-tight text-areia-900 sm:text-[1.75rem]">
          {saudacao(agora)}, {colaborador.nome.split(" ")[0]}
        </h1>
        <p className="text-sm text-areia-600">
          {DIAS_SEMANA_LONGO[diaDaSemana(HOJE)]}, {formatarDataExtenso(HOJE)}
        </p>
      </header>

      <FaixaDasQuadras
        quadras={quadras}
        agora={agora}
        podeAbrirAgenda={podeAcessar(banco, colaborador, "agenda")}
      />

      <MosaicoDeAtalhos atalhos={atalhos} />

      <div id="precisa-de-atencao" className="scroll-mt-32">
        <PrecisaDeAtencao
          atencao={atencao}
          configuracoes={banco.configuracoes}
          podeRegistrarPagamento={podeAcessar(banco, colaborador, "financeiro")}
        />
      </div>
    </div>
  );
}

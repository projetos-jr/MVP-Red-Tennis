"use client";

import type { ReactNode } from "react";
import {
  IconeAlerta,
  IconeCheck,
  IconeFinanceiro,
  IconeRelogio,
  IconeSeta,
} from "@/components/ui/Icons";
import {
  fimDoMes,
  type ChaveIndicador,
  type IndicadoresDoMes as Indicadores,
} from "@/lib/consultas/financeiro";
import { MESES, formatarDiaMes } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";

/**
 * Mesmos tons do StatCard: o icone em cor cheia (vivo) e o cartao claro, para
 * o numero ser lido rapido.
 */
const TONS = {
  neutro: {
    caixa: "border-areia-200 bg-white hover:border-areia-300",
    icone: "bg-areia-100 text-areia-600",
    valor: "text-areia-900",
  },
  saibro: {
    caixa: "border-saibro-200 bg-white hover:border-saibro-300",
    icone: "bg-saibro-600 text-white",
    valor: "text-saibro-700",
  },
  alerta: {
    caixa: "border-tijolo-200 bg-tijolo-50 hover:border-tijolo-300",
    icone: "bg-tijolo-600 text-white",
    valor: "text-tijolo-700",
  },
  positivo: {
    caixa: "border-quadra-200 bg-quadra-50 hover:border-quadra-300",
    icone: "bg-quadra-700 text-white",
    valor: "text-quadra-700",
  },
} as const;

function plural(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

function Cartao({
  rotulo,
  rotuloCurto,
  valor,
  detalhe,
  icone,
  tom,
  ativo,
  aoClicar,
}: {
  rotulo: string;
  rotuloCurto: string;
  valor: number;
  detalhe: string;
  icone: ReactNode;
  tom: keyof typeof TONS;
  ativo: boolean;
  aoClicar: () => void;
}) {
  const estilo = TONS[tom];
  // Grande por padrão (pedido do dono da arena): rótulo em letra normal, o
  // valor em letra de placar e o detalhe em text-sm.
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      className={`group flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left shadow-card transition-all hover:shadow-card-hover sm:gap-4 sm:p-5 ${estilo.caixa} ${
        ativo ? "ring-2 ring-saibro-500/60 ring-offset-2 ring-offset-areia-100" : ""
      }`}
    >
      <span
        className={`hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl xl:flex ${estilo.icone}`}
      >
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-areia-700 sm:text-base">
            <span className="sm:hidden">{rotuloCurto}</span>
            <span className="hidden sm:inline">{rotulo}</span>
          </span>
          <IconeSeta
            className="mt-0.5 h-4 w-4 shrink-0 text-areia-500 transition-transform motion-safe:group-hover:translate-x-0.5 group-hover:text-areia-700"
          />
        </span>
        {/* sm:leading-none: a variante sm:text-3xl traz o line-height dela. */}
        <span
          className={`mt-1.5 block font-display text-2xl font-bold leading-none tabular-nums sm:text-3xl sm:leading-none 2xl:text-4xl 2xl:leading-none ${estilo.valor}`}
        >
          {formatarMoeda(valor)}
        </span>
        <span className="mt-2 block text-sm leading-snug text-areia-600">
          {detalhe}
          {ativo && <span className="sr-only"> (filtro aplicado na lista)</span>}
        </span>
      </span>
    </button>
  );
}

/**
 * Indicadores do mês. Cada cartão é um atalho: clicar aplica na lista
 * exatamente o filtro que gerou o número, então cartão e lista sempre batem.
 */
export function IndicadoresDoMes({
  indicadores,
  mes,
  mostrarAPagar,
  ativo,
  aoEscolher,
}: {
  indicadores: Indicadores;
  mes: string;
  mostrarAPagar: boolean;
  ativo?: ChaveIndicador;
  aoEscolher: (chave: ChaveIndicador) => void;
}) {
  const nomeDoMes = MESES[Number(mes.slice(5, 7)) - 1];
  const { recebido, aReceber, emAtraso, aPagar } = indicadores;

  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:gap-4 ${mostrarAPagar ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
    >
      <Cartao
        rotulo={`Recebido em ${nomeDoMes}`}
        rotuloCurto="Recebido"
        valor={recebido.valor}
        detalhe={plural(recebido.quantidade, "pagamento", "pagamentos")}
        icone={<IconeCheck className="h-6 w-6" />}
        tom="positivo"
        ativo={ativo === "recebido"}
        aoClicar={() => aoEscolher("recebido")}
      />
      <Cartao
        rotulo={`A receber em ${nomeDoMes}`}
        rotuloCurto="A receber"
        valor={aReceber.valor}
        detalhe={`${plural(aReceber.quantidade, "lançamento", "lançamentos")} no prazo`}
        icone={<IconeRelogio className="h-6 w-6" />}
        tom="saibro"
        ativo={ativo === "aReceber"}
        aoClicar={() => aoEscolher("aReceber")}
      />
      <Cartao
        rotulo="Em atraso"
        rotuloCurto="Em atraso"
        valor={emAtraso.valor}
        detalhe={`${plural(emAtraso.quantidade, "lançamento vencido", "lançamentos vencidos")}, de qualquer mês`}
        icone={<IconeAlerta className="h-6 w-6" />}
        tom={emAtraso.quantidade > 0 ? "alerta" : "neutro"}
        ativo={ativo === "emAtraso"}
        aoClicar={() => aoEscolher("emAtraso")}
      />
      {mostrarAPagar && (
        <Cartao
          rotulo={`A pagar até ${formatarDiaMes(fimDoMes(mes))}`}
          rotuloCurto="A pagar"
          valor={aPagar.valor}
          detalhe={`${plural(aPagar.quantidade, "conta", "contas")}${
            aPagar.vencidas > 0 ? ` · ${plural(aPagar.vencidas, "vencida", "vencidas")}` : ""
          }`}
          icone={<IconeFinanceiro className="h-6 w-6" />}
          tom="neutro"
          ativo={ativo === "aPagar"}
          aoClicar={() => aoEscolher("aPagar")}
        />
      )}
    </div>
  );
}

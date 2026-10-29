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

/** Mesmos tons do StatCard, para manter a identidade dos indicadores do MVP. */
const TONS = {
  neutro: {
    caixa: "border-areia-200 bg-white hover:border-areia-300",
    icone: "bg-areia-100 text-areia-600",
    valor: "text-areia-900",
  },
  saibro: {
    caixa: "border-saibro-200 bg-saibro-50/60 hover:border-saibro-300",
    icone: "bg-saibro-100 text-saibro-700",
    valor: "text-saibro-800",
  },
  alerta: {
    caixa: "border-tijolo-200 bg-tijolo-50/70 hover:border-tijolo-300",
    icone: "bg-tijolo-100 text-tijolo-700",
    valor: "text-tijolo-700",
  },
  positivo: {
    caixa: "border-emerald-200 bg-emerald-50/60 hover:border-emerald-300",
    icone: "bg-emerald-100 text-emerald-700",
    valor: "text-emerald-700",
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
  return (
    <button
      type="button"
      onClick={aoClicar}
      className={`group flex w-full items-start gap-2.5 rounded-2xl border p-3 text-left shadow-card transition-all hover:shadow-card-hover sm:gap-3 sm:p-4 ${estilo.caixa} ${
        ativo ? "ring-2 ring-saibro-500/60 ring-offset-2 ring-offset-areia-100" : ""
      }`}
    >
      <span
        className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex ${estilo.icone}`}
      >
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-areia-500">
            <span className="sm:hidden">{rotuloCurto}</span>
            <span className="hidden sm:inline">{rotulo}</span>
          </span>
          <IconeSeta
            className="mt-px h-3.5 w-3.5 shrink-0 text-areia-400 transition-transform group-hover:translate-x-0.5 group-hover:text-areia-700"
          />
        </span>
        {/* sm:leading-none: a variante sm:text-2xl traz o line-height dela. */}
        <span
          className={`mt-1 block text-xl font-semibold leading-none sm:text-2xl sm:leading-none ${estilo.valor}`}
        >
          {formatarMoeda(valor)}
        </span>
        <span className="mt-1.5 block text-xs leading-snug text-areia-600">
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
      className={`grid grid-cols-2 gap-3 sm:gap-4 ${mostrarAPagar ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
    >
      <Cartao
        rotulo={`Recebido em ${nomeDoMes}`}
        rotuloCurto="Recebido"
        valor={recebido.valor}
        detalhe={plural(recebido.quantidade, "pagamento", "pagamentos")}
        icone={<IconeCheck className="h-5 w-5" />}
        tom="positivo"
        ativo={ativo === "recebido"}
        aoClicar={() => aoEscolher("recebido")}
      />
      <Cartao
        rotulo={`A receber em ${nomeDoMes}`}
        rotuloCurto="A receber"
        valor={aReceber.valor}
        detalhe={`${plural(aReceber.quantidade, "lançamento", "lançamentos")} no prazo`}
        icone={<IconeRelogio className="h-5 w-5" />}
        tom="saibro"
        ativo={ativo === "aReceber"}
        aoClicar={() => aoEscolher("aReceber")}
      />
      <Cartao
        rotulo="Em atraso"
        rotuloCurto="Em atraso"
        valor={emAtraso.valor}
        detalhe={`${plural(emAtraso.quantidade, "lançamento vencido", "lançamentos vencidos")}, de qualquer mês`}
        icone={<IconeAlerta className="h-5 w-5" />}
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
          icone={<IconeFinanceiro className="h-5 w-5" />}
          tom="neutro"
          ativo={ativo === "aPagar"}
          aoClicar={() => aoEscolher("aPagar")}
        />
      )}
    </div>
  );
}

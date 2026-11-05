import type { ReactNode } from "react";
import { IconeCopo, IconeEstoque, IconeRelogio } from "@/components/ui/Icons";
import type { ResumoEstoque } from "@/lib/consultas/estoque";
import { formatarMoeda } from "@/lib/theme";

/**
 * Os números do estoque, três e grandes: vendas do mês, o que ainda está em
 * aberto nas contas e quanto vale o que está na prateleira (com as unidades).
 * O que precisa repor fica na lista de compras, logo abaixo.
 */
const TONS = {
  alerta: {
    caixa: "border-tijolo-200 bg-tijolo-50",
    icone: "bg-tijolo-600 text-white",
    valor: "text-tijolo-700",
  },
  positivo: {
    caixa: "border-quadra-200 bg-quadra-50",
    icone: "bg-quadra-700 text-white",
    valor: "text-quadra-700",
  },
  saibro: {
    caixa: "border-saibro-200 bg-white",
    icone: "bg-saibro-600 text-white",
    valor: "text-saibro-700",
  },
  neutro: {
    caixa: "border-areia-200 bg-white",
    icone: "bg-areia-100 text-areia-700",
    valor: "text-areia-900",
  },
} as const;

/** Cartão de um número grande (rótulo, valor de placar e uma linha de apoio). */
export function NumeroGrande({
  rotulo,
  valor,
  detalhe,
  icone,
  tom,
  className = "",
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  icone: ReactNode;
  tom: keyof typeof TONS;
  className?: string;
}) {
  const estilo = TONS[tom];
  return (
    <div
      className={`flex items-start gap-4 rounded-2xl border p-3.5 shadow-card sm:p-5 ${estilo.caixa} ${className}`}
    >
      <span
        className={`hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl lg:flex ${estilo.icone}`}
      >
        {icone}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-areia-700 sm:text-base">{rotulo}</p>
        <p
          className={`mt-1.5 font-display text-2xl font-bold leading-none tabular-nums sm:text-3xl sm:leading-none 2xl:text-4xl 2xl:leading-none ${estilo.valor}`}
        >
          {valor}
        </p>
        <p className="mt-2 text-sm leading-snug text-areia-600">{detalhe}</p>
      </div>
    </div>
  );
}

export function NumerosDoEstoque({ resumo }: { resumo: ResumoEstoque }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      <NumeroGrande
        rotulo="Vendas no mês"
        valor={formatarMoeda(resumo.vendasNoMes)}
        detalhe="Consumo lançado no balcão"
        icone={<IconeCopo className="h-6 w-6" />}
        tom="positivo"
      />
      <NumeroGrande
        rotulo="Em aberto nas contas"
        valor={formatarMoeda(resumo.consumoEmAberto)}
        detalhe="Consumo ainda não pago"
        icone={<IconeRelogio className="h-6 w-6" />}
        tom="saibro"
      />
      <NumeroGrande
        rotulo="Valor do estoque"
        valor={formatarMoeda(resumo.valorDeVenda)}
        detalhe={`${resumo.unidades} unidades em ${resumo.produtosAtivos} itens · custo ${formatarMoeda(
          resumo.valorDeCusto,
        )}`}
        icone={<IconeEstoque className="h-6 w-6" />}
        tom="neutro"
        className="col-span-2 sm:col-span-1"
      />
    </div>
  );
}

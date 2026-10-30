import type { ComponentType, SVGProps } from "react";
import { EtiquetaDeSituacao, type Tom } from "@/components/ui/EtiquetaDeSituacao";
import { IconeAlerta, IconeCheck, IconeRelogio } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import type { LinhaLancamento, SituacaoRepasse } from "@/lib/consultas/financeiro";
import { formatarDiaMes } from "@/lib/date";

/**
 * Etiquetas do financeiro. A cor e o ícone de cada situação vêm de
 * `components/ui/EtiquetaDeSituacao` (os mesmos em todos os módulos); aqui
 * fica só o texto. A situação nunca depende só da cor.
 */

/** Texto da situação: "Pago em 12/10", "Vence hoje", "5 dias em atraso"... */
export function textoDaSituacao(linha: LinhaLancamento): string {
  const { lancamento, situacao, diasEmAtraso } = linha;
  switch (situacao) {
    case "pago":
      return `Pago em ${formatarDiaMes(lancamento.pagoEm ?? lancamento.vencimento)}`;
    case "pendente":
      return lancamento.vencimento === HOJE ? "Vence hoje" : "Pendente";
    case "em_atraso":
      return `${diasEmAtraso} ${diasEmAtraso === 1 ? "dia" : "dias"} em atraso`;
    case "cancelado":
      return "Anulado";
  }
}

export function BadgeSituacao({ linha }: { linha: LinhaLancamento }) {
  return (
    <EtiquetaDeSituacao situacao={linha.situacao} className="whitespace-nowrap">
      {textoDaSituacao(linha)}
    </EtiquetaDeSituacao>
  );
}

/** H4: a mensalidade é cobrada mesmo com o plano congelado; a etiqueta avisa. */
export function BadgeCongelado() {
  return (
    <EtiquetaDeSituacao
      situacao="congelado"
      className="whitespace-nowrap"
      title="Plano congelado no vencimento: a mensalidade foi gerada normalmente (hipótese H4)."
    >
      Plano congelado
    </EtiquetaDeSituacao>
  );
}

export const ESTILO_SITUACAO_REPASSE: Record<
  SituacaoRepasse,
  { rotulo: string; tom: Tom; icone: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  em_andamento: { rotulo: "Mês em andamento", tom: "neutro", icone: IconeRelogio },
  a_fechar: { rotulo: "A fechar", tom: "atencao", icone: IconeAlerta },
  a_pagar: { rotulo: "Fechado · a pagar", tom: "destaque", icone: IconeRelogio },
  pago: { rotulo: "Fechado · pago", tom: "positivo", icone: IconeCheck },
  sem_aulas: { rotulo: "Sem aulas", tom: "neutro", icone: IconeRelogio },
};

export function BadgeRepasse({ situacao }: { situacao: SituacaoRepasse }) {
  const estilo = ESTILO_SITUACAO_REPASSE[situacao];
  return (
    <EtiquetaDeSituacao tom={estilo.tom} icone={estilo.icone} className="whitespace-nowrap">
      {estilo.rotulo}
    </EtiquetaDeSituacao>
  );
}

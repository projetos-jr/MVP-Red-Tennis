import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { IconeAlerta, IconeCheck, IconeCongelado, IconeFechar, IconeRelogio } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import type { LinhaLancamento, SituacaoLancamento, SituacaoRepasse } from "@/lib/consultas/financeiro";
import { formatarDiaMes } from "@/lib/date";

/**
 * Etiquetas do financeiro. A cor ajuda, mas cada etiqueta tem texto e ícone:
 * a situação nunca depende só da cor.
 */

export const ESTILO_SITUACAO: Record<
  SituacaoLancamento,
  { rotulo: string; cor: string; fundo: string; borda: string }
> = {
  pago: { rotulo: "Pago", cor: "#15803D", fundo: "#F0FDF4", borda: "#BBE5C8" },
  pendente: { rotulo: "Pendente", cor: "#A16207", fundo: "#FEFBEB", borda: "#F5D97A" },
  em_atraso: { rotulo: "Em atraso", cor: "#8A2118", fundo: "#FBE3E0", borda: "#EC9A90" },
  cancelado: { rotulo: "Anulado", cor: "#4F483E", fundo: "#F4F1EC", borda: "#D6CEC2" },
};

const ICONE_SITUACAO = {
  pago: IconeCheck,
  pendente: IconeRelogio,
  em_atraso: IconeAlerta,
  cancelado: IconeFechar,
};

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
  const estilo = ESTILO_SITUACAO[linha.situacao];
  const Icone = ICONE_SITUACAO[linha.situacao];
  return (
    <Badge cor={estilo.cor} fundo={estilo.fundo} borda={estilo.borda} className="whitespace-nowrap">
      <Icone className="h-3.5 w-3.5" />
      {textoDaSituacao(linha)}
    </Badge>
  );
}

/** H4: a mensalidade é cobrada mesmo com o plano congelado; a etiqueta avisa. */
export function BadgeCongelado() {
  return (
    <Badge
      cor="#1E3A8A"
      fundo="#EFF4FF"
      borda="#A9BEF0"
      className="whitespace-nowrap"
      title="Plano congelado no vencimento: a mensalidade foi gerada normalmente (hipótese H4)."
    >
      <IconeCongelado className="h-3.5 w-3.5" />
      Plano congelado
    </Badge>
  );
}

/** Categoria e forma de pagamento: neutras, o texto identifica. */
export function ChipNeutro({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center whitespace-nowrap rounded-md border border-areia-200 bg-areia-50 px-1.5 py-0.5 text-[11px] font-medium text-areia-700"
    >
      {children}
    </span>
  );
}

export const ESTILO_SITUACAO_REPASSE: Record<
  SituacaoRepasse,
  { rotulo: string; cor: string; fundo: string; borda: string }
> = {
  em_andamento: { rotulo: "Mês em andamento", cor: "#4F483E", fundo: "#F4F1EC", borda: "#D6CEC2" },
  a_fechar: { rotulo: "A fechar", cor: "#A16207", fundo: "#FEFBEB", borda: "#F5D97A" },
  a_pagar: { rotulo: "Fechado · a pagar", cor: "#9A4720", fundo: "#FAE8DA", borda: "#F3CEAF" },
  pago: { rotulo: "Fechado · pago", cor: "#15803D", fundo: "#F0FDF4", borda: "#BBE5C8" },
  sem_aulas: { rotulo: "Sem aulas", cor: "#6B6255", fundo: "#FAF9F7", borda: "#E8E3DB" },
};

export function BadgeRepasse({ situacao }: { situacao: SituacaoRepasse }) {
  const estilo = ESTILO_SITUACAO_REPASSE[situacao];
  const Icone =
    situacao === "pago" ? IconeCheck : situacao === "a_fechar" ? IconeAlerta : IconeRelogio;
  return (
    <Badge cor={estilo.cor} fundo={estilo.fundo} borda={estilo.borda} className="whitespace-nowrap">
      <Icone className="h-3.5 w-3.5" />
      {estilo.rotulo}
    </Badge>
  );
}

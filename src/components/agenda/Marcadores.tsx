import { IconeAlerta, IconeCheck, IconeRelogio } from "@/components/ui/Icons";
import type { ItemAgenda } from "@/lib/consultas/agenda";
import { estiloDaSigla } from "@/lib/theme";
import { IconeReposicao } from "./Icones";

/**
 * Marcas de um horario: pagamento da reserva (aguardando, prazo vencido,
 * pago), reposicao e cancelamento (com a sigla). Cada marca tem icone e
 * texto (visivel ou para leitor de tela): a cor nunca e o unico sinal.
 */

/** Sigla curta do cancelamento ("CH", "IAC"...) ou "Cancelada" para motivos em texto. */
export function siglaDoCancelamento(motivo: string | undefined): string {
  if (!motivo) return "Cancelada";
  return motivo.length <= 6 ? motivo : "Cancelada";
}

const PAGAMENTO = {
  aguardando: {
    rotulo: "Aguardando pagamento",
    curto: "Aguardando",
    Icone: IconeRelogio,
    classe: "border-amber-300 bg-amber-50 text-amber-800",
  },
  vencida: {
    rotulo: "Prazo de pagamento vencido",
    curto: "Prazo vencido",
    Icone: IconeAlerta,
    classe: "border-tijolo-300 bg-tijolo-600 text-white",
  },
  paga: {
    rotulo: "Reserva paga",
    curto: "Pago",
    Icone: IconeCheck,
    classe: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
} as const;

/** Versao so com icones, para os chips pequenos da grade (o texto fica no title e para leitor de tela). */
export function MarcadoresMini({ item }: { item: ItemAgenda }) {
  const pagamento = item.estadoReserva ? PAGAMENTO[item.estadoReserva] : undefined;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5">
      {item.reposicao && !item.cancelada && (
        <span
          className="flex h-4 w-4 items-center justify-center rounded bg-violet-100 text-violet-800"
          title="Reposição"
        >
          <IconeReposicao className="h-3 w-3" />
          <span className="sr-only">Reposição</span>
        </span>
      )}
      {pagamento && (
        <span
          className={`flex h-4 w-4 items-center justify-center rounded border ${pagamento.classe}`}
          title={pagamento.rotulo}
        >
          <pagamento.Icone className="h-3 w-3" />
          <span className="sr-only">{pagamento.rotulo}</span>
        </span>
      )}
      {item.cancelada && <SiglaCancelada motivo={item.ocupacao.motivoCancelamento} />}
    </span>
  );
}

/** Versao com icone e texto, para cartoes, painel e modo quadra. */
export function Marcadores({ item, className = "" }: { item: ItemAgenda; className?: string }) {
  const pagamento = item.estadoReserva ? PAGAMENTO[item.estadoReserva] : undefined;
  if (!pagamento && !item.reposicao && !item.cancelada) return null;
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`}>
      {item.cancelada && (
        <span className="inline-flex items-center gap-1 rounded-md bg-areia-200 px-1.5 py-0.5 text-[11px] font-semibold text-areia-800">
          Cancelada
          <SiglaCancelada motivo={item.ocupacao.motivoCancelamento} />
        </span>
      )}
      {item.reposicao && !item.cancelada && (
        <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-800">
          <IconeReposicao className="h-3 w-3" />
          Reposição
        </span>
      )}
      {pagamento && (
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${pagamento.classe}`}
        >
          <pagamento.Icone className="h-3 w-3" />
          {pagamento.curto}
        </span>
      )}
    </span>
  );
}

export function SiglaCancelada({ motivo }: { motivo?: string }) {
  const sigla = siglaDoCancelamento(motivo);
  const estilo = estiloDaSigla(sigla);
  return (
    <span
      className="rounded px-1 text-[10px] font-bold leading-4"
      style={{
        color: estilo.cor,
        backgroundColor: estilo.fundo,
        boxShadow: `inset 0 0 0 1px ${estilo.cor}40`,
      }}
      title={motivo ? `Cancelada: ${motivo}` : "Cancelada"}
    >
      {sigla}
    </span>
  );
}

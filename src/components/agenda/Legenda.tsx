import { IconeAlerta, IconeCheck, IconeRelogio } from "@/components/ui/Icons";
import { BRANCO, PALETA } from "@/lib/paleta";
import { ESTILO_OCUPACAO } from "@/lib/theme";
import { FUNDO_BLOQUEIO, ORDEM_TIPOS_AGENDA } from "./estilos";
import { IconeReposicao } from "./Icones";

/**
 * Legenda da agenda: cores por tipo (as acordadas com a Red Tennis, na cor
 * cheia dos blocos, mais o bloqueio listrado) e as marcas de pagamento,
 * reposicao e cancelamento.
 */
export function Legenda({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Cores por tipo">
        {ORDEM_TIPOS_AGENDA.map((tipo) => (
          <li key={tipo} className="flex items-center gap-1.5 text-xs text-areia-700">
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 rounded-[4px]"
              style={{
                backgroundColor: ESTILO_OCUPACAO[tipo].cheia,
                backgroundImage: tipo === "Bloqueio" ? FUNDO_BLOQUEIO : undefined,
                boxShadow: tipo === "Bloqueio" ? `inset 0 0 0 1px ${PALETA.areia[300]}` : undefined,
              }}
            />
            {tipo}
          </li>
        ))}
      </ul>
      <span className="hidden h-4 w-px bg-areia-200 lg:block" aria-hidden="true" />
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Marcas">
        <li className="flex items-center gap-1.5 text-xs text-areia-700">
          <span className="flex h-4 w-4 items-center justify-center rounded border border-amber-300 bg-amber-50 text-amber-800">
            <IconeRelogio className="h-3 w-3" />
          </span>
          Aguardando pagamento
        </li>
        <li className="flex items-center gap-1.5 text-xs text-areia-700">
          <span
            className="mx-0.5 inline-block h-3.5 w-3.5 rounded-[4px]"
            style={{
              backgroundColor: ESTILO_OCUPACAO["Locação Avulsa"].cheia,
              boxShadow: `0 0 0 2px ${BRANCO}, 0 0 0 4px ${PALETA.tijolo[700]}`,
            }}
            aria-hidden="true"
          />
          <span className="flex h-4 w-4 items-center justify-center rounded border border-tijolo-300 bg-tijolo-600 text-white">
            <IconeAlerta className="h-3 w-3" />
          </span>
          Prazo vencido
        </li>
        <li className="flex items-center gap-1.5 text-xs text-areia-700">
          <span className="flex h-4 w-4 items-center justify-center rounded border border-emerald-300 bg-emerald-50 text-emerald-800">
            <IconeCheck className="h-3 w-3" />
          </span>
          Pago
        </li>
        <li className="flex items-center gap-1.5 text-xs text-areia-700">
          <span className="flex h-4 w-4 items-center justify-center rounded bg-violet-100 text-violet-800">
            <IconeReposicao className="h-3 w-3" />
          </span>
          Reposição
        </li>
        <li className="flex items-center gap-1.5 text-xs text-areia-700">
          <span
            className="rounded-[4px] border-2 border-dashed bg-white px-1 text-[11px] text-areia-600 line-through"
            style={{ borderColor: ESTILO_OCUPACAO.Individual.cor }}
          >
            Aula
          </span>
          <span className="rounded bg-sky-50 px-1 text-[10px] font-bold leading-4 text-sky-700">
            CH
          </span>
          Cancelada (com a sigla)
        </li>
      </ul>
    </div>
  );
}

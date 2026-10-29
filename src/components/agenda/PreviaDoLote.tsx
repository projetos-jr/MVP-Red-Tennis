import type { PreviaEmLote } from "@/lib/consultas/agenda";
import { formatarMinutos } from "@/lib/theme";
import { intervalo, plural, rotuloCurtoDaQuadra } from "./estilos";

/**
 * Lista das aulas que um bloqueio ou a chuva vai cancelar, com os minutos
 * de reposicao de cada uma e o total — mostrada ANTES de confirmar.
 */
export function PreviaDoLote({ previa, sigla }: { previa: PreviaEmLote; sigla: string }) {
  if (previa.aulas.length === 0) {
    return (
      <p className="rounded-xl border border-areia-200 bg-areia-50 px-3.5 py-3 text-sm text-areia-700">
        Nenhuma aula ativa nesse período.
      </p>
    );
  }
  return (
    <section
      className="overflow-hidden rounded-xl border border-areia-200"
      aria-label="Aulas afetadas"
    >
      <header className="flex flex-wrap gap-x-4 gap-y-1 border-b border-areia-200 bg-areia-50 px-3.5 py-2.5 text-sm">
        <span>
          <strong className="text-areia-900">{plural(previa.aulas.length, "aula", "aulas")}</strong>{" "}
          canceladas com {sigla}
        </span>
        <span>
          <strong className="text-areia-900">{plural(previa.alunos, "aluno", "alunos")}</strong>
        </span>
        <span>
          <strong className="text-emerald-700">{formatarMinutos(previa.minutos)}</strong> de
          reposição
        </span>
      </header>
      <ul className="max-h-60 divide-y divide-areia-100 overflow-y-auto rolagem-suave text-sm">
        {previa.aulas.map(({ item, minutos }) => (
          <li key={item.ocupacao.id} className="flex items-start justify-between gap-3 px-3.5 py-2">
            <span className="min-w-0">
              <span className="font-semibold tabular-nums text-areia-900">
                {rotuloCurtoDaQuadra(item.ocupacao.quadraId)} · {intervalo(item.ocupacao)}
              </span>{" "}
              <span className="text-areia-600">{item.ocupacao.tipo}</span>
              <span className="block truncate text-xs text-areia-500">
                {item.participantes.map((p) => p.nome).join(", ") || "Sem alunos"}
              </span>
            </span>
            <span
              className={`shrink-0 text-xs font-semibold ${minutos > 0 ? "text-emerald-700" : "text-areia-500"}`}
            >
              {minutos > 0 ? `+${formatarMinutos(minutos)}` : "sem reposição"}
            </span>
          </li>
        ))}
      </ul>
      {previa.reservasPagas > 0 && (
        <p className="border-t border-areia-200 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900">
          {plural(
            previa.reservasPagas,
            "reserva já paga será cancelada",
            "reservas já pagas serão canceladas",
          )}
          : combine a devolução ou a remarcação com o cliente.
        </p>
      )}
    </section>
  );
}

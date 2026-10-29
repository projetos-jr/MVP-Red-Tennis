import { StatCard } from "@/components/ui/StatCard";
import { IconeAlerta, IconeCheck, IconeFinanceiro, IconeTrofeu } from "@/components/ui/Icons";
import type { IndicadoresDoAluno } from "@/lib/consultas/alunos";
import { formatarMoeda } from "@/lib/theme";
import { plural } from "./estilos";

/** Aulas, faltas, pagamentos e ranking do aluno, em quatro cartoes. */
export function IndicadoresAluno({ indicadores }: { indicadores: IndicadoresDoAluno }) {
  const {
    presencas,
    faltas,
    faltasAvisadas,
    canceladas,
    frequencia,
    totalPago,
    emAberto,
    emAtraso,
    ranking,
    inscritosNoRanking,
  } = indicadores;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard
        rotulo="Aulas realizadas"
        rotuloCurto="Aulas"
        valor={String(presencas)}
        detalhe={
          frequencia === undefined
            ? "Nenhuma presença marcada ainda"
            : `${Math.round(frequencia * 100)}% de frequência nas aulas marcadas`
        }
        icone={<IconeCheck className="h-5 w-5" />}
        tom="positivo"
      />
      <StatCard
        rotulo="Faltas"
        valor={String(faltas + faltasAvisadas)}
        detalhe={`${faltas} sem aviso · ${faltasAvisadas} avisadas · ${plural(canceladas, "aula cancelada ou suspensa", "aulas canceladas ou suspensas")}`}
        icone={<IconeAlerta className="h-5 w-5" />}
      />
      <StatCard
        rotulo="Total pago"
        rotuloCurto="Pago"
        valor={formatarMoeda(totalPago)}
        detalhe={
          emAberto > 0
            ? `${formatarMoeda(emAberto)} em aberto${emAtraso > 0 ? ` (${formatarMoeda(emAtraso)} em atraso)` : ""}`
            : "Nenhuma pendência"
        }
        icone={<IconeFinanceiro className="h-5 w-5" />}
        tom={emAtraso > 0 ? "alerta" : "neutro"}
      />
      <StatCard
        rotulo="Pontuação no ranking"
        rotuloCurto="Ranking"
        valor={ranking ? `${ranking.pontos} pts` : "—"}
        detalhe={
          ranking
            ? `${ranking.posicao}º de ${inscritosNoRanking} · ${plural(ranking.vitorias, "vitória", "vitórias")} e ${plural(ranking.derrotas, "derrota", "derrotas")}`
            : "Não está inscrito no ranking"
        }
        icone={<IconeTrofeu className="h-5 w-5" />}
        tom="saibro"
      />
    </div>
  );
}

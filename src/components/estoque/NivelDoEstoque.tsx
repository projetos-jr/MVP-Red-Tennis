import { Badge } from "@/components/ui/Badge";
import type { NivelEstoque } from "@/lib/consultas/estoque";
import { ESTILO_NIVEL_ESTOQUE } from "@/lib/theme";

/**
 * Sinais do nivel do estoque. O cliente pediu "bater o olho e entender":
 * cor + rotulo + barra, nunca so a cor.
 */

export function SeloDoNivel({ nivel, className = "" }: { nivel: NivelEstoque; className?: string }) {
  const estilo = ESTILO_NIVEL_ESTOQUE[nivel];
  return (
    <Badge cor={estilo.cor} fundo={estilo.fundo} borda={estilo.borda} className={className}>
      {estilo.label}
    </Badge>
  );
}

/**
 * Barra do saldo com a marca do estoque minimo. A referencia de "cheio" e o
 * dobro do minimo, como no MVP.
 */
export function BarraDoNivel({
  saldo,
  estoqueMinimo,
  nivel,
  className = "",
}: {
  saldo: number;
  estoqueMinimo: number;
  nivel: NivelEstoque;
  className?: string;
}) {
  const referencia = Math.max(estoqueMinimo * 2, 1);
  const preenchimento = Math.min(100, (Math.max(saldo, 0) / referencia) * 100);
  return (
    <div
      className={`relative h-2 w-full overflow-hidden rounded-full bg-areia-100 ${className}`}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${Math.max(preenchimento, saldo > 0 ? 4 : 0)}%`,
          backgroundColor: ESTILO_NIVEL_ESTOQUE[nivel].barra,
        }}
      />
      <span
        className="absolute top-0 h-full w-0.5 bg-areia-500"
        style={{ left: `${Math.min((estoqueMinimo / referencia) * 100, 99)}%` }}
      />
    </div>
  );
}

/** Numero grande do saldo na cor do nivel, com o minimo ao lado. */
export function SaldoEmDestaque({
  saldo,
  estoqueMinimo,
  nivel,
  tamanho = "md",
}: {
  saldo: number;
  estoqueMinimo: number;
  nivel: NivelEstoque;
  tamanho?: "md" | "lg";
}) {
  return (
    <p>
      <span
        className={`font-bold leading-none tabular-nums ${tamanho === "lg" ? "text-4xl" : "text-3xl"}`}
        style={{ color: ESTILO_NIVEL_ESTOQUE[nivel].cor }}
      >
        {saldo}
      </span>
      <span className="ml-1.5 text-xs text-areia-500">/ mín. {estoqueMinimo}</span>
    </p>
  );
}

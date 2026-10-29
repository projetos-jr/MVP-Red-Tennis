import { Card } from "@/components/ui/Card";
import { IconeCadeado } from "@/components/ui/Icons";

/** Hipotese H9: o perfil de professor nao enxerga o estoque. */
export function SemAcessoAoEstoque() {
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <IconeCadeado className="mx-auto h-8 w-8 text-areia-400" />
      <h1 className="mt-3 text-lg font-semibold text-areia-900">
        O estoque não está liberado para o seu perfil
      </h1>
      <p className="mt-1 text-sm text-areia-600">
        Quem cuida do estoque e do balcão é a direção e a recepção. Se precisar de acesso,
        fale com a direção.
      </p>
    </Card>
  );
}

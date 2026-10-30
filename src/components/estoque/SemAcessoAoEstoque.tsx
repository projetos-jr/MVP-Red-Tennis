import { EstadoVazio } from "@/components/ui/EstadoVazio";
import { IconeCadeado } from "@/components/ui/Icons";

/** Hipotese H9: o perfil de professor nao enxerga o estoque. */
export function SemAcessoAoEstoque() {
  return (
    <EstadoVazio
      className="mx-auto max-w-lg"
      icone={<IconeCadeado className="h-6 w-6" />}
      titulo="O estoque não está liberado para o seu perfil"
      tituloDaPagina
    >
      Quem cuida do estoque e do balcão é a direção e a recepção. Se precisar de acesso, fale com a
      direção.
    </EstadoVazio>
  );
}

"use client";

import { useCallback, useState } from "react";
import { corAvatar, iniciais } from "@/lib/theme";

interface AvatarProps {
  id: string;
  nome: string;
  /** Caminho da foto. Se o arquivo nao existir, cai no placeholder de iniciais. */
  src?: string;
  tamanho?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Anel branco ao redor — util sobre fundos coloridos (pirâmide do torneio). */
  comAnel?: boolean;
  /** Cor de fundo das iniciais. O professor usa a cor dele na agenda. */
  cor?: string;
}

const TAMANHOS: Record<NonNullable<AvatarProps["tamanho"]>, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

/**
 * Avatar de uma pessoa (aluno ou professor).
 *
 * Recebe `src` de `caminhoAvatar(id)`, que so devolve um caminho para quem tem
 * foto em `public/avatars/`. Sem foto — ou se o arquivo falhar — exibe as
 * iniciais sobre uma cor estavel derivada do id.
 */
export function Avatar({
  id,
  nome,
  src,
  tamanho = "md",
  className = "",
  comAnel = false,
  cor,
}: AvatarProps) {
  const [falhou, setFalhou] = useState(false);

  /**
   * O 404 da foto costuma acontecer antes de o React hidratar a pagina, e nesse
   * caso o evento `error` se perde. Por isso a verificacao tambem e feita na
   * montagem, olhando direto para o estado do elemento.
   */
  const verificar = useCallback((elemento: HTMLImageElement | null) => {
    if (elemento && elemento.complete && elemento.naturalWidth === 0) {
      setFalhou(true);
    }
  }, []);

  const classesBase = `${TAMANHOS[tamanho]} shrink-0 overflow-hidden rounded-full object-cover ${
    comAnel ? "ring-2 ring-white" : ""
  } ${className}`;

  if (src && !falhou) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={verificar}
        src={src}
        alt=""
        onError={() => setFalhou(true)}
        title={nome}
        aria-label={nome}
        role="img"
        className={classesBase}
      />
    );
  }

  return (
    <span
      className={`${classesBase} inline-flex items-center justify-center font-semibold text-white`}
      style={{ backgroundColor: cor ?? corAvatar(id) }}
      title={nome}
      aria-label={nome}
      role="img"
    >
      {iniciais(nome)}
    </span>
  );
}

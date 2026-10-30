import type { ReactNode } from "react";
import { Card } from "./Card";

/**
 * Aviso no lugar de uma tela ou bloco sem conteúdo: sem acesso, registro não
 * encontrado ou nada registrado ainda. Sempre o mesmo desenho: ícone num
 * quadrado de saibro, título, explicação curta e as ações (a principal
 * primeiro).
 *
 *   <EstadoVazio
 *     icone={<IconeCadeado className="h-6 w-6" />}
 *     titulo="Sem acesso a esta área"
 *     tituloDaPagina
 *     acoes={<Link href="/dashboard" className="btn-primario">Voltar ao painel</Link>}
 *   >
 *     O seu perfil não abre esta área.
 *   </EstadoVazio>
 *
 * Dentro de uma lista ("Nenhum aluno encontrado com esses filtros"), basta
 * uma linha de texto centralizada, sem este cartão.
 */
export function EstadoVazio({
  icone,
  titulo,
  children,
  acoes,
  tituloDaPagina,
  className = "",
}: {
  icone: ReactNode;
  titulo: string;
  /** Explicação curta embaixo do título. */
  children?: ReactNode;
  acoes?: ReactNode;
  /** O aviso ocupa a tela inteira: o título vira o título da página (h1). */
  tituloDaPagina?: boolean;
  className?: string;
}) {
  const Titulo = tituloDaPagina ? "h1" : "h2";
  return (
    <Card className={`px-6 py-10 text-center sm:px-12 ${className}`}>
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-saibro-50 text-saibro-700">
        {icone}
      </span>
      <Titulo className="mt-4 text-lg font-semibold text-areia-900">{titulo}</Titulo>
      {children && (
        <div className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-areia-600">{children}</div>
      )}
      {acoes && <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">{acoes}</div>}
    </Card>
  );
}

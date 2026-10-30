import Link from "next/link";
import type { ReactNode } from "react";
import { IconeVoltar } from "./Icons";

/**
 * Cabeçalho padrão das telas: título, descrição embaixo e as ações à direita,
 * com a ação principal (`btn-primario`) por último. No celular as ações
 * descem para baixo do título e dividem a largura da tela.
 *
 *   <CabecalhoDaPagina
 *     titulo="Alunos"
 *     descricao="93 cadastrados · 77 com plano ativo"
 *     acoes={
 *       <>
 *         <Link href="/professores" className="btn-secundario">Professores</Link>
 *         <button type="button" className="btn-primario">Novo aluno</button>
 *       </>
 *     }
 *   />
 *
 * Telas de detalhe (ficha do aluno, torneio...) mostram o título dentro do
 * cartão; para voltar, use `LinkDeVolta` acima de tudo.
 */
export function CabecalhoDaPagina({
  titulo,
  descricao,
  acima,
  acoes,
  esconderAcoesNoCelular,
  className = "",
}: {
  titulo: ReactNode;
  /** Linha de apoio embaixo do título (contagem, data, mês...). */
  descricao?: ReactNode;
  /** Linha pequena acima do título (ex.: a saudação do painel). */
  acima?: ReactNode;
  /** Botões ou links de ação. */
  acoes?: ReactNode;
  /** Para ações que o celular já tem em outro lugar (ex.: a barra de baixo). */
  esconderAcoesNoCelular?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {acima}
        <h1 className="text-2xl font-bold text-areia-900 sm:text-3xl">{titulo}</h1>
        {descricao && <div className="mt-1 text-sm text-areia-600">{descricao}</div>}
      </div>
      {acoes && (
        <div
          className={`${esconderAcoesNoCelular ? "hidden md:flex" : "flex"} w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none`}
        >
          {acoes}
        </div>
      )}
    </div>
  );
}

/** "← Alunos": volta para a tela de cima. Fica acima do cabeçalho ou do cartão do título. */
export function LinkDeVolta({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`alvo-de-toque inline-flex items-center gap-1.5 text-sm font-medium text-areia-600 transition-colors hover:text-tijolo-700 ${className}`}
    >
      <IconeVoltar className="h-4 w-4" />
      {children}
    </Link>
  );
}

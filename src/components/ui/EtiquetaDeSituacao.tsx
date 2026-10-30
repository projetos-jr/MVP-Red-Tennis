import type { ComponentType, ReactNode, SVGProps } from "react";
import { Badge } from "./Badge";
import { IconeAlerta, IconeCheck, IconeCongelado, IconeFechar, IconeRelogio } from "./Icons";

/**
 * Etiquetas de situação, iguais em todos os módulos: a mesma situação tem
 * sempre a mesma cor e o mesmo ícone. "Pago" é verde com ✓ no financeiro, na
 * ficha do aluno, no consumo do balcão e no painel da aula; "em atraso" é
 * vermelho com ⚠ em todo lugar. A cor nunca vem sozinha: sempre há o texto.
 *
 *   <EtiquetaDeSituacao situacao="pago">Pago em 12/10</EtiquetaDeSituacao>
 *   <EtiquetaDeSituacao situacao="em_atraso" pequena>3 dias em atraso</EtiquetaDeSituacao>
 *   <EtiquetaDeSituacao tom="positivo">Ativo</EtiquetaDeSituacao>   (só a cor, sem ícone)
 *
 * Para categoria e forma de pagamento (não são situação), use `EtiquetaNeutra`.
 */

export type Tom = "positivo" | "atencao" | "alerta" | "neutro" | "info" | "destaque";

/** As cores de cada tom (texto, fundo e borda). Todas passam de 4,5:1 de contraste. */
export const TONS: Record<Tom, { cor: string; fundo: string; borda: string }> = {
  /** Pago, ativo, presente, em dia. */
  positivo: { cor: "#15803D", fundo: "#F0FDF4", borda: "#9DE0B4" },
  /** Pendente, em aberto, aguardando, a fechar. */
  atencao: { cor: "#A16207", fundo: "#FEFBEB", borda: "#F5D97A" },
  /** Em atraso, prazo vencido, esgotado, inativo. */
  alerta: { cor: "#8A2118", fundo: "#FBE3E0", borda: "#EC9A90" },
  /** Anulado, encerrado, a marcar, mês em andamento. */
  neutro: { cor: "#4F483E", fundo: "#F4F1EC", borda: "#D6CEC2" },
  /** Congelado (plano pausado), suspensa. */
  info: { cor: "#0369A1", fundo: "#F0FAFF", borda: "#A5DFF7" },
  /** Saibro: plano do aluno, inscrições abertas, repasse fechado a pagar. */
  destaque: { cor: "#9A4720", fundo: "#FAE8DA", borda: "#F3CEAF" },
};

type Icone = ComponentType<SVGProps<SVGSVGElement>>;

/** Situações que se repetem entre os módulos, cada uma com o seu tom e ícone. */
export type Situacao = "pago" | "pendente" | "em_atraso" | "cancelado" | "congelado" | "em_andamento";

export const SITUACOES: Record<Situacao, { tom: Tom; Icone: Icone }> = {
  pago: { tom: "positivo", Icone: IconeCheck },
  pendente: { tom: "atencao", Icone: IconeRelogio },
  em_atraso: { tom: "alerta", Icone: IconeAlerta },
  cancelado: { tom: "neutro", Icone: IconeFechar },
  congelado: { tom: "info", Icone: IconeCongelado },
  em_andamento: { tom: "neutro", Icone: IconeRelogio },
};

export function EtiquetaDeSituacao({
  situacao,
  tom,
  icone,
  pequena,
  title,
  className = "",
  children,
}: {
  /** Situação conhecida: define o tom e o ícone. */
  situacao?: Situacao;
  /** Tom sem situação (ou trocando o da situação). */
  tom?: Tom;
  /** Ícone próprio, no lugar do ícone da situação. */
  icone?: Icone;
  /** Versão menor, para listas compactas e colunas estreitas. */
  pequena?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const definicao = situacao ? SITUACOES[situacao] : undefined;
  const cores = TONS[tom ?? definicao?.tom ?? "neutro"];
  const Icone = icone ?? definicao?.Icone;
  return (
    <Badge
      cor={cores.cor}
      fundo={cores.fundo}
      borda={cores.borda}
      title={title}
      className={`${pequena ? "px-2 py-0.5 text-[11px]" : ""} ${className}`}
    >
      {Icone && <Icone className={pequena ? "h-3 w-3" : "h-3.5 w-3.5"} />}
      {children}
    </Badge>
  );
}

/** Categoria e forma de pagamento: neutras, o texto identifica. */
export function EtiquetaNeutra({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center whitespace-nowrap rounded-md border border-areia-200 bg-areia-50 px-1.5 py-0.5 text-[11px] font-medium text-areia-700"
    >
      {children}
    </span>
  );
}

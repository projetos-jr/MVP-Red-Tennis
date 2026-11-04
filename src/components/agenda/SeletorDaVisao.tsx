"use client";

import { Segmentado } from "@/components/ui/Segmentado";
import type { VisaoDaAgenda } from "@/lib/consultas/enderecoDaAgenda";

const OPCOES: Array<{ valor: VisaoDaAgenda; rotulo: string }> = [
  { valor: "diaria", rotulo: "Diária" },
  { valor: "quadra", rotulo: "Quadra" },
  { valor: "professor", rotulo: "Professor" },
  { valor: "mes", rotulo: "Mês" },
];

/**
 * As quatro visoes da agenda: Diaria (hoje e amanha, uma coluna por quadra;
 * a padrao, como no sistema antigo), Quadra (a semana de uma quadra),
 * Professor (a semana de um professor) e Mes.
 */
export function SeletorDaVisao({
  valor,
  aoMudar,
  className = "",
}: {
  valor: VisaoDaAgenda;
  aoMudar: (visao: VisaoDaAgenda) => void;
  className?: string;
}) {
  return (
    <Segmentado
      aria="Visão da agenda"
      valor={valor}
      aoMudar={aoMudar}
      opcoes={OPCOES}
      className={className}
    />
  );
}

"use client";

import type { VisaoDaAgenda } from "@/lib/consultas/enderecoDaAgenda";

const OPCOES: Array<{ valor: VisaoDaAgenda; rotulo: string }> = [
  { valor: "diaria", rotulo: "Diária" },
  { valor: "professor", rotulo: "Professores" },
  { valor: "quadra", rotulo: "Quadra" },
  { valor: "mes", rotulo: "Mês" },
];

/**
 * As quatro visoes da agenda, em botoes grandes (letra de placar):
 * Diaria (hoje e amanha, uma coluna por quadra; a padrao, como no sistema
 * antigo), Professores (hoje e amanha, uma coluna por professor; ou a semana
 * de um), Quadra (a semana de uma quadra) e Mes.
 *
 * Mesmo papel do `Segmentado` (abas), em tamanho maior: e o controle mais
 * usado da tela. No celular, os quatro dividem a largura (cada um do tamanho
 * do seu nome).
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
    <div
      role="tablist"
      aria-label="Visão da agenda"
      className={`flex items-center gap-1 rounded-xl border border-areia-200 bg-white p-1 shadow-sm sm:inline-flex ${className}`}
    >
      {OPCOES.map((opcao) => {
        const ativo = opcao.valor === valor;
        return (
          <button
            key={opcao.valor}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => aoMudar(opcao.valor)}
            className={`alvo-de-toque min-h-[2.75rem] flex-auto rounded-lg px-1.5 font-display text-lg font-semibold leading-none transition-colors sm:px-3 xl:px-3.5 xl:text-xl ${
              ativo
                ? "bg-saibro-600 text-white shadow-sm"
                : "text-areia-700 hover:bg-saibro-50 hover:text-saibro-800"
            }`}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

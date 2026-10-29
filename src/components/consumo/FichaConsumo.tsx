"use client";

import { useMemo, useState } from "react";
import { ModalConsumo } from "./ModalConsumo";
import { ModalFecharConta } from "./ModalFecharConta";
import { diaEHora } from "@/components/estoque/formatos";
import { IconeRecibo } from "@/components/estoque/Icones";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeAlerta, IconeCopo, IconeMais } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import { podeAcessar } from "@/lib/consultas/base";
import {
  consumosDaPessoa,
  resumoDaConta,
  type ConsumoNaConta,
  type SituacaoDoConsumo,
} from "@/lib/consultas/estoque";
import { formatarDiaMes } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";

interface FichaConsumoProps {
  pessoaId: string;
  tipoPessoa: "aluno" | "professor";
  nomePessoa: string;
}

/** Situacao de cada consumo: cor + rotulo escrito (nunca so a cor). */
const ESTILO_SITUACAO: Record<
  SituacaoDoConsumo,
  { rotulo: string; cor: string; fundo: string; borda: string }
> = {
  em_aberto: { rotulo: "Em aberto", cor: "#A16207", fundo: "#FEFBEB", borda: "#F5D97A" },
  em_atraso: { rotulo: "Em atraso", cor: "#8A2118", fundo: "#FBE3E0", borda: "#EC9A90" },
  pago: { rotulo: "Pago", cor: "#15803D", fundo: "#F0FDF4", borda: "#9DE0B4" },
  anulado: { rotulo: "Anulado", cor: "#6B6255", fundo: "#F4F1EC", borda: "#D6CEC2" },
};

/** "vence 05/11", "venceu 22/10", "pago 28/10 · Stone"... */
function detalheDaCobranca({ cobranca, situacao }: ConsumoNaConta): string {
  if (!cobranca) return "";
  switch (situacao) {
    case "em_aberto":
      return ` · vence ${formatarDiaMes(cobranca.vencimento)}`;
    case "em_atraso":
      return ` · venceu ${formatarDiaMes(cobranca.vencimento)}`;
    case "pago":
      return cobranca.pagoEm
        ? ` · pago ${formatarDiaMes(cobranca.pagoEm)}${cobranca.formaPagamento ? ` · ${cobranca.formaPagamento}` : ""}`
        : "";
    case "anulado":
      return " · anulado no financeiro";
  }
}

/**
 * Consumo no balcao (bebidas, cervejas e lanches) lancado na conta da pessoa.
 * Serve tanto para aluno quanto para professor — e o mesmo bloco nas duas fichas.
 *
 * A situacao de cada consumo vem do lancamento a receber ligado a ele.
 * "Fechar conta" registra de uma vez o pagamento de tudo o que esta em aberto.
 */
export function FichaConsumo({ pessoaId, tipoPessoa, nomePessoa }: FichaConsumoProps) {
  const { banco, colaborador } = useApp();
  const [modal, setModal] = useState<"consumo" | "fechar" | null>(null);

  const lista = useMemo(() => consumosDaPessoa(banco, pessoaId, HOJE), [banco, pessoaId]);
  const resumo = resumoDaConta(lista);
  const abertos = lista.filter((c) => c.situacao === "em_aberto" || c.situacao === "em_atraso");
  // Hipotese H9: professor so le; dono e recepcao lancam e fecham a conta.
  const podeAlterar = podeAcessar(banco, colaborador, "estoque");

  return (
    <Card>
      <CardHeader
        titulo="Consumo no balcão"
        descricao="Bebidas e lanches lançados na conta."
        icone={<IconeCopo className="h-5 w-5" />}
        acao={
          podeAlterar && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setModal("consumo")}
                className="btn-primario py-2 text-xs"
              >
                <IconeMais className="h-3.5 w-3.5" />
                Lançar consumo
              </button>
              <button
                type="button"
                onClick={() => setModal("fechar")}
                disabled={abertos.length === 0}
                className="btn-secundario py-2 text-xs"
                title={abertos.length === 0 ? "Não há consumo em aberto" : undefined}
              >
                <IconeRecibo className="h-3.5 w-3.5" />
                Fechar conta
              </button>
            </div>
          )
        }
      />

      {/* Totais */}
      <div className="grid grid-cols-2 gap-px border-b border-areia-200 bg-areia-200">
        <div className="bg-white px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-areia-500">Em aberto</p>
          <p
            className={`mt-1 text-xl font-bold tabular-nums ${
              resumo.emAberto > 0 ? "text-tijolo-700" : "text-areia-900"
            }`}
          >
            {formatarMoeda(resumo.emAberto)}
          </p>
          <p className="mt-0.5 text-xs text-areia-500">
            {resumo.quantidadeEmAberto === 0
              ? "Nada a pagar"
              : `${resumo.quantidadeEmAberto} consumo(s)`}
          </p>
        </div>
        <div className="bg-white px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-areia-500">Já pago</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-areia-900">
            {formatarMoeda(resumo.pago)}
          </p>
        </div>
      </div>

      {resumo.emAtraso > 0 && (
        <p className="flex items-start gap-2 border-b border-tijolo-100 bg-tijolo-50 px-5 py-2.5 text-xs text-tijolo-800">
          <IconeAlerta className="mt-px h-4 w-4 shrink-0" />
          <span>
            <strong>{formatarMoeda(resumo.emAtraso)}</strong> em atraso
            {resumo.vencimentoMaisAntigo &&
              ` desde ${formatarDiaMes(resumo.vencimentoMaisAntigo)}`}
            .
          </span>
        </p>
      )}

      <ul className="max-h-80 divide-y divide-areia-100 overflow-y-auto rolagem-suave">
        {lista.map((item) => {
          const { consumo, situacao, valor } = item;
          const estilo = ESTILO_SITUACAO[situacao];
          return (
            <li key={consumo.id} className="flex items-center gap-3 px-5 py-2.5">
              {/* Sem cortar o nome: "Água mineral com gás" e "sem gás" só diferem no fim. */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-areia-900">
                  {consumo.quantidade > 1 && (
                    <span className="text-areia-500">{consumo.quantidade}× </span>
                  )}
                  {consumo.produtoNome}
                </p>
                <p className="text-xs text-areia-500">
                  {diaEHora(consumo.data)}
                  {detalheDaCobranca(item)}
                </p>
              </div>

              <Badge
                cor={estilo.cor}
                fundo={estilo.fundo}
                borda={estilo.borda}
                className="shrink-0 text-[10px]"
              >
                {estilo.rotulo}
              </Badge>

              <span
                className={`w-20 shrink-0 text-right text-sm font-semibold tabular-nums ${
                  situacao === "anulado" ? "text-areia-400 line-through" : "text-areia-800"
                }`}
              >
                {formatarMoeda(valor)}
              </span>
            </li>
          );
        })}

        {lista.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-areia-500">
            Nenhum consumo lançado ainda.
          </li>
        )}
      </ul>

      {modal === "consumo" && (
        <ModalConsumo
          pessoa={{ id: pessoaId, tipo: tipoPessoa, nome: nomePessoa }}
          aoFechar={() => setModal(null)}
        />
      )}
      {modal === "fechar" && (
        <ModalFecharConta
          pessoaId={pessoaId}
          nomePessoa={nomePessoa}
          abertos={abertos}
          aoFechar={() => setModal(null)}
        />
      )}
    </Card>
  );
}

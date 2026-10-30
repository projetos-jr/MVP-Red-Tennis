"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { EtiquetaDeSituacao } from "@/components/ui/EtiquetaDeSituacao";
import { IconeRelogio } from "@/components/ui/Icons";
import { MostrarMais } from "@/components/ui/MostrarMais";
import type { Ocupacao, SiglaReposicao } from "@/lib/banco/tipos";
import type { ExtratoDoAluno, MovimentoDeReposicao } from "@/lib/consultas/alunos";
import { rotuloDaQuadra } from "@/lib/consultas/base";
import { diferencaEmDias, formatarData, formatarDiaMes } from "@/lib/date";
import { estiloDaSigla, formatarMinutos } from "@/lib/theme";

const POR_PAGINA = 6;

function descreverAula(ocupacao: Ocupacao): string {
  return `${formatarDiaMes(ocupacao.data)} às ${ocupacao.horaInicio} · ${rotuloDaQuadra(ocupacao.quadraId)}`;
}

/**
 * Extrato de minutos de reposicao (so leitura: quem lanca creditos e usos e a
 * agenda). Cada credito mostra a sigla, a aula que o gerou, a validade e
 * quanto ainda resta; cada uso, a aula em que foi usado.
 */
export function ExtratoReposicao({
  extrato,
  siglas,
  validadeMeses,
  hoje,
}: {
  extrato: ExtratoDoAluno;
  siglas: SiglaReposicao[];
  validadeMeses: number;
  hoje: string;
}) {
  const [limite, setLimite] = useState(POR_PAGINA);
  const { saldo, proximoVencimento, venceEm30Dias, vencidos, movimentos } = extrato;
  const nomeDaSigla = new Map(siglas.map((s) => [s.codigo, s.nome]));
  const diasParaVencer = proximoVencimento ? diferencaEmDias(hoje, proximoVencimento.data) : undefined;

  return (
    <Card>
      <CardHeader
        titulo="Reposição"
        descricao={`Extrato em minutos. Cada crédito vale ${validadeMeses} meses; quem lança é a agenda.`}
        icone={<IconeRelogio className="h-5 w-5" />}
      />

      <div className="space-y-3 p-5">
        <div className="rounded-xl border border-saibro-200 bg-saibro-50/70 p-4 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-saibro-700">Saldo disponível</p>
          <p className="mt-1 text-3xl font-bold text-saibro-800">
            {saldo > 0 ? formatarMinutos(saldo) : "0min"}
          </p>
          <p className="mt-1 text-xs text-saibro-700">
            {saldo === 1 ? "1 minuto" : `${saldo} minutos`} para marcar reposição
          </p>
        </div>

        {proximoVencimento && diasParaVencer !== undefined && (
          <p
            className={`rounded-lg px-3 py-2 text-xs ${
              diasParaVencer <= 30 ? "bg-tijolo-50 text-tijolo-800" : "bg-areia-100 text-areia-700"
            }`}
          >
            {diasParaVencer <= 30 && <strong className="font-semibold">Atenção: </strong>}
            {formatarMinutos(proximoVencimento.minutos)} vencem em {formatarData(proximoVencimento.data)}
            {diasParaVencer === 0 ? " (hoje)" : ` (em ${diasParaVencer} dias)`}.
            {venceEm30Dias > proximoVencimento.minutos &&
              ` Ao todo, ${formatarMinutos(venceEm30Dias)} vencem nos próximos 30 dias.`}
          </p>
        )}
        {vencidos > 0 && (
          <p className="text-xs text-areia-500">
            {formatarMinutos(vencidos)} venceram sem ser usados.
          </p>
        )}
      </div>

      <ul className="divide-y divide-areia-100 border-t border-areia-200">
        {movimentos.slice(0, limite).map((movimento) => (
          <Movimento key={movimento.lancamento.id} movimento={movimento} nomeDaSigla={nomeDaSigla} />
        ))}
        {movimentos.length === 0 && (
          <li className="px-5 py-6 text-center text-sm text-areia-500">
            Nenhum crédito de reposição ainda.
          </li>
        )}
      </ul>

      <MostrarMais
        mostrando={Math.min(limite, movimentos.length)}
        total={movimentos.length}
        passo={POR_PAGINA * 2}
        aoMostrarMais={() => setLimite(limite + POR_PAGINA * 2)}
      />
    </Card>
  );
}

function Movimento({
  movimento,
  nomeDaSigla,
}: {
  movimento: MovimentoDeReposicao;
  nomeDaSigla: Map<string, string>;
}) {
  const { lancamento, tipo, origem, uso, restante, vencido } = movimento;
  const minutos = Math.abs(lancamento.minutos);

  if (tipo === "uso") {
    return (
      <li className="flex items-start gap-3 px-5 py-3">
        <Badge className="shrink-0">Uso</Badge>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-areia-900">Reposição marcada</p>
          <p className="text-xs text-areia-500">
            {uso ? `Aula de ${descreverAula(uso)}` : `Lançado em ${formatarData(lancamento.criadoEm)}`}
          </p>
          {lancamento.observacao && <p className="text-xs text-areia-500">{lancamento.observacao}</p>}
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-areia-800">
          −{formatarMinutos(minutos)}
        </span>
      </li>
    );
  }

  const sigla = lancamento.sigla;
  const estilo = sigla ? estiloDaSigla(sigla) : undefined;
  // Usado por inteiro (antes de vencer) nao e "vencido": so conta o que sobrou.
  const usado = restante === 0;
  const perdido = Boolean(vencido) && !usado;

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      {sigla && estilo ? (
        <Badge cor={estilo.cor} fundo={estilo.fundo} className="shrink-0" title={nomeDaSigla.get(sigla)}>
          {sigla}
        </Badge>
      ) : (
        <Badge className="shrink-0">Crédito</Badge>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${perdido ? "text-areia-500 line-through" : "text-areia-900"}`}>
          {sigla ? (nomeDaSigla.get(sigla) ?? sigla) : "Crédito de reposição"}
        </p>
        <p className="text-xs text-areia-500">
          {origem ? `Aula de ${descreverAula(origem)}` : `Lançado em ${formatarData(lancamento.criadoEm)}`}
        </p>
        {lancamento.observacao && <p className="text-xs text-areia-500">{lancamento.observacao}</p>}
        <p className="mt-0.5 text-xs text-areia-600">
          {vencido ? "Venceu em" : "Válido até"}{" "}
          {lancamento.validade ? formatarData(lancamento.validade) : "—"}
          {!vencido && !usado && restante !== undefined && restante < minutos && (
            <> · resta {formatarMinutos(restante)}</>
          )}
          {perdido && restante !== undefined && restante < minutos && (
            <> · {formatarMinutos(restante)} sem uso</>
          )}
        </p>
      </div>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`text-sm font-semibold tabular-nums ${
            perdido || usado ? "text-areia-400" : "text-emerald-700"
          }`}
        >
          +{formatarMinutos(minutos)}
        </span>
        {perdido ? (
          <EtiquetaDeSituacao tom="alerta" pequena>
            Vencido
          </EtiquetaDeSituacao>
        ) : usado ? (
          <EtiquetaDeSituacao tom="neutro" pequena>
            Usado
          </EtiquetaDeSituacao>
        ) : (
          <EtiquetaDeSituacao tom="positivo" pequena>
            Disponível
          </EtiquetaDeSituacao>
        )}
      </span>
    </li>
  );
}

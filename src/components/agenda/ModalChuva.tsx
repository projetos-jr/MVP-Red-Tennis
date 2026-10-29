"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { IconeCheck } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { Segmentado } from "@/components/ui/Segmentado";
import { cancelarPorChuva } from "@/lib/banco/operacoes/agenda";
import type { QuadraId } from "@/lib/banco/tipos";
import { previaDaChuva, quadrasDaArena } from "@/lib/consultas/agenda";
import { formatarData } from "@/lib/date";
import { formatarMinutos } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { CamposDeHora, CorpoRolavel, SeletorDeQuadras } from "./CamposDeHorario";
import { plural } from "./estilos";
import { PreviaDoLote } from "./PreviaDoLote";

interface Resumo {
  aulas: number;
  alunos: number;
  minutos: number;
  data: string;
}

/**
 * Cancelar por chuva: data (dia inteiro ou faixa de horario) e quadras.
 * Tudo o que estiver ativo e cancelado com CH, os creditos sao gerados e, no
 * fim, a tela mostra o resumo (aulas, alunos e minutos).
 */
export function ModalChuva({
  aberto,
  aoFechar,
  dataInicial,
  agora,
}: {
  aberto: boolean;
  aoFechar: () => void;
  dataInicial: string;
  agora: string;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const quadras = quadrasDaArena(banco);
  const [data, setData] = useState(dataInicial);
  const [periodo, setPeriodo] = useState<"dia" | "faixa">("dia");
  const [inicio, setInicio] = useState("14:00");
  const [fim, setFim] = useState("18:00");
  const [quadrasIds, setQuadrasIds] = useState<QuadraId[]>(quadras.map((q) => q.id));
  const [confirmando, setConfirmando] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(data);

  const dados = useMemo(
    () => ({
      data,
      quadrasIds,
      horaInicio: periodo === "faixa" ? inicio : undefined,
      horaFim: periodo === "faixa" ? fim : undefined,
    }),
    [data, quadrasIds, periodo, inicio, fim],
  );
  const previa = useMemo(
    () => (valida && quadrasIds.length > 0 ? previaDaChuva(banco, dados, agora) : undefined),
    [banco, dados, agora, valida, quadrasIds.length],
  );

  function cancelar() {
    if (!previa) return;
    const feito = {
      aulas: previa.aulas.length,
      alunos: previa.alunos,
      minutos: previa.minutos,
      data,
    };
    const gravou = gravar(
      cancelarPorChuva,
      dados,
      `Chuva registrada: ${plural(feito.aulas, "aula cancelada", "aulas canceladas")}, ${plural(feito.alunos, "aluno", "alunos")}, ${formatarMinutos(feito.minutos)} de reposição.`,
    );
    setConfirmando(false);
    if (gravou) setResumo(feito);
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    setConfirmando(true);
  }

  if (resumo) {
    return (
      <Modal aberto={aberto} aoFechar={aoFechar} titulo="Cancelamento por chuva registrado">
        <div className="space-y-4 px-5 py-5">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <IconeCheck className="h-5 w-5" />
            {formatarData(resumo.data)}: as aulas foram canceladas com CH.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Numero rotulo={resumo.aulas === 1 ? "aula" : "aulas"} valor={String(resumo.aulas)} />
            <Numero
              rotulo={resumo.alunos === 1 ? "aluno" : "alunos"}
              valor={String(resumo.alunos)}
            />
            <Numero rotulo="de reposição" valor={formatarMinutos(resumo.minutos)} />
          </div>
          <p className="text-xs text-areia-600">
            Os créditos já estão no extrato de reposição de cada aluno, com validade de{" "}
            {banco.configuracoes.validadeReposicaoMeses} meses.
          </p>
        </div>
        <footer className="flex justify-end border-t border-areia-200 px-5 py-4">
          <button type="button" onClick={aoFechar} className="btn-primario">
            Fechar
          </button>
        </footer>
      </Modal>
    );
  }

  return (
    <>
      <Modal
        aberto={aberto && !confirmando}
        aoFechar={aoFechar}
        titulo="Cancelar por chuva"
        descricao="Cancela com CH tudo o que estiver marcado e gera a reposição."
      >
        <form onSubmit={enviar}>
          <CorpoRolavel className="space-y-4 px-5 py-4">
            <Campo rotulo="Data" obrigatorio>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="campo"
                required
              />
            </Campo>
            <div className="space-y-3">
              <Segmentado
                aria="Período"
                valor={periodo}
                aoMudar={setPeriodo}
                opcoes={[
                  { valor: "dia", rotulo: "Dia inteiro" },
                  { valor: "faixa", rotulo: "Faixa de horário" },
                ]}
              />
              {periodo === "faixa" && (
                <CamposDeHora
                  inicio={inicio}
                  fim={fim}
                  semAtalhos
                  aoMudar={(novoInicio, novoFim) => {
                    setInicio(novoInicio);
                    setFim(novoFim);
                  }}
                />
              )}
            </div>
            <SeletorDeQuadras quadras={quadras} valor={quadrasIds} aoMudar={setQuadrasIds} />
            {previa && <PreviaDoLote previa={previa} sigla="CH (chuva)" />}
            <p className="text-xs text-areia-500">Bloqueios de quadra não são afetados.</p>
          </CorpoRolavel>
          <RodapeDoFormulario
            aoCancelar={aoFechar}
            rotuloConfirmar={
              previa && previa.aulas.length > 0
                ? `Cancelar ${plural(previa.aulas.length, "aula", "aulas")} por chuva`
                : "Cancelar por chuva"
            }
            desabilitado={!previa || previa.aulas.length === 0}
            perigoso
          />
        </form>
      </Modal>

      <Confirmacao
        aberto={aberto && confirmando}
        titulo="Confirmar cancelamento por chuva"
        mensagem={
          <>
            {plural(previa?.aulas.length ?? 0, "aula será cancelada", "aulas serão canceladas")} com
            CH em {valida ? formatarData(data) : "—"}.{" "}
            {plural(previa?.alunos ?? 0, "aluno ganha", "alunos ganham")} reposição (
            {formatarMinutos(previa?.minutos ?? 0)} no total).
          </>
        }
        rotuloConfirmar="Sim, cancelar por chuva"
        perigoso
        aoConfirmar={cancelar}
        aoCancelar={() => setConfirmando(false)}
      />
    </>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <p className="rounded-xl border border-sky-200 bg-sky-50 px-2 py-3">
      <span className="block text-2xl font-semibold text-sky-900">{valor}</span>
      <span className="block text-xs text-sky-800">{rotulo}</span>
    </p>
  );
}

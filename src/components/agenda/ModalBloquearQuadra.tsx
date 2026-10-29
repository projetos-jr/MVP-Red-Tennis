"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { Modal } from "@/components/ui/Modal";
import { HOJE } from "@/lib/banco/constantes";
import { bloquearQuadra } from "@/lib/banco/operacoes/agenda";
import type { QuadraId } from "@/lib/banco/tipos";
import { previaDoBloqueio, quadrasDaArena, rotuloDaQuadra } from "@/lib/consultas/agenda";
import { formatarDiaMes } from "@/lib/date";
import { formatarMinutos } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { Aviso, CamposDeHora, CorpoRolavel, SeletorDeQuadras } from "./CamposDeHorario";
import { plural } from "./estilos";
import { PreviaDoLote } from "./PreviaDoLote";

/**
 * Bloquear quadra (manutencao, evento, torneio): uma ou mais quadras, data,
 * horario e descricao. Mostra as aulas afetadas; ao confirmar, elas sao
 * canceladas com IAC (gerando os creditos) e a quadra fica bloqueada.
 */
export function ModalBloquearQuadra({
  aberto,
  aoFechar,
  inicial,
  agora,
}: {
  aberto: boolean;
  aoFechar: () => void;
  inicial: { data?: string; quadraId?: QuadraId };
  agora: string;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const [quadrasIds, setQuadrasIds] = useState<QuadraId[]>(
    inicial.quadraId ? [inicial.quadraId] : [],
  );
  const [data, setData] = useState(inicial.data && inicial.data >= HOJE ? inicial.data : HOJE);
  const [inicio, setInicio] = useState("07:00");
  const [fim, setFim] = useState("10:00");
  const [descricao, setDescricao] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(data);

  const previa = useMemo(
    () =>
      valida && quadrasIds.length > 0
        ? previaDoBloqueio(banco, { quadrasIds, data, horaInicio: inicio, horaFim: fim }, agora)
        : undefined,
    [banco, quadrasIds, data, inicio, fim, agora, valida],
  );
  const jaBloqueada = previa?.bloqueiosExistentes[0];

  function bloquear() {
    const aulas = previa?.aulas.length ?? 0;
    const nomes = quadrasIds.map((q) => rotuloDaQuadra(q)).join(", ");
    const gravou = gravar(
      bloquearQuadra,
      { quadrasIds, data, horaInicio: inicio, horaFim: fim, descricao },
      aulas > 0
        ? `Bloqueio criado (${nomes} · ${formatarDiaMes(data)} · ${inicio}–${fim}). ${plural(aulas, "aula cancelada", "aulas canceladas")} com IAC; reposição gerada: ${formatarMinutos(previa?.minutos ?? 0)}.`
        : `Bloqueio criado (${nomes} · ${formatarDiaMes(data)} · ${inicio}–${fim}).`,
    );
    setConfirmando(false);
    if (gravou) aoFechar();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    // Com aulas no caminho, pede confirmacao (cancelar aulas nao tem volta).
    if ((previa?.aulas.length ?? 0) > 0) setConfirmando(true);
    else bloquear();
  }

  // Enquanto a confirmacao esta aberta, o formulario sai da frente (o estado
  // fica guardado aqui); assim o Esc fecha so a confirmacao.
  return (
    <>
      <Modal
        aberto={aberto && !confirmando}
        aoFechar={aoFechar}
        titulo="Bloquear quadra"
        descricao="Manutenção, evento ou torneio: a quadra fica fechada no período."
      >
        <form onSubmit={enviar}>
          <CorpoRolavel className="space-y-4 px-5 py-4">
            <SeletorDeQuadras
              quadras={quadrasDaArena(banco)}
              valor={quadrasIds}
              aoMudar={setQuadrasIds}
            />
            <Campo rotulo="Data" obrigatorio>
              <input
                type="date"
                value={data}
                min={HOJE}
                onChange={(e) => setData(e.target.value)}
                className="campo"
                required
              />
            </Campo>
            <CamposDeHora
              inicio={inicio}
              fim={fim}
              semAtalhos
              aoMudar={(novoInicio, novoFim) => {
                setInicio(novoInicio);
                setFim(novoFim);
              }}
            />
            <Campo
              rotulo="Descrição"
              obrigatorio
              ajuda="Aparece na agenda (ex.: Manutenção do saibro)."
            >
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="campo"
                placeholder="Ex.: Manutenção do saibro"
                maxLength={80}
              />
            </Campo>

            {jaBloqueada && (
              <Aviso tom="erro" titulo="Já existe um bloqueio nesse período">
                {rotuloDaQuadra(jaBloqueada.quadraId)} já está bloqueada das{" "}
                {jaBloqueada.horaInicio} às {jaBloqueada.horaFim} (
                {jaBloqueada.descricao ?? "sem descrição"}).
              </Aviso>
            )}
            {previa && !jaBloqueada && (
              <PreviaDoLote previa={previa} sigla="IAC (interesse da academia)" />
            )}
          </CorpoRolavel>
          <RodapeDoFormulario
            aoCancelar={aoFechar}
            rotuloConfirmar={
              previa && previa.aulas.length > 0
                ? `Bloquear e cancelar ${plural(previa.aulas.length, "aula", "aulas")}`
                : "Bloquear"
            }
            desabilitado={quadrasIds.length === 0 || !descricao.trim() || !valida}
            perigoso={(previa?.aulas.length ?? 0) > 0}
          />
        </form>
      </Modal>

      <Confirmacao
        aberto={aberto && confirmando}
        titulo="Confirmar bloqueio"
        mensagem={
          <>
            {plural(previa?.aulas.length ?? 0, "aula será cancelada", "aulas serão canceladas")} com
            IAC e {plural(previa?.alunos ?? 0, "aluno ganha", "alunos ganham")} reposição (
            {formatarMinutos(previa?.minutos ?? 0)} no total). Isso não tem volta.
          </>
        }
        rotuloConfirmar="Bloquear e cancelar"
        perigoso
        aoConfirmar={bloquear}
        aoCancelar={() => setConfirmando(false)}
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CabecalhoAluno } from "@/components/aluno/CabecalhoAluno";
import { CartaoCongelamento } from "@/components/aluno/CartaoCongelamento";
import { CartaoMatricula } from "@/components/aluno/CartaoMatricula";
import { ExtratoReposicao } from "@/components/aluno/ExtratoReposicao";
import { FormularioAluno } from "@/components/aluno/FormularioAluno";
import { HistoricoAlteracoes } from "@/components/aluno/HistoricoAlteracoes";
import { HistoricoAulas } from "@/components/aluno/HistoricoAulas";
import { HistoricoPagamentos } from "@/components/aluno/HistoricoPagamentos";
import { HorariosFixos } from "@/components/aluno/HorariosFixos";
import { IndicadoresAluno } from "@/components/aluno/IndicadoresAluno";
import { ConfirmarReativacaoDoCadastro, ModalInativar } from "@/components/aluno/ModaisCadastro";
import { ModalCongelar, ModalReativar } from "@/components/aluno/ModaisCongelamento";
import { FichaConsumo } from "@/components/consumo/FichaConsumo";
import { ComentariosDoRegistro } from "@/components/registro/ComentariosDoRegistro";
import { EstadoVazio } from "@/components/ui/EstadoVazio";
import { IconeBusca } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import {
  aulasDoAluno,
  congelamentosDoAluno,
  extratoDoAluno,
  historicoDeAulas,
  horariosFixosDoAluno,
  indicadoresDoAluno,
  matriculasDoAluno,
  pagamentosDoAluno,
  podeAlterarCadastros,
  proximasAulas,
  resumoDoAluno,
} from "@/lib/consultas/alunos";
import { useApp } from "@/store/AppStore";

type ModalDaFicha = "editar" | "congelar" | "reativar" | "inativar" | "reativar-cadastro";

/**
 * Ficha do aluno: cadastro, matricula, extrato de reposicao, congelamento,
 * historico de aulas e pagamentos, consumo, comentarios e historico de
 * alteracoes. Le tudo por `consultas/alunos.ts` e grava pelas operacoes de
 * `operacoes/alunos.ts`.
 */
export default function PaginaFichaAluno() {
  const { id } = useParams<{ id: string }>();
  const { banco, colaborador } = useApp();
  const [modal, setModal] = useState<ModalDaFicha | null>(null);
  const fechar = () => setModal(null);

  const ficha = useMemo(() => {
    const resumo = resumoDoAluno(banco, id, HOJE);
    if (!resumo) return undefined;
    const aulas = aulasDoAluno(banco, id);
    const historico = historicoDeAulas(aulas, HOJE);
    const pagamentos = pagamentosDoAluno(banco, id, HOJE);
    return {
      resumo,
      historico,
      proximas: proximasAulas(aulas, HOJE),
      pagamentos,
      indicadores: indicadoresDoAluno(banco, id, historico, pagamentos),
      extrato: extratoDoAluno(banco, id, HOJE),
      matriculas: matriculasDoAluno(banco, id, HOJE),
      congelamentos: congelamentosDoAluno(banco, id, HOJE),
      horarios: horariosFixosDoAluno(banco, id, HOJE),
    };
  }, [banco, id]);

  if (!ficha) {
    return (
      <EstadoVazio
        className="mx-auto max-w-lg"
        icone={<IconeBusca className="h-6 w-6" />}
        titulo="Aluno não encontrado"
        tituloDaPagina
        acoes={
          <Link href="/alunos" className="btn-secundario">
            Voltar para a lista de alunos
          </Link>
        }
      />
    );
  }

  const { resumo } = ficha;
  const { aluno } = resumo;
  // Hipotese H9: o perfil de professor so consulta.
  const podeEditar = podeAlterarCadastros(colaborador);
  const congelamentoAberto = resumo.congelamento ?? resumo.congelamentoAgendado;

  return (
    <div className="space-y-6">
      <CabecalhoAluno
        resumo={resumo}
        hoje={HOJE}
        podeEditar={podeEditar}
        aoEditar={() => setModal("editar")}
        aoCongelar={() => setModal("congelar")}
        aoReativarPlano={() => setModal("reativar")}
        aoInativar={() => setModal("inativar")}
        aoReativarCadastro={() => setModal("reativar-cadastro")}
      />
      {!podeEditar && (
        <p className="rounded-xl bg-areia-200/60 px-4 py-2.5 text-sm text-areia-700">
          Perfil de professor: a ficha é só para consulta (Hipótese H9).
        </p>
      )}

      <IndicadoresAluno indicadores={ficha.indicadores} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <CartaoMatricula resumo={resumo} matriculas={ficha.matriculas} podeEditar={podeEditar} />
          <HistoricoAulas aulas={ficha.historico} siglas={banco.configuracoes.siglas} />
          <HistoricoPagamentos pagamentos={ficha.pagamentos} />
          <HistoricoAlteracoes alunoId={aluno.id} />
        </div>

        <div className="min-w-0 space-y-6">
          <ExtratoReposicao
            extrato={ficha.extrato}
            siglas={banco.configuracoes.siglas}
            validadeMeses={banco.configuracoes.validadeReposicaoMeses}
            hoje={HOJE}
          />
          <CartaoCongelamento
            resumo={resumo}
            congelamentos={ficha.congelamentos}
            hoje={HOJE}
            podeEditar={podeEditar}
            aoCongelar={() => setModal("congelar")}
            aoReativar={() => setModal("reativar")}
          />
          <HorariosFixos horarios={ficha.horarios} proximas={ficha.proximas} />
          <FichaConsumo pessoaId={aluno.id} tipoPessoa="aluno" nomePessoa={aluno.nome} />
          <ComentariosDoRegistro
            entidade="aluno"
            entidadeId={aluno.id}
            descricao="Notas internas sobre o aluno, com autor e data."
          />
        </div>
      </div>

      {modal === "editar" && <FormularioAluno aberto aoFechar={fechar} aluno={aluno} />}
      {modal === "congelar" && <ModalCongelar aberto aoFechar={fechar} aluno={aluno} />}
      {modal === "reativar" && congelamentoAberto && (
        <ModalReativar aberto aoFechar={fechar} congelamento={congelamentoAberto} />
      )}
      {modal === "inativar" && <ModalInativar aberto aoFechar={fechar} aluno={aluno} />}
      {modal === "reativar-cadastro" && (
        <ConfirmarReativacaoDoCadastro aberto aoFechar={fechar} aluno={aluno} />
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { IconeEditar } from "@/components/aluno/Icones";
import { ROTULOS_PROFESSOR, rotuloDaRegraDeRepasse } from "@/components/aluno/estilos";
import { FichaConsumo } from "@/components/consumo/FichaConsumo";
import { AgendaDaSemana } from "@/components/professor/AgendaDaSemana";
import { AlunosDoProfessor } from "@/components/professor/AlunosDoProfessor";
import { FormularioProfessor } from "@/components/professor/FormularioProfessor";
import { RepasseDoProfessor } from "@/components/professor/RepasseDoProfessor";
import { ComentariosDoRegistro } from "@/components/registro/ComentariosDoRegistro";
import { HistoricoDoRegistro } from "@/components/registro/HistoricoDoRegistro";
import { Badge } from "@/components/ui/Badge";
import { LinkDeVolta } from "@/components/ui/CabecalhoDaPagina";
import { EstadoVazio } from "@/components/ui/EstadoVazio";
import {
  IconeAgenda,
  IconeBusca,
  IconeEmail,
  IconeFinanceiro,
  IconeRelogio,
  IconeTelefone,
  IconeUsuarios,
} from "@/components/ui/Icons";
import { StatCard } from "@/components/ui/StatCard";
import { HOJE } from "@/lib/banco/constantes";
import { podeAlterarCadastros } from "@/lib/consultas/alunos";
import { buscarProfessor } from "@/lib/consultas/base";
import {
  agendaDaSemana,
  alunosDoProfessor,
  repassesDoProfessor,
} from "@/lib/consultas/professores";
import { formatarDiaMes, inicioDaSemana, somarDias } from "@/lib/date";
import { formatarMinutos, formatarMoeda, iniciais } from "@/lib/theme";
import { useApp } from "@/store/AppStore";

/**
 * Ficha do professor: cadastro (com a regra de repasse), agenda da semana a
 * partir das aulas reais, alunos, repasse do mes (previsto x pago), consumo,
 * comentarios e historico de alteracoes.
 */
export default function PaginaFichaProfessor() {
  const { id } = useParams<{ id: string }>();
  const { banco, colaborador } = useApp();
  const [referencia, setReferencia] = useState(HOJE);
  const [editando, setEditando] = useState(false);

  const professor = buscarProfessor(banco, id);
  const semana = useMemo(() => agendaDaSemana(banco, id, referencia), [banco, id, referencia]);
  const alunos = useMemo(() => alunosDoProfessor(banco, id, HOJE), [banco, id]);
  const repasses = useMemo(() => repassesDoProfessor(banco, id, HOJE), [banco, id]);

  if (!professor) {
    return (
      <EstadoVazio
        className="mx-auto max-w-lg"
        icone={<IconeBusca className="h-6 w-6" />}
        titulo="Professor não encontrado"
        tituloDaPagina
        acoes={
          <Link href="/professores" className="btn-secundario">
            Voltar para a lista de professores
          </Link>
        }
      />
    );
  }

  const podeEditar = podeAlterarCadastros(colaborador);
  const segunda = inicioDaSemana(referencia);
  const periodoDaSemana = `${formatarDiaMes(segunda)} a ${formatarDiaMes(somarDias(segunda, 6))}`;
  const principais = alunos.filter((a) => a.principal).length;
  const mesAtual = repasses[0];

  return (
    <div className="space-y-6">
      <LinkDeVolta href="/professores">Professores</LinkDeVolta>

      <section className="card overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-saibro-600 via-saibro-500 to-saibro-700" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-5">
          <span
            className="-mt-12 flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-2xl font-semibold text-white shadow-card ring-2 ring-white sm:self-start"
            style={{ backgroundColor: professor.cor }}
            role="img"
            aria-label={professor.nome}
          >
            {iniciais(professor.nome)}
          </span>
          <div className="min-w-0 flex-1 sm:pt-2">
            <h1 className="flex flex-wrap items-center gap-2.5 text-2xl font-bold text-areia-900">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: professor.cor }}
                title="Cor do professor na agenda"
              />
              {professor.nome}
              {!professor.ativo && <Badge>Inativo</Badge>}
            </h1>
            <p className="mt-1 text-sm text-areia-600">
              {professor.especialidade || "Sem especialidade informada"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-areia-600">
              {professor.telefone && (
                <a
                  href={`tel:+55${professor.telefone.replace(/\D/g, "")}`}
                  className="flex items-center gap-1.5 hover:text-tijolo-700"
                >
                  <IconeTelefone className="h-4 w-4 text-areia-400" />
                  {professor.telefone}
                </a>
              )}
              {professor.email && (
                <a
                  href={`mailto:${professor.email}`}
                  className="flex min-w-0 items-center gap-1.5 break-all hover:text-tijolo-700"
                >
                  <IconeEmail className="h-4 w-4 shrink-0 text-areia-400" />
                  {professor.email}
                </a>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge cor="#9A4720" fundo="#FAE8DA" borda="#F3CEAF">
                Professor
              </Badge>
              <Badge>Repasse: {rotuloDaRegraDeRepasse(professor.repasse)}</Badge>
              <Badge>
                {principais === 1 ? "1 aluno principal" : `${principais} alunos principais`}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:pt-2">
            <Link
              href={`/agenda?professor=${professor.id}`}
              className="btn-primario w-full sm:w-auto"
            >
              <IconeAgenda className="h-4 w-4" />
              Ver agenda deste professor
            </Link>
            {podeEditar && (
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="btn-secundario w-full sm:w-auto"
              >
                <IconeEditar className="h-4 w-4" />
                Editar cadastro
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          rotulo="Aulas na semana"
          rotuloCurto="Aulas/sem"
          valor={String(semana.aulas)}
          detalhe={`${periodoDaSemana}${semana.canceladas > 0 ? ` · ${semana.canceladas} canceladas` : ""}`}
          icone={<IconeAgenda className="h-5 w-5" />}
          tom="saibro"
        />
        <StatCard
          rotulo="Horas na semana"
          rotuloCurto="Horas/sem"
          valor={formatarMinutos(semana.minutos)}
          detalhe="Somando as aulas que não foram canceladas"
          icone={<IconeRelogio className="h-5 w-5" />}
        />
        <StatCard
          rotulo="Alunos atendidos"
          rotuloCurto="Alunos"
          valor={String(semana.alunosAtendidos)}
          detalhe="Pessoas diferentes na semana"
          icone={<IconeUsuarios className="h-5 w-5" />}
        />
        <StatCard
          rotulo="Repasse do mês"
          rotuloCurto="Repasse"
          valor={formatarMoeda(mesAtual?.previsto ?? 0)}
          detalhe={`Previsto até hoje · ${mesAtual?.aulasDadas ?? 0} aulas dadas`}
          icone={<IconeFinanceiro className="h-5 w-5" />}
          tom="positivo"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <AgendaDaSemana
            semana={semana}
            referencia={referencia}
            hoje={HOJE}
            aoMudarReferencia={setReferencia}
          />
          <RepasseDoProfessor repasses={repasses} regra={professor.repasse} />
          <HistoricoDoRegistro tabela="professores" registroId={professor.id} rotulos={ROTULOS_PROFESSOR} />
        </div>

        <div className="min-w-0 space-y-6">
          <AlunosDoProfessor professorId={professor.id} alunos={alunos} />
          <FichaConsumo pessoaId={professor.id} tipoPessoa="professor" nomePessoa={professor.nome} />
          <ComentariosDoRegistro
            entidade="professor"
            entidadeId={professor.id}
            descricao="Notas internas sobre o professor, com autor e data."
          />
        </div>
      </div>

      {editando && (
        <FormularioProfessor aberto aoFechar={() => setEditando(false)} professor={professor} />
      )}
    </div>
  );
}

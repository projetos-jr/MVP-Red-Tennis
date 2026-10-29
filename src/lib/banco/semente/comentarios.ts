/**
 * Dados de exemplo: comentarios.
 * A maioria nas fichas dos alunos (como no MVP), mais alguns em aulas,
 * lancamentos e produtos para mostrar que qualquer registro pode ter
 * comentarios.
 */

import { somarDias } from "../../date";
import { HOJE } from "../constantes";
import type { Aluno, Colaborador, Comentario, Lancamento, Ocupacao } from "../tipos";
import { criarRng, doisDigitos, embaralhar, escolher, inteiro } from "./aleatorio";

const TEXTOS_ALUNO = [
  "Pediu para manter o horário fixo até o fim do semestre. Confirmado com o professor.",
  "Prefere ser avisado por WhatsApp quando houver risco de chuva.",
  "Evoluiu bem no saque; professor sugeriu subir de categoria na próxima apuração.",
  "Responsável financeiro é o pai — enviar cobranças para o contato secundário.",
  "Reclamou da iluminação da quadra 4 no horário das 21h. Repassado para manutenção.",
  "Tem interesse em entrar na turma de LAP das quintas.",
  "Solicitou reposição das aulas perdidas por chuva.",
  "Indicou dois amigos para aula experimental.",
  "Costuma chegar 10 minutos atrasado; professor já ajustou o aquecimento.",
  "Usa convênio — conferir mensalmente o valor do complemento.",
  "Pediu para congelar o plano durante as férias. Alinhado com a diretoria.",
  "Ótimo perfil para o torneio de duplas — convidar na próxima etapa.",
];

export function gerarComentarios(
  alunos: Aluno[],
  colaboradores: Colaborador[],
  ocupacoes: Ocupacao[],
  lancamentos: Lancamento[],
): Comentario[] {
  const comentarios: Comentario[] = [];

  alunos.forEach((aluno, indice) => {
    const rng = criarRng(1200 + indice * 61);
    const quantidade = inteiro(rng, 1, 3);
    embaralhar(rng, TEXTOS_ALUNO)
      .slice(0, quantidade)
      .forEach((texto, i) => {
        const autor = escolher(rng, colaboradores);
        const dia = somarDias(HOJE, -inteiro(rng, 2 + i * 12, 14 + i * 12));
        comentarios.push({
          id: `cm-${aluno.id}-${i}`,
          entidade: "aluno",
          entidadeId: aluno.id,
          texto,
          autorId: autor.id,
          autorNome: autor.nome,
          criadoEm: `${dia}T${doisDigitos(inteiro(rng, 8, 20))}:${escolher(rng, ["05", "17", "24", "38", "46", "52"])}:00`,
        });
      });
  });

  const [dono, recepcao] = colaboradores;

  const aulaDeAmanha = ocupacoes.find(
    (o) => o.data === somarDias(HOJE, 1) && o.tipo === "Individual",
  );
  if (aulaDeAmanha) {
    comentarios.push({
      id: "cm-oc-1",
      entidade: "ocupacao",
      entidadeId: aulaDeAmanha.id,
      texto: "Aluno pediu para começar 10 minutos mais tarde, se a quadra estiver livre antes.",
      autorId: recepcao.id,
      autorNome: recepcao.nome,
      criadoEm: `${HOJE}T09:12:00`,
    });
  }

  const bloqueio = ocupacoes.find((o) => o.tipo === "Bloqueio" && o.data > HOJE);
  if (bloqueio) {
    comentarios.push({
      id: "cm-oc-2",
      entidade: "ocupacao",
      entidadeId: bloqueio.id,
      texto: "Empreiteiro confirmou a chegada às 7h. Avisar os alunos afetados.",
      autorId: dono.id,
      autorNome: dono.nome,
      criadoEm: `${somarDias(HOJE, -1)}T17:40:00`,
    });
  }

  const mensalidadeAtrasada = lancamentos.find(
    (l) => l.categoria === "Mensalidade" && !l.pagoEm && l.vencimento < HOJE,
  );
  if (mensalidadeAtrasada) {
    comentarios.push({
      id: "cm-lc-1",
      entidade: "lancamento",
      entidadeId: mensalidadeAtrasada.id,
      texto: "Cobrado por WhatsApp. Prometeu pagar até sexta.",
      autorId: recepcao.id,
      autorNome: recepcao.nome,
      criadoEm: `${HOJE}T10:05:00`,
    });
  }

  comentarios.push({
    id: "cm-pr-1",
    entidade: "produto",
    entidadeId: "p12",
    texto: "Fornecedor sem estoque; nova entrega prevista para a semana que vem.",
    autorId: dono.id,
    autorNome: dono.nome,
    criadoEm: `${somarDias(HOJE, -2)}T15:30:00`,
  });

  return comentarios;
}

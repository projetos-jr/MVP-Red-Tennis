/**
 * Operacoes do financeiro: novo lancamento, registrar pagamento, anular,
 * gerar as mensalidades do mes e fechar o repasse dos professores.
 *
 * Seguem o modelo de `operacoes/base.ts`: funcao pura, `exigir(...)` com
 * mensagem clara e copias em vez de alterar objetos no lugar. Lancamento
 * nunca e apagado: anula-se, com motivo.
 */

import { formatarData } from "../../date";
import { definirOperacao } from "../executar";
import { matriculaVigente } from "../regras/alunos";
import { ErroDeRegra, exigir, novoId } from "../regras/comum";
import {
  categoriasDoTipo,
  competenciaValida,
  dataValida,
  emReais,
  garantirAcessoAoFinanceiro,
  mensalidadesAGerar,
  mesCurto,
  mesTerminado,
  nomeDoMes,
  repasseFechado,
  repasseJaLancado,
  repassePrevisto,
  reservaAguardandoPagamento,
} from "../regras/financeiro";
import type {
  CategoriaLancamento,
  Configuracoes,
  Lancamento,
  Repasse,
  TipoLancamento,
} from "../tipos";

/** Texto aparado; vazio vira `undefined` (campo opcional nao preenchido). */
function limpar(texto: string | undefined): string | undefined {
  const aparado = texto?.trim();
  return aparado ? aparado : undefined;
}

interface DadosDoPagamento {
  pagoEm?: string;
  formaPagamento?: string;
  valorConvenio?: number;
}

/**
 * Confere data, forma e parte do convenio de um pagamento. A parte do
 * convenio e so registro (sem integracao): nao pode passar do valor.
 */
function conferirPagamento(
  configuracoes: Configuracoes,
  dados: DadosDoPagamento,
  valor: number,
  hoje: string,
): DadosDoPagamento {
  const forma = limpar(dados.formaPagamento);
  if (forma) {
    exigir(
      configuracoes.formasPagamento.includes(forma),
      `Forma de pagamento desconhecida: ${forma}.`,
    );
  }

  if (dados.pagoEm) {
    exigir(dataValida(dados.pagoEm), "Informe uma data de pagamento válida.");
    exigir(dados.pagoEm <= hoje, "A data do pagamento não pode ser depois de hoje.");
    exigir(forma, "Escolha a forma de pagamento.");
  }

  let valorConvenio: number | undefined;
  if (dados.valorConvenio !== undefined && !Number.isNaN(dados.valorConvenio)) {
    exigir(
      Number.isFinite(dados.valorConvenio) && dados.valorConvenio >= 0,
      "A parte coberta pelo convênio não pode ser negativa.",
    );
    exigir(
      dados.valorConvenio <= valor,
      "A parte coberta pelo convênio não pode ser maior que o valor do lançamento.",
    );
    valorConvenio = dados.valorConvenio > 0 ? emReais(dados.valorConvenio) : undefined;
  }

  return { pagoEm: dados.pagoEm || undefined, formaPagamento: forma, valorConvenio };
}

// ---------------------------------------------------------------------------
// Novo lancamento
// ---------------------------------------------------------------------------

export interface DadosNovoLancamento {
  tipo: TipoLancamento;
  categoria: CategoriaLancamento;
  /** Aluno (a receber) ou professor (repasse lancado a mao). */
  pessoaId?: string;
  /** Quem pagou (a receber; pode ser outra pessoa) ou o favorecido (a pagar). */
  nomePagante?: string;
  item: string;
  valor: number;
  vencimento: string;
  formaPagamento?: string;
  /** So o nome do arquivo; o envio de verdade chega com o banco. */
  comprovante?: string;
  /** Preenchido quando o lancamento ja chega pago. */
  pagoEm?: string;
  valorConvenio?: number;
  /** Mes de referencia "YYYY-MM" — obrigatorio no repasse lancado a mao. */
  competencia?: string;
}

export const criarLancamento = definirOperacao(
  "Novo lançamento",
  (banco, dados: DadosNovoLancamento, ctx) => {
    garantirAcessoAoFinanceiro(banco.configuracoes, ctx.usuario, dados.tipo);
    exigir(
      categoriasDoTipo(dados.tipo).includes(dados.categoria),
      dados.tipo === "receber"
        ? "Escolha uma categoria de conta a receber."
        : "Escolha uma categoria de conta a pagar.",
    );
    const item = limpar(dados.item);
    exigir(item, "Descreva o item do lançamento.");
    exigir(
      Number.isFinite(dados.valor) && emReais(dados.valor) > 0,
      "O valor precisa ser maior que zero.",
    );
    const valor = emReais(dados.valor);
    exigir(dataValida(dados.vencimento), "Informe uma data de vencimento válida.");
    const pagamento = conferirPagamento(banco.configuracoes, dados, valor, ctx.hoje);

    const base: Lancamento = {
      id: novoId("lc"),
      tipo: dados.tipo,
      categoria: dados.categoria,
      item,
      valor,
      vencimento: dados.vencimento,
      ...pagamento,
      comprovante: limpar(dados.comprovante),
      criadoEm: ctx.agora,
    };

    let novo: Lancamento;
    if (dados.tipo === "receber") {
      const aluno = dados.pessoaId
        ? banco.alunos.find((a) => a.id === dados.pessoaId)
        : undefined;
      exigir(!dados.pessoaId || aluno, "Aluno não encontrado.");
      const nomePagante = limpar(dados.nomePagante) ?? aluno?.nome;
      exigir(nomePagante, "Escolha o aluno ou informe quem vai pagar.");
      novo = {
        ...base,
        nomePagante,
        ...(aluno ? { pessoaId: aluno.id, pessoaTipo: "aluno" as const } : {}),
      };

      // Mensalidade lancada a mao fica ligada a matricula, para que "Gerar
      // mensalidades" a reconheca e nao cobre o mesmo mes duas vezes.
      if (dados.categoria === "Mensalidade") {
        exigir(aluno, "Escolha o aluno da mensalidade.");
        const matricula = matriculaVigente(banco.matriculas, aluno.id, dados.vencimento);
        exigir(
          matricula,
          `${aluno.nome} não tem matrícula vigente em ${formatarData(dados.vencimento)}. ` +
            "Use outra categoria, como Aula avulsa.",
        );
        const competencia = dados.vencimento.slice(0, 7);
        const repetida = banco.lancamentos.some(
          (l) =>
            l.categoria === "Mensalidade" &&
            l.matriculaId === matricula.id &&
            l.competencia === competencia &&
            !l.canceladoEm,
        );
        exigir(
          !repetida,
          `Já existe a mensalidade de ${nomeDoMes(competencia)} de ${aluno.nome}. ` +
            "Para cobrar de novo, anule a anterior.",
        );
        novo = { ...novo, matriculaId: matricula.id, competencia };
      }
    } else if (dados.categoria === "Repasse") {
      const professor = banco.professores.find((p) => p.id === dados.pessoaId);
      exigir(professor, "Escolha o professor do repasse.");
      exigir(competenciaValida(dados.competencia), "Informe o mês de referência do repasse.");
      novo = {
        ...base,
        pessoaId: professor.id,
        pessoaTipo: "professor",
        nomePagante: limpar(dados.nomePagante) ?? professor.nome,
        competencia: dados.competencia,
      };
    } else {
      const favorecido = limpar(dados.nomePagante);
      exigir(favorecido, "Informe o favorecido (quem vai receber o pagamento).");
      novo = { ...base, nomePagante: favorecido };
    }

    return { ...banco, lancamentos: [...banco.lancamentos, novo] };
  },
);

// ---------------------------------------------------------------------------
// Registrar pagamento
// ---------------------------------------------------------------------------

export interface DadosPagamento {
  id: string;
  pagoEm: string;
  formaPagamento: string;
  valorConvenio?: number;
  comprovante?: string;
  /** Troca o "quem pagou" (ex.: quem veio pagar foi a mae). Vazio mantem o atual. */
  nomePagante?: string;
}

/**
 * Registra o pagamento. Convencao com a agenda: se o lancamento e de uma
 * reserva "aguardando pagamento", a reserva fica confirmada ("agendada") na
 * mesma operacao — tudo ou nada.
 */
export const registrarPagamento = definirOperacao(
  "Registrar pagamento",
  (banco, dados: DadosPagamento, ctx) => {
    const lancamento = banco.lancamentos.find((l) => l.id === dados.id);
    exigir(lancamento, "Lançamento não encontrado.");
    garantirAcessoAoFinanceiro(banco.configuracoes, ctx.usuario, lancamento.tipo);
    exigir(!lancamento.canceladoEm, "Este lançamento foi anulado e não pode ser pago.");
    if (lancamento.pagoEm) {
      throw new ErroDeRegra(
        `Este lançamento já foi pago em ${formatarData(lancamento.pagoEm)}.`,
      );
    }
    exigir(dados.pagoEm, "Informe a data do pagamento.");
    exigir(limpar(dados.formaPagamento), "Escolha a forma de pagamento.");
    const pagamento = conferirPagamento(banco.configuracoes, dados, lancamento.valor, ctx.hoje);

    const pago: Lancamento = {
      ...lancamento,
      ...pagamento,
      comprovante: limpar(dados.comprovante) ?? lancamento.comprovante,
      nomePagante: limpar(dados.nomePagante) ?? lancamento.nomePagante,
    };
    const reserva = reservaAguardandoPagamento(banco, lancamento);

    return {
      ...banco,
      lancamentos: banco.lancamentos.map((l) => (l.id === pago.id ? pago : l)),
      ocupacoes: reserva
        ? banco.ocupacoes.map((o) =>
            o.id === reserva.id ? { ...o, situacao: "agendada" as const } : o,
          )
        : banco.ocupacoes,
    };
  },
);

// ---------------------------------------------------------------------------
// Anular
// ---------------------------------------------------------------------------

/**
 * Anula o lancamento (nunca apaga): ele sai dos totais, mas continua na
 * lista e no historico, com quem anulou, quando e por que. Um lancamento ja
 * pago tambem pode ser anulado (estorno ou pagamento lancado por engano).
 */
export const anularLancamento = definirOperacao(
  "Anular lançamento",
  (banco, dados: { id: string; motivo: string }, ctx) => {
    const lancamento = banco.lancamentos.find((l) => l.id === dados.id);
    exigir(lancamento, "Lançamento não encontrado.");
    garantirAcessoAoFinanceiro(banco.configuracoes, ctx.usuario, lancamento.tipo);
    if (lancamento.canceladoEm) {
      throw new ErroDeRegra(
        `Este lançamento já foi anulado em ${formatarData(lancamento.canceladoEm)}.`,
      );
    }
    const motivo = limpar(dados.motivo);
    exigir(motivo, "Escreva o motivo da anulação.");
    exigir(
      !reservaAguardandoPagamento(banco, lancamento),
      "Esta cobrança é de uma reserva que ainda aguarda pagamento. " +
        "Registre o pagamento ou cancele a reserva na agenda.",
    );

    return {
      ...banco,
      lancamentos: banco.lancamentos.map((l) =>
        l.id === lancamento.id
          ? { ...l, canceladoEm: ctx.agora, motivoCancelamento: motivo }
          : l,
      ),
    };
  },
);

// ---------------------------------------------------------------------------
// Gerar mensalidades do mes
// ---------------------------------------------------------------------------

/**
 * Cria a mensalidade de cada matricula vigente que ainda nao tem a do mes
 * (regra em `mensalidadesAGerar`). Rodar de novo nao duplica: sem nada a
 * criar, o banco volta igual. Congelados (H4) recebem a cobranca normalmente.
 */
export const gerarMensalidades = definirOperacao(
  "Gerar mensalidades",
  (banco, dados: { competencia: string }, ctx) => {
    garantirAcessoAoFinanceiro(banco.configuracoes, ctx.usuario, "receber");
    exigir(competenciaValida(dados.competencia), "Escolha um mês válido.");
    const { novas } = mensalidadesAGerar(banco, dados.competencia);
    if (novas.length === 0) return banco;

    const alunos = new Map(banco.alunos.map((a) => [a.id, a]));
    const planos = new Map(banco.planos.map((p) => [p.id, p]));

    const mensalidades = novas.map(({ matricula, vencimento, valor, nomePagante }) => {
      const plano = planos.get(matricula.planoId);
      const lancamento: Lancamento = {
        id: novoId("lc"),
        tipo: "receber",
        categoria: "Mensalidade",
        pessoaId: matricula.alunoId,
        pessoaTipo: "aluno",
        nomePagante: nomePagante ?? alunos.get(matricula.alunoId)?.nome,
        item: `Mensalidade ${mesCurto(dados.competencia)}${plano ? ` · ${plano.nome}` : ""}`,
        valor,
        vencimento,
        competencia: dados.competencia,
        matriculaId: matricula.id,
        criadoEm: ctx.agora,
      };
      return lancamento;
    });

    return { ...banco, lancamentos: [...banco.lancamentos, ...mensalidades] };
  },
);

// ---------------------------------------------------------------------------
// Fechar o repasse do mes
// ---------------------------------------------------------------------------

/**
 * Fecha o repasse de um mes ja terminado: para cada professor com aulas
 * dadas e ainda sem fechamento, grava o `Repasse` (aulas e valor previsto
 * pela regra dele, H6) e lanca a conta a pagar com o que falta pagar.
 * Fechado, o mes nao fecha de novo; o valor fica congelado no fechamento.
 */
export const fecharRepasseDoMes = definirOperacao(
  "Fechar repasse do mês",
  (banco, dados: { competencia: string; vencimento: string }, ctx) => {
    garantirAcessoAoFinanceiro(banco.configuracoes, ctx.usuario, "pagar");
    exigir(competenciaValida(dados.competencia), "Escolha um mês válido.");
    const mes = nomeDoMes(dados.competencia);
    exigir(
      mesTerminado(dados.competencia, ctx.hoje),
      `Só dá para fechar o repasse de um mês que já terminou: ${mes} ainda não acabou.`,
    );
    exigir(dataValida(dados.vencimento), "Informe a data de pagamento do repasse.");

    const comAulas = banco.professores
      .map((professor) => ({
        professor,
        previsto: repassePrevisto(banco, professor.id, dados.competencia),
      }))
      .filter(({ previsto }) => previsto.aulasDadas > 0);
    exigir(comAulas.length > 0, `Nenhum professor deu aulas em ${mes}.`);

    const aFechar = comAulas.filter(
      ({ professor }) => !repasseFechado(banco, professor.id, dados.competencia),
    );
    exigir(aFechar.length > 0, `O repasse de ${mes} já foi fechado.`);

    const repasses: Repasse[] = [];
    const contas: Lancamento[] = [];
    aFechar.forEach(({ professor, previsto }) => {
      const repasse: Repasse = {
        id: novoId("rep"),
        professorId: professor.id,
        competencia: dados.competencia,
        aulasDadas: previsto.aulasDadas,
        minutosDados: previsto.minutosDados,
        valorPrevisto: previsto.valorPrevisto,
        fechadoEm: ctx.agora,
      };
      repasses.push(repasse);

      const falta = emReais(
        previsto.valorPrevisto - repasseJaLancado(banco, professor.id, dados.competencia),
      );
      if (falta <= 0) return;
      contas.push({
        id: novoId("lc"),
        tipo: "pagar",
        categoria: "Repasse",
        pessoaId: professor.id,
        pessoaTipo: "professor",
        nomePagante: professor.nome,
        item: `Repasse ${mesCurto(dados.competencia)} · ${previsto.aulasDadas} aulas`,
        valor: falta,
        vencimento: dados.vencimento,
        competencia: dados.competencia,
        repasseId: repasse.id,
        criadoEm: ctx.agora,
      });
    });

    return {
      ...banco,
      repasses: [...banco.repasses, ...repasses],
      lancamentos: contas.length ? [...banco.lancamentos, ...contas] : banco.lancamentos,
    };
  },
);

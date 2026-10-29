"use client";

import { useId, type FormEvent, type ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/Card";

/**
 * Pecas da tela de Configuracoes: cada parametro aparece com nome, explicacao
 * simples e o selo da hipotese (H#) que ele representa.
 */

const TEXTO_DAS_HIPOTESES: Record<number, string> = {
  1: "H1 — siglas de reposição",
  2: "H2 — plano amarelo (Plano de locação)",
  3: "H3 — duas tabelas de planos",
  5: "H5 — reserva sem pagamento",
  6: "H6 — repasse ao professor",
  7: "H7 — pontuação do ranking",
  8: "H8 — regras de torneio",
  9: "H9 — perfis de acesso",
  10: "H10 — professor em duas aulas",
  12: "H12 — até quando a agenda é criada",
  13: "H13 — prazo para pagar o consumo",
};

/** Selo "H5": regra que a arena ainda não confirmou (seção 4 do documento de modelo). */
export function SeloHipotese({ numero }: { numero: number }) {
  return (
    <span
      className="chip border border-saibro-200 bg-saibro-50 px-2 py-0.5 text-[10px] font-semibold text-saibro-800"
      title={`Hipótese ${TEXTO_DAS_HIPOTESES[numero] ?? `H${numero}`}: regra ainda a confirmar com a arena`}
    >
      H{numero}
      <span className="sr-only"> (hipótese ainda a confirmar com a arena)</span>
    </span>
  );
}

/** Cartao de uma secao, com ancora para o menu lateral. */
export function SecaoDeConfiguracao({
  id,
  titulo,
  descricao,
  icone,
  acao,
  children,
}: {
  id: string;
  titulo: string;
  descricao: string;
  icone: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32" aria-label={titulo}>
      <Card>
        <CardHeader titulo={titulo} descricao={descricao} icone={icone} acao={acao} />
        {children}
      </Card>
    </section>
  );
}

/**
 * Linha de um parametro: explicacao a esquerda, controle a direita (no
 * celular, um embaixo do outro). `children` recebe o id para ligar o rotulo.
 */
export function CampoDeConfiguracao({
  rotulo,
  hipotese,
  ajuda,
  erro,
  children,
}: {
  rotulo: string;
  hipotese?: number;
  ajuda: ReactNode;
  erro?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="grid gap-x-8 gap-y-2.5 px-5 py-4 md:grid-cols-[minmax(0,1fr)_15rem] md:items-start">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="text-sm font-semibold text-areia-900">
            {rotulo}
          </label>
          {hipotese !== undefined && <SeloHipotese numero={hipotese} />}
        </div>
        <p id={`${id}-ajuda`} className="mt-1 text-xs leading-relaxed text-areia-600">
          {ajuda}
        </p>
      </div>
      <div>
        {children(id)}
        {erro && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-tijolo-700">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}

/** Campo numerico com a unidade escrita ao lado ("horas", "R$"). */
export function EntradaComUnidade({
  id,
  valor,
  aoMudar,
  unidade,
  antes,
  passo = 1,
  invalido,
}: {
  id: string;
  valor: string;
  aoMudar: (valor: string) => void;
  unidade?: string;
  /** Texto antes do numero ("R$"). */
  antes?: string;
  passo?: number;
  invalido?: boolean;
}) {
  return (
    <div className="relative">
      {antes && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-areia-500">
          {antes}
        </span>
      )}
      <input
        id={id}
        type="number"
        inputMode={passo < 1 ? "decimal" : "numeric"}
        step={passo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        aria-describedby={`${id}-ajuda`}
        aria-invalid={invalido || undefined}
        className={`campo tabular-nums ${antes ? "pl-10" : ""} ${unidade ? "pr-20" : ""} ${
          invalido ? "border-tijolo-400 focus:border-tijolo-500 focus:ring-tijolo-500/20" : ""
        }`}
      />
      {unidade && (
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-areia-500">
          {unidade}
        </span>
      )}
    </div>
  );
}

/** Chave de liga/desliga. O texto "Sim"/"Não" acompanha a posicao (cor nunca sozinha). */
export function Interruptor({
  id,
  ligado,
  aoMudar,
}: {
  id: string;
  ligado: boolean;
  aoMudar: (ligado: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 md:justify-end">
      <span className={`text-sm font-medium ${ligado ? "text-tijolo-700" : "text-areia-500"}`} aria-hidden="true">
        {ligado ? "Sim" : "Não"}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-describedby={`${id}-ajuda`}
        onClick={() => aoMudar(!ligado)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
          ligado ? "border-tijolo-600 bg-tijolo-600" : "border-areia-300 bg-areia-200"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            ligado ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

/** Rodape de um formulario de secao: diz se ha algo por salvar e oferece desfazer. */
export function RodapeDeSalvar({
  alterado,
  aoDesfazer,
  rotulo = "Salvar alterações",
}: {
  alterado: boolean;
  aoDesfazer: () => void;
  rotulo?: string;
}) {
  return (
    <footer className="flex flex-col-reverse gap-3 border-t border-areia-200 bg-areia-50/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-areia-600" aria-live="polite">
        {alterado ? "Há alterações ainda não salvas." : "Sem alterações pendentes."}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={aoDesfazer} disabled={!alterado} className="btn-secundario flex-1 sm:flex-none">
          Desfazer
        </button>
        <button type="submit" disabled={!alterado} className="btn-primario flex-1 sm:flex-none">
          {rotulo}
        </button>
      </div>
    </footer>
  );
}

/** Formulario sem a validacao nativa do navegador: quem recusa e a regra, com mensagem clara. */
export function FormularioDeSecao({
  aoSalvar,
  children,
}: {
  aoSalvar: () => void;
  children: ReactNode;
}) {
  function enviar(evento: FormEvent) {
    evento.preventDefault();
    aoSalvar();
  }
  return (
    <form onSubmit={enviar} noValidate>
      {children}
    </form>
  );
}

/** Texto do campo -> numero. Vazio vira NaN, que a regra recusa com mensagem. */
export function paraNumero(texto: string): number {
  return texto.trim() === "" ? Number.NaN : Number(texto.replace(",", "."));
}

/** Validacao de conforto: a que vale e a da operacao. */
export function erroDeInteiro(texto: string, minimo: number, mensagem: string): string | undefined {
  const numero = paraNumero(texto);
  return Number.isInteger(numero) && numero >= minimo ? undefined : mensagem;
}

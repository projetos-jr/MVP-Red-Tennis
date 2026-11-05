import { BolaDeTenis } from "./BolaDeTenis";

/**
 * Botao de entrar em forma de bola de tenis, ao lado do campo de senha, como
 * no sistema antigo da arena. A palavra "Entrar" fica escrita logo embaixo da
 * bola (e faz parte do botao: clicar nela tambem entra).
 *
 * - `type="submit"`: Enter no campo de senha tambem entra.
 * - Mouse por cima: a bola sobe um pouco e gira (so com movimento liberado).
 * - Entrando: a bola gira sem parar e o texto vira "Entrando…".
 *
 * O texto embaixo e posicionado por fora da caixa do botao: quem usa deixa
 * espaco abaixo da linha (ex.: `mb-9`).
 */
export function BotaoBola({
  entrando = false,
  desabilitado = false,
  rotuloAcessivel = "Entrar",
}: {
  entrando?: boolean;
  desabilitado?: boolean;
  /** Nome do botao para o leitor de tela; deve comecar com "Entrar". */
  rotuloAcessivel?: string;
}) {
  const parado = desabilitado && !entrando;
  return (
    <button
      type="submit"
      disabled={desabilitado || entrando}
      aria-label={entrando ? "Entrando…" : rotuloAcessivel}
      aria-busy={entrando || undefined}
      className="group relative h-[4.5rem] w-[4.5rem] shrink-0 rounded-full disabled:cursor-not-allowed sm:h-20 sm:w-20"
    >
      {/* Sombra da bola no chao: diminui quando a bola sobe. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-2 -bottom-1 h-3 rounded-[50%] bg-areia-900/25 blur-[3px] transition-transform duration-300 motion-safe:group-hover:scale-x-75 motion-reduce:transition-none group-disabled:scale-x-100"
      />
      <BolaDeTenis
        apagada={parado}
        className={`relative h-full w-full drop-shadow-md transition-transform duration-500 ease-out motion-reduce:transition-none ${
          entrando
            ? "motion-safe:animate-spin motion-safe:[animation-duration:1.1s]"
            : "motion-safe:group-hover:-translate-y-1.5 motion-safe:group-hover:rotate-[160deg] motion-safe:group-active:scale-95 group-disabled:translate-y-0 group-disabled:rotate-0"
        }`}
      />
      <span
        aria-hidden="true"
        className={`absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap font-display text-xl font-bold leading-none ${
          parado ? "text-areia-600" : "text-areia-900 group-hover:text-saibro-700"
        }`}
      >
        {entrando ? "Entrando…" : "Entrar"}
      </span>
    </button>
  );
}

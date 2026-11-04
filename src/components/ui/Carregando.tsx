/**
 * "Carregando…": o mesmo aviso enquanto uma tela é montada (na casca do
 * sistema e no `Suspense` das telas que leem o endereço). Quando os dados
 * vierem do Supabase, é este o aviso que aparece durante a busca.
 *
 * Quem pulsa é a bolinha (a bola de tênis), não o texto: texto apagado
 * fica ilegível.
 */
export function Carregando({ telaInteira }: { telaInteira?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center ${telaInteira ? "fundo-arena min-h-screen" : "min-h-[50vh]"}`}
    >
      <p className="flex items-center gap-2 text-sm font-medium text-areia-600" role="status">
        <span
          aria-hidden="true"
          className="h-3 w-3 rounded-full border border-bola-700 bg-bola-300 motion-safe:animate-pulse"
        />
        Carregando…
      </p>
    </div>
  );
}

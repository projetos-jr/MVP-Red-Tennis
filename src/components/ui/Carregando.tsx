/**
 * "Carregando…": o mesmo aviso enquanto uma tela é montada (na casca do
 * sistema e no `Suspense` das telas que leem o endereço). Quando os dados
 * vierem do Supabase, é este o aviso que aparece durante a busca.
 */
export function Carregando({ telaInteira }: { telaInteira?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center ${telaInteira ? "fundo-arena min-h-screen" : "min-h-[50vh]"}`}
    >
      <p className="animate-pulse text-sm font-medium text-areia-500" role="status">
        Carregando…
      </p>
    </div>
  );
}

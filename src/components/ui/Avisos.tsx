"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { IconeAlerta, IconeCheck, IconeFechar } from "./Icons";

export type TipoAviso = "sucesso" | "erro" | "info";

interface Aviso {
  id: number;
  tipo: TipoAviso;
  texto: string;
}

interface ContextoAvisos {
  avisar: (tipo: TipoAviso, texto: string) => void;
}

const Contexto = createContext<ContextoAvisos | null>(null);

const ESTILO: Record<TipoAviso, string> = {
  sucesso: "border-emerald-200 bg-emerald-50 text-emerald-900",
  erro: "border-tijolo-200 bg-tijolo-50 text-tijolo-900",
  info: "border-areia-300 bg-white text-areia-900",
};

let proximoId = 1;

/**
 * Avisos rapidos no canto da tela ("Aula cancelada.", "A quadra 2 já está
 * ocupada..."). Erros ficam ate a pessoa fechar; os demais somem sozinhos.
 */
export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const fechar = useCallback((id: number) => {
    setAvisos((atual) => atual.filter((a) => a.id !== id));
  }, []);

  const avisar = useCallback(
    (tipo: TipoAviso, texto: string) => {
      const id = proximoId++;
      setAvisos((atual) => [...atual.slice(-3), { id, tipo, texto }]);
      if (tipo !== "erro") window.setTimeout(() => fechar(id), 5000);
    },
    [fechar],
  );

  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-20 z-[60] flex flex-col items-end gap-2 md:bottom-6 md:left-auto md:right-6 md:w-96"
        aria-live="polite"
      >
        {avisos.map((aviso) => (
          <div
            key={aviso.id}
            role={aviso.tipo === "erro" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full animate-fade-up items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-card-hover ${ESTILO[aviso.tipo]}`}
          >
            {aviso.tipo === "erro" ? (
              <IconeAlerta className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <IconeCheck className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p className="flex-1 leading-snug">{aviso.texto}</p>
            <button
              type="button"
              onClick={() => fechar(aviso.id)}
              className="-mr-1 shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
              aria-label="Fechar aviso"
            >
              <IconeFechar className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useAvisos(): ContextoAvisos {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useAvisos precisa estar dentro de <AvisosProvider>.");
  return contexto;
}

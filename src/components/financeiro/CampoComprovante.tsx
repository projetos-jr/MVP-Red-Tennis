"use client";

import { useId } from "react";

/**
 * Comprovante do pagamento. Por enquanto guarda só o NOME do arquivo
 * escolhido; o envio de verdade (armazenamento do Supabase) chega com o banco.
 */
export function CampoComprovante({
  nome,
  aoEscolher,
}: {
  nome: string;
  aoEscolher: (nome: string) => void;
}) {
  const id = useId();
  const ajuda = `${id}-ajuda`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-areia-800">
        Comprovante
      </label>
      <input
        id={id}
        type="file"
        accept="image/*,application/pdf"
        aria-describedby={ajuda}
        onChange={(e) => aoEscolher(e.target.files?.[0]?.name ?? "")}
        className="block w-full rounded-xl border border-dashed border-areia-300 bg-white p-1.5 text-sm text-areia-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-saibro-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-saibro-800 hover:file:bg-saibro-100"
      />
      <span id={ajuda} className="mt-1 block text-xs text-areia-500">
        {nome ? (
          <>
            Arquivo: <strong className="font-medium text-areia-700">{nome}</strong>.{" "}
          </>
        ) : (
          "Opcional. "
        )}
        Por enquanto o sistema guarda só o nome do arquivo.
      </span>
    </div>
  );
}

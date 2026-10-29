"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { IconeRelogio } from "@/components/ui/Icons";
import type { RegistroAuditoria, TabelaDoBanco } from "@/lib/banco/tipos";
import { historicoDoRegistro } from "@/lib/consultas/base";
import { formatarValorDoCampo, rotuloDoCampo } from "@/lib/consultas/configuracoes";
import { formatarDataHora } from "@/lib/date";
import { useApp } from "@/store/AppStore";

const ACAO: Record<RegistroAuditoria["acao"], string> = {
  criar: "Criou",
  alterar: "Alterou",
  apagar: "Apagou",
};

/** Campos que mudaram numa alteracao. */
export function camposAlterados(
  registro: RegistroAuditoria,
): Array<{ campo: string; antes: unknown; depois: unknown }> {
  if (registro.acao !== "alterar") return [];
  const antes = (registro.antes ?? {}) as Record<string, unknown>;
  const depois = (registro.depois ?? {}) as Record<string, unknown>;
  const campos = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  return [...campos]
    .filter((campo) => JSON.stringify(antes[campo]) !== JSON.stringify(depois[campo]))
    .map((campo) => ({ campo, antes: antes[campo], depois: depois[campo] }));
}

/**
 * Quem fez o que num registro, e quando — lido da auditoria automatica.
 * Nomes de campos e valores saem em linguagem simples (os mesmos da tela de
 * Historico); `rotulos` troca o nome de um campo quando a tela pede outro.
 */
export function HistoricoDoRegistro({
  tabela,
  registroId,
  rotulos = {},
  semCartao,
}: {
  tabela: TabelaDoBanco;
  registroId: string;
  rotulos?: Record<string, string>;
  semCartao?: boolean;
}) {
  const { banco } = useApp();
  const registros = historicoDoRegistro(banco, tabela, registroId);

  const lista = (
    <ul className="divide-y divide-areia-100">
      {registros.map((registro) => (
        <li key={registro.id} className="px-4 py-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-areia-800">
              {ACAO[registro.acao]} · {registro.operacao}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-areia-500">
              {formatarDataHora(registro.em)}
            </span>
          </div>
          <p className="text-xs text-areia-500">por {registro.usuarioNome}</p>
          {camposAlterados(registro).length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs text-areia-700">
              {camposAlterados(registro).map(({ campo, antes, depois }) => (
                <li key={campo}>
                  <span className="font-medium">{rotulos[campo] ?? rotuloDoCampo(campo)}:</span>{" "}
                  {formatarValorDoCampo(banco, campo, antes)} →{" "}
                  {formatarValorDoCampo(banco, campo, depois)}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}

      {registros.length === 0 && (
        <li className="px-4 py-6 text-center text-sm text-areia-500">
          Nenhuma alteração registrada nesta sessão.
        </li>
      )}
    </ul>
  );

  if (semCartao) return lista;

  return (
    <Card>
      <CardHeader
        titulo="Histórico"
        descricao="Quem alterou este registro, e quando."
        icone={<IconeRelogio className="h-5 w-5" />}
      />
      {lista}
    </Card>
  );
}

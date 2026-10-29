"use client";

import { useMemo, useState } from "react";
import { HistoricoDoRegistro } from "@/components/registro/HistoricoDoRegistro";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeRelogio } from "@/components/ui/Icons";
import { Segmentado } from "@/components/ui/Segmentado";
import { registrosDoAlunoComHistorico } from "@/lib/consultas/alunos";
import { useApp } from "@/store/AppStore";
import { ROTULOS_ALUNO, ROTULOS_CONGELAMENTO, ROTULOS_MATRICULA } from "./estilos";

type Aba = "cadastro" | "matricula";

/**
 * Quem alterou o cadastro, as matriculas e os congelamentos do aluno, e
 * quando (lido da auditoria automatica).
 */
export function HistoricoAlteracoes({ alunoId }: { alunoId: string }) {
  const { banco } = useApp();
  const [aba, setAba] = useState<Aba>("cadastro");
  const registros = useMemo(() => registrosDoAlunoComHistorico(banco, alunoId), [banco, alunoId]);

  return (
    <Card>
      <CardHeader
        titulo="Histórico de alterações"
        descricao="Quem mudou o cadastro, a matrícula e os congelamentos, e quando."
        icone={<IconeRelogio className="h-5 w-5" />}
        acao={
          <Segmentado
            aria="Escolher o histórico"
            valor={aba}
            aoMudar={setAba}
            opcoes={[
              { valor: "cadastro", rotulo: "Cadastro" },
              { valor: "matricula", rotulo: `Matrícula${registros.length > 0 ? ` (${registros.length})` : ""}` },
            ]}
          />
        }
      />

      {aba === "cadastro" ? (
        <HistoricoDoRegistro tabela="alunos" registroId={alunoId} rotulos={ROTULOS_ALUNO} semCartao />
      ) : registros.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-areia-500">
          Nenhuma alteração na matrícula ou nos congelamentos nesta sessão.
        </p>
      ) : (
        <div className="divide-y divide-areia-200">
          {registros.map((registro) => (
            <section key={`${registro.tabela}-${registro.registroId}`}>
              <h3 className="bg-areia-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-areia-600">
                {registro.titulo}
              </h3>
              <HistoricoDoRegistro
                tabela={registro.tabela}
                registroId={registro.registroId}
                rotulos={registro.tabela === "matriculas" ? ROTULOS_MATRICULA : ROTULOS_CONGELAMENTO}
                semCartao
              />
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

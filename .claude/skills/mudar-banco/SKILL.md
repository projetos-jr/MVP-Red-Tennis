---
name: mudar-banco
description: Guia para mudar o banco de dados do sistema Red Tennis (Supabase/Postgres) do jeito seguro do projeto — migração nova versionada em supabase/migrations, RLS, auditoria, testes pgTAP e publicação. Use sempre que a tarefa envolver criar ou alterar tabela, coluna, índice, constraint, view, função do Postgres, política de acesso (RLS), gatilho, pg_cron ou dados fixos do banco, mesmo que a pessoa não fale em "migração" (por exemplo, "o banco precisa guardar o CPF do aluno", "a recepção tem que poder ver X", "criar uma regra que impeça Y no banco", "corrigir a função cancelar_ocupacao").
---

# Mudar o banco (Supabase) com segurança

O banco é onde as regras críticas valem de verdade ("uma tela pode ser burlada; o banco
não"). Por isso toda mudança segue o mesmo caminho: migração nova → testes → pull request →
CI verde → publicação automática no ambiente de teste → produção só com aprovação.
A equipe não tem formação técnica: explique cada passo em linguagem simples e diga como
conferir.

## Antes de escrever qualquer SQL

1. Leia `docs/BANCO.md` (o que o banco garante, RLS, funções) e a migração do modelo
   (`supabase/migrations/20261029234500_modelo_novo.sql`) na parte da tabela envolvida.
2. Confira se a mudança depende de uma regra de negócio ainda em aberto (hipóteses H1–H14 em
   `docs/MODELO-E-TELAS.md`, pendências em `docs/privado/CONTEXTO-COMPLETO-RED-TENNIS.md`
   seção 13). Se faltar regra, não invente: aponte a lacuna, sugira a pergunta ao cliente e,
   se der para seguir, use um valor configurável (coluna em `configuracoes`) e registre a
   hipótese.
3. Veja o estado real: liste as migrações (`ls supabase/migrations`) e, se houver conector do
   Supabase, `list_migrations`/`list_tables` do projeto de teste (`mpmbnwqaiqgoojdtmrqr`).

## Regras que não se negociam (e por quê)

- **Migração nova, nunca editar uma existente.** O banco guarda quais migrações já rodaram;
  editar uma antiga faz o teste e a produção divergirem sem ninguém perceber. Nome:
  `supabase/migrations/AAAAMMDDHHMMSS_o_que_faz.sql`, com data/hora maior que a última.
- **RLS em toda tabela nova, desde a criação**, com política por perfil usando
  `privado.tem_acesso('<módulo>')` para ler e `privado.pode_gravar('<módulo>')` para gravar
  (veja como as tabelas existentes fazem). Sem política, ninguém vê nada; com política
  frouxa, o professor veria valores financeiros (dados de alunos, LGPD). Nunca desligue RLS.
- **Auditoria**: tabela de negócio nova recebe o gatilho
  `create trigger auditar after insert or update or delete on public.<tabela> for each row execute function privado.registrar_auditoria();`
- **Função que a tela chama** (operação que grava em várias tabelas): `security invoker`,
  `set search_path = ''`, nomes qualificados (`public.`, `privado.`), começa com
  `perform privado.iniciar_operacao('<Nome da operação na tela>', '<módulo>');`, recusa com
  `perform privado.recusar('<mesma mensagem que a tela mostra>');`, usa `privado.hoje()` em vez
  de `current_date`, e termina com `revoke execute ... from public, anon; grant execute ... to authenticated;`.
  `security definer` só com motivo forte (ex.: rotina do pg_cron), no schema `privado`.
- **Datas**: `timestamptz` para momento, `date` para dia; fuso `America/Sao_Paulo`. Aulas
  recorrentes viram uma linha por data.
- **Nada direto em produção**, nem "só um ajuste rápido" pelo painel: o que não está na
  migração some na próxima instalação (e o cliente precisa conseguir reinstalar sozinho).
- **Segredos**: nunca peça senha do banco, chave `service_role`/secret ou string de conexão.

## Testes (pgTAP)

Todo comportamento novo ganha teste em `supabase/tests/NN_assunto.test.sql`, no estilo dos
existentes: `begin; select plan(N); ... select * from finish(); rollback;`. Cubra o caminho
certo, cada recusa importante e pelo menos um teste de permissão (perfil que não pode, recusado),
usando o padrão `pg_temp.entrar_como(...)` de `supabase/tests/20_permissoes.test.sql`.

Rodar (precisa do Docker):

```bash
npx supabase start
npx supabase db reset   # aplica todas as migrações num banco limpo (+ dados de exemplo, se gerados)
npx supabase test db
```

Se a mudança afeta o que a tela grava, rode também os testes de integração
(`npm run test:integracao`, instruções em `src/lib/supabase/integracao/ambiente.ts`) e, se
mudou um campo de tabela, ajuste `src/lib/banco/tipos.ts`, a conversão em
`src/lib/supabase/conversao.ts` (`COLUNAS_OPCIONAIS`) e os dados de exemplo
(`src/lib/banco/semente/`) — o front e o banco usam o mesmo modelo.

## Entrega

1. Branch `<numero-issue>-<nome-curto>`, commit, pull request com: o que mudou (em linguagem
   simples), como testar, "Fecha #N".
2. O CI (`job banco`) aplica todas as migrações num banco limpo e roda os testes. Só faça
   merge com ele verde e com revisão de outro consultor.
3. Depois do merge, o workflow `publicar-banco` aplica a migração no projeto de **teste**
   sozinho. Produção: Actions → publicar-banco → `producao`, com aprovação (ver
   `docs/AMBIENTES.md`).
4. Atualize `docs/BANCO.md` e a seção "No banco (funções)" do módulo em `docs/modulos/`.

Ao terminar, diga à pessoa, separadamente: o que foi **proposto**, o que foi **feito**, o que
foi **testado** (e onde) e o que ainda precisa ser **validado** por alguém.

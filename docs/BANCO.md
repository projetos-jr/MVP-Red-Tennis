# Banco de dados (Supabase)

O banco segue o mesmo modelo do front (`src/lib/banco/tipos.ts`), com os
nomes em snake_case. O front **ainda não está ligado** ao banco: isso é o
próximo passo.

## Onde está cada coisa

| O quê | Onde |
| --- | --- |
| Migrações (a única forma de mudar o banco) | `supabase/migrations/` |
| Testes do banco (pgTAP) | `supabase/tests/` |
| Configuração do Supabase local | `supabase/config.toml` |
| Gerador dos dados de exemplo | `scripts/gerar-seed.ts` (`npm run banco:seed`) |
| Funções de cada módulo (o que a tela chama) | seção "No banco (funções)" de cada arquivo em `docs/modulos/` |

As duas primeiras migrações (28/10) criaram a estrutura do MVP antigo e já
estão aplicadas no projeto `xfludepkrcnwovnckpfc`. A terceira,
`20261029234500_modelo_novo.sql`, apaga essas tabelas (estavam vazias) e cria
o modelo novo. As seguintes (`20261030120000` a `20261030120400`) criam as
funções de cada módulo. Migração aplicada nunca é editada: mudanças vêm sempre
numa migração nova.

## O que o banco garante sozinho

Uma tela pode ser burlada; o banco não. Estas regras valem para qualquer
gravação, venha de onde vier:

- **Conflito de quadra:** duas ocupações ativas nunca dividem a mesma quadra no
  mesmo horário. Bloqueios entram na mesma regra; canceladas não contam; uma
  aula que termina às 11:00 não conflita com outra que começa às 11:00
  (constraint `ocupacoes_sem_conflito`, com `btree_gist`).
- **Horário de funcionamento:** só entre 07:00 e 22:00.
- **Cancelar exige motivo; anular lançamento exige motivo.** Lançamentos não
  se apagam.
- **Estoque nunca negativo:** o gatilho `movimentos_estoque_saldo` recusa a
  saída maior que o saldo, com a mensagem "Só há N unidade(s)…". O saldo é a
  soma dos movimentos (view `saldo_estoque`).
- **Matrícula:** um aluno nunca tem duas matrículas vigentes ao mesmo tempo.
- **Mensalidade:** uma por matrícula por mês (gerar de novo não duplica).
- **Financeiro:** categoria combina com o tipo (a receber ou a pagar), valor
  maior que zero, pagamento com forma de pagamento. A situação (pago,
  pendente, em atraso, anulado) é calculada na view `lancamentos_com_situacao`.
- **Reposição:** todo crédito tem validade; uso não tem. O saldo é calculado,
  nunca guardado.
- **Auditoria:** toda criação, alteração e exclusão nas tabelas de negócio é
  gravada em `auditoria` por um gatilho único (quem, quando, antes e depois).
  Ninguém edita nem apaga o histórico.

## Quem vê e quem grava (RLS)

RLS ligado em todas as tabelas. Anônimos não veem nada. Para os colaboradores,
vale a matriz de permissões das Configurações (coluna
`configuracoes.permissoes`, hipótese H9):

- **Ler** um módulo: o perfil precisa enxergá-lo.
- **Gravar**: precisa enxergar **e** não ser professor (o professor só consulta).
- **Contas a pagar e repasses:** só quem tem `financeiro_pagar` (o dono).
- **Histórico de alterações:** só quem tem `historico` (o dono).
- **Configurações e planos:** só o dono altera.
- **Comentários:** todos leem; cada um edita e apaga só os seus.
- **Colaboradores:** cadastrados pelo painel do Supabase (ver abaixo).

Ainda falta (depende de a arena confirmar a H9): limitar o professor às
próprias aulas e aos próprios alunos linha a linha. Hoje ele vê a agenda e os
alunos inteiros, mas não vê valores (financeiro e consumo).

## Testes

Os testes do banco ficam em `supabase/tests/` e rodam no CI a cada pull request
(job `banco`): o CI sobe o Supabase local, aplica todas as migrações num banco
limpo e roda os testes. Hoje são 361: as regras das tabelas (conflito de
quadra, estoque, matrículas, financeiro), o que cada perfil vê e grava, a
auditoria e cada função de operação (caminho certo e cada recusa importante).

Para rodar na sua máquina (precisa do Docker):

```bash
npx supabase start
npx supabase test db
```

## Dados de exemplo

```bash
npm run banco:seed
```

Gera `supabase/seed.sql` (fora do Git) com os mesmos dados de exemplo do front.
As datas são ancoradas no dia da geração: gere de novo antes de carregar. Os
dados de exemplo respeitam todas as regras do banco (a carga falha se não
respeitarem). Enquanto houver dados de exemplo no banco, ninguém cadastra
cliente real; antes dos dados reais, tudo é apagado.

## Aplicar no projeto do Supabase

Ainda não aplicado. Quando a equipe aprovar o pull request:

1. Aplicar as migrações novas (`20261029234500_modelo_novo.sql` em diante) no projeto (pelo Claude Code com o
   conector do Supabase, ou `npx supabase db push`).
2. Criar os usuários da equipe no painel: Authentication → Users → Add user →
   Create new user, marcando "Auto Confirm User".
3. Liberar cada um em `colaboradores` (informe ao Claude só o e-mail e o
   perfil, nunca a senha):

   ```sql
   insert into public.colaboradores (id, nome, cargo, perfil)
   select id, '<Nome>', '<Cargo>', 'dono'
   from auth.users where email = '<email>';
   ```

## Funções das operações

Toda operação que grava em mais de uma tabela, ou cuja regra é crítica, é uma
função do Postgres que a tela chama com `supabase.rpc(...)`. Tudo ou nada: se
uma regra for violada, nada é gravado e a tela recebe a mesma mensagem que
mostra hoje. Padrão de todas (veja `20261030120000_funcoes_base.sql`):

- Rodam com a permissão de quem chamou (`security invoker`): a RLS continua
  valendo, e a função nunca faz mais do que a pessoa poderia fazer.
- Conferem a permissão do perfil logo no começo e gravam o nome da operação na
  auditoria (coluna `auditoria.operacao`, ex.: "Cancelar aula").
- Nome = nome da operação do front em snake_case (`cancelarOcupacao` →
  `cancelar_ocupacao`); parâmetros = campos da tela com `p_` (`alunoId` →
  `p_aluno_id`).
- "Hoje" é sempre a data de São Paulo (`privado.hoje()`).

Leituras calculadas pelo banco: `saldo_estoque`, `lancamentos_com_situacao`,
`saldo_reposicao`, `ranking` (e `ranking_em(data)`), `classificacao_do_torneio`.
Conferido com os dados de exemplo: o saldo de reposição de cada aluno e o
ranking saem idênticos aos das telas.

Única exceção ao `security invoker`: a rotina que libera reservas sem
pagamento sozinha (`privado.liberar_reservas_vencidas_automaticamente`), que
roda a cada 15 minutos pelo `pg_cron`, sem ninguém logado. Ela só age se a
opção estiver ligada nas Configurações, e ninguém pela API consegue chamá-la.

## Próximo passo

Ligar o front ao banco: `src/lib/consultas/` passa a ler do Supabase e o
`executar` passa a chamar as funções acima (as telas não mudam). Falta também
a rotina que estende os horários fixos além das semanas geradas (H12).

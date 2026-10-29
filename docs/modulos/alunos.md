# Módulo Alunos e Professores

Cadastros e fichas de alunos e professores, no modelo novo
(`docs/MODELO-E-TELAS.md`, seção 2: "Alunos", "Ficha do aluno" e "Ficha do
professor").

## O que o módulo faz

| Tela | Rota | O que tem |
| --- | --- | --- |
| Lista de alunos | `/alunos` | Busca por nome, telefone ou e-mail; filtros por plano (tipo ou plano exato), professor principal e situação; contadores de ativos, congelados, sem plano e inativos (clicar num contador filtra); valor em atraso e saldo de reposição de cada aluno; botão **Novo aluno**; link para os professores. Os filtros também podem vir no endereço: `/alunos?professor=prof-1&situacao=congelado`. |
| Ficha do aluno | `/alunos/[id]` | Cabeçalho (situação, plano, professor, contato); **Editar cadastro**, **Congelar/Reativar plano**, **Inativar aluno** (ou **Reativar cadastro**); indicadores (aulas, frequência, faltas, pagos, em aberto, ranking); **Matrícula** com histórico de planos; **Reposição** (extrato); **Congelamento** com histórico; **Horários fixos** e próximas aulas; **Histórico de aulas**; **Pagamentos**; consumo do balcão; comentários; histórico de alterações. |
| Lista de professores | `/professores` | Um cartão por professor: regra de repasse, alunos principais, aulas e horas da semana, repasse previsto do mês; **Novo professor**. |
| Ficha do professor | `/professores/[id]` | Cadastro e **Editar cadastro** (com a regra de repasse); **Ver agenda deste professor** (`/agenda?professor=<id>`); indicadores da semana; **Agenda da semana** (aulas reais, com setas para outras semanas); **Repasse** (previsto x pago, mês a mês); alunos; consumo; comentários; histórico. |

Como está montado (ver `docs/ARQUITETURA.md`):

- leitura: `src/lib/consultas/alunos.ts` e `src/lib/consultas/professores.ts`;
- gravação: `src/lib/banco/operacoes/alunos.ts` e `src/lib/banco/operacoes/professores.ts`;
- regras: `src/lib/banco/regras/alunos.ts`;
- telas: `src/app/(app)/alunos/`, `src/app/(app)/professores/`,
  `src/components/aluno/` e `src/components/professor/`.

### Gravações (operações)

| Operação | O que faz |
| --- | --- |
| `cadastrarAluno` / `editarAluno` | Nome obrigatório; telefone e e-mail, se preenchidos, em formato válido (o telefone é guardado como "(11) 98812-4471"); nascimento no passado; professor existente; categoria obrigatória para quem entra no ranking. |
| `criarMatricula` | Plano ativo, valor combinado maior que zero, vencimento de 1 a 28, início a até um ano de hoje, sem sobrepor outra matrícula. |
| `trocarPlano` | Encerra a matrícula atual na véspera da data escolhida e abre outra nesse dia. Recusa se houver congelamento no período. |
| `encerrarMatricula` | Põe o último dia; o congelamento em curso termina junto. As aulas da agenda não mudam. |
| `cancelarMatriculaAgendada` | Desmarca uma matrícula que ainda não começou; se era troca de plano, o plano anterior volta a valer. |
| `corrigirMatricula` | Corrige valor combinado e dia de vencimento (erro de digitação, desconto). |
| `congelarPlano` / `reativarPlano` | Ver "Congelamento (H4)" abaixo. |
| `inativarAluno` / `reativarCadastro` | Ver "Inativação" abaixo. |
| `cadastrarProfessor` / `editarProfessor` | Nome obrigatório e sem repetir, cor da agenda, contatos válidos e regra de repasse válida (valor não negativo; percentual de 0 a 100). |

Toda gravação é "tudo ou nada", mostra o aviso de sucesso ou o erro da regra
e fica no histórico de alterações (auditoria automática).

## Regras e hipóteses usadas

- **Uma matrícula por vez.** Um aluno nunca tem duas matrículas valendo no
  mesmo dia. A troca de plano é "encerra uma, abre outra no dia seguinte", e o
  histórico de planos é a lista de matrículas. Matrícula e troca podem ser
  marcadas para uma data futura (aparecem como "agendada").
- **H3 — duas tabelas de planos.** Cada plano mostra "Tabela nova" ou "Tabela
  antiga"; o formulário separa os dois grupos. O valor combinado começa com o
  preço do plano, mas pode ser outro, e a ficha mostra quando o preço de tabela
  de hoje é diferente: o aluno mantém o valor da matrícula.
- **H4 — congelamento.** Ver a seção seguinte.
- **H6 — repasse do professor.** Regra por hora-aula (valor × horas das aulas
  realizadas no mês) ou percentual (sobre as mensalidades pagas no mês pelos
  alunos das aulas dele — a confirmar com a arena). O cálculo é o
  `repassePrevisto` de `regras/financeiro.ts`. Nos meses já fechados vale o
  valor do fechamento (tabela `repasses`); "pago" é a soma dos lançamentos de
  categoria Repasse pagos naquele mês.
- **H9 — perfis.** Dono e recepção alteram alunos e matrículas; o perfil de
  professor só consulta (os botões somem e a operação também recusa) e, na
  lista, vê só os próprios alunos. Só o dono cadastra professores e muda a
  regra de repasse, porque ela define quanto a arena paga ("financeiro a
  pagar"); a recepção corrige contato, cor e especialidade.
- **Duplicado é aviso, não bloqueio.** Mesmo nome (sem contar acentos e
  maiúsculas) ou mesmo e-mail mostram "Possível cadastro repetido", com link
  para a ficha; dá para salvar assim mesmo (irmãos podem dividir o e-mail dos
  pais).
- **Datas digitadas** (início de matrícula, de congelamento, volta, último dia)
  precisam estar a até um ano de hoje: evita erro de digitação no ano. O
  vencimento vai de 1 a 28 para existir em todos os meses.

### Congelamento (Hipótese H4) — comportamento exato

1. A tela pede **início**, **fim previsto** (último dia congelado) e
   **motivo**. Sem prazo mínimo ou máximo. O congelamento precisa caber na
   matrícula e não pode se sobrepor a outro (um congelamento sem volta
   registrada vale "até a volta").
2. Ficam **suspensas** as aulas que vêm de horário fixo, ainda agendadas, com
   o aluno, entre o início e o fim previsto:
   - aula **só do aluno** (individual, ou locação em que ele é o único): a aula
     é **cancelada** com o motivo "Congelamento" e a quadra fica livre;
   - aula **em turma** (dupla, LAP...): o aluno **sai da lista**; a aula
     continua para os outros.
3. **Nenhum crédito de reposição** é gerado ("Congelamento" não é sigla de
   reposição). Reservas avulsas e reposições já marcadas no período **não
   mudam**: a tela avisa quantas são, para a recepção decidir pela agenda.
4. A **mensalidade não muda sozinha**.
5. O congelamento guarda quais aulas suspendeu (`aulasSuspensas`). Antes de
   gravar, a tela mostra a lista.
6. **Reativar** pede a **data de volta** (primeiro dia de aula de novo). O
   congelamento termina na véspera. As aulas suspensas **da data de volta em
   diante** (e nunca antes de hoje: o passado não muda) **voltam**: a aula
   cancelada volta a ficar agendada; na turma, o aluno volta para a lista.
   **Não voltam** (e a tela diz por quê): a aula cuja quadra foi ocupada nesse
   meio-tempo; a aula da turma que foi cancelada; e, se a configuração de H10
   mandar bloquear, a aula em que o professor já tem outra. As aulas antes da
   volta continuam suspensas, sem crédito.
7. Voltar no dia do início (ou antes) **cancela** o congelamento: ele fica no
   histórico como "Cancelado" e não vale para nenhum dia. Para um congelamento
   marcado para o futuro, o botão é **Desmarcar congelamento**.
8. Enquanto ninguém reativa, o aluno continua congelado mesmo depois do fim
   previsto; a ficha avisa que a volta prevista já passou. As aulas depois do
   fim previsto não são suspensas.
9. Com o plano congelado (ou com congelamento marcado), a troca de plano é
   recusada: primeiro reative ou desmarque.

Nos dados de exemplo, os alunos que já estavam congelados vieram do MVP com o
horário fixo encerrado na data do congelamento e sem a lista de aulas
suspensas: ao reativá-los, nenhuma aula volta sozinha (a tela avisa e pede
para marcar os horários pela agenda).

### Inativação

"Inativar aluno" pede o **último dia na arena** (hoje ou antes) e um motivo
opcional, que vira comentário na ficha. Numa operação só:

- a matrícula que vale termina no último dia; matrículas marcadas para depois
  são desmarcadas;
- o congelamento em curso termina no último dia (um marcado para depois fica
  cancelado);
- as aulas fixas **depois** do último dia saem da agenda, pelas mesmas regras
  da suspensão (a que era só dele é cancelada com o motivo "Aluno inativado";
  na turma ele sai da lista), sem crédito;
- nos horários fixos: o que era só dele termina no último dia; nos de turma
  ele sai da lista;
- pagamentos, histórico, comentários e reservas avulsas não mudam (a tela avisa
  as reservas que continuam marcadas).

"Reativar cadastro" deixa o aluno ativo de novo, sem plano: a matrícula e os
horários são feitos de novo.

## O que ficou de fora, e por quê

- **Gerar mensalidades e cobrar**: é do Financeiro. A matrícula (plano, valor,
  vencimento, início e fim) é a base para isso; trocar ou encerrar matrícula
  não cria nem anula lançamentos.
- **Marcar presença, falta, reposição e cancelar aula**: é da Agenda. O
  extrato de reposição e o histórico de aulas aqui são só leitura.
- **Prorrogar um congelamento** (mudar o fim previsto): não pedido. Hoje se
  reativa e congela de novo.
- **Editar um congelamento ou uma matrícula já encerrada** (datas): para não
  reescrever o histórico; há a correção de valor e vencimento.
- **Inativar professor** e **foto do aluno**: não pedidos nesta etapa.
- **Matrícula online, área do cliente**: fora da v1.

## Roteiro de teste (para quem não programa)

Use o computador. Tudo volta ao início ao recarregar a página.

1. Abra **Alunos**. Devem aparecer quatro contadores (Ativo, Congelado, Sem
   plano, Inativo) e a lista com plano, professor e situação de cada aluno.
2. Clique no contador **Congelado**. A lista mostra só os congelados. Clique
   de novo para voltar a todos.
3. Digite **joao xuxa** (sem acento) na busca. Deve aparecer "João Xuxa".
   Apague e digite **98812** (parte de um telefone): aparece "Guilherme Lima".
4. Escolha **Dupla** em "Todos os planos" e **Márcio Bueno** em "Todos os
   professores". A lista mostra só as duplas do Márcio. Clique em **Limpar
   filtros**.
5. Clique em **Novo aluno** e depois em **Cadastrar aluno** sem preencher
   nada. Deve aparecer "Informe o nome do aluno."
6. Digite **guilherme lima** no nome. Deve aparecer o aviso "Possível cadastro
   repetido" com o link para a ficha do Guilherme.
7. Troque o nome para **Paula Teste**, digite **123** no telefone e
   **paula@** no e-mail e clique em **Cadastrar aluno**: aparecem os dois
   erros. Corrija o telefone para **11 91234 5678** e o e-mail para
   **paula@email.com**. Os erros somem. Clique em **Cadastrar aluno**.
8. Abre a ficha nova, com o aviso "Aluno cadastrado" e o telefone já
   formatado como (11) 91234-5678.
9. No bloco **Matrícula**, clique em **Nova matrícula**, escolha **Dupla · 1x
   por semana**, o dia de vencimento **12** e clique em **Criar matrícula**.
   Aparece "Matrícula criada." e o plano no cabeçalho.
10. Clique em **Congelar plano** (no cabeçalho). Escolha o motivo **Viagem**
    (botão de sugestão) e clique em **Congelar plano**. O cabeçalho passa a
    mostrar "Congelado".
11. **Erro de regra:** clique em **Trocar de plano**, escolha **LAP** e clique
    em **Trocar plano**. Deve aparecer o erro "O plano atual está congelado
    (ou tem congelamento marcado)...". Nada é gravado. Feche o formulário.
12. Clique em **Reativar plano** e confirme com a data de hoje. Como a volta é
    no dia do início, o congelamento é cancelado ("Congelamento cancelado.").
13. Clique em **Trocar de plano**, escolha **LAP**, valor **350,00** e a data
    do dia 1º do mês que vem. O texto embaixo diz em que dia o plano atual
    termina. Clique em **Trocar plano**: aparece a faixa "Troca de plano
    marcada" e o histórico de planos fica com duas linhas.
14. Na faixa amarela, clique em **Desmarcar** e confirme. A troca some e o
    plano atual volta a não ter data de fim.
15. Volte para **Alunos** e abra **Guilherme Lima**. Clique em **Congelar
    plano**, ponha o início daqui a 3 dias e o fim daqui a um mês. A caixa azul
    lista as aulas que ficam suspensas e diz que nenhuma reposição é gerada.
    Escreva um motivo e confirme. O bloco **Congelamento** mostra
    "Congelamento marcado" e, em **Próximas aulas**, as aulas aparecem como
    "Suspensa".
16. Clique em **Desmarcar congelamento**: a tela lista as aulas que voltam.
    Confirme: elas voltam a aparecer normais em **Próximas aulas**.
17. Congele de novo começando hoje, por 40 dias. Depois clique em **Reativar
    plano** e ponha a data de volta daqui a 14 dias: a tela mostra quantas
    aulas voltam e quantas, antes da volta, continuam suspensas. Confirme.
18. No **Histórico de aulas**, clique em **Ver mais aulas** e no filtro
    **Faltas**. Cada falta mostra a sigla (24h, TIP...) e os minutos de
    crédito.
19. No **Histórico de alterações**, clique em **Matrícula**: aparecem os
    congelamentos e matrículas mexidos, com quem fez e quando.
20. Abra a ficha da Paula de novo (busca na lista), clique em **Inativar
    aluno**, escreva o motivo **Mudou de cidade** e confirme. A ficha mostra
    "Aluno inativo" e o motivo aparece nos comentários. Clique em **Reativar
    cadastro** e confirme.
21. Volte para **Alunos** e clique em **Professores**. Abra **Alexandre
    Pires**. Use as setas da **Agenda da semana** para ver a semana seguinte.
    Clique em **Ver agenda deste professor**: abre a Agenda filtrada por ele.
    (O endereço leva o id do professor, `/agenda?professor=prof-1`; o filtro
    funciona com a Agenda do modelo novo. A agenda antiga, enquanto não for
    migrada, procura pelo nome e pode mostrar a grade vazia.)
22. Na ficha do professor, clique em **Editar cadastro**, escolha
    **Percentual** e digite **120**. Ao salvar aparece "O percentual vai de 0
    a 100." Troque para **30** e salve: o cabeçalho mostra "Repasse: 30% das
    mensalidades".
23. Em **Professores**, clique em **Novo professor**, digite **Renata Coelho**
    e um valor por hora e salve: aparece o erro "Já existe um professor
    chamado Renata Coelho." Troque o nome e salve: abre a ficha nova.
24. Saia, entre como **Lucas Ferreira** (recepção), abra Alunos >
    Professores: não há botão "Novo professor" e, ao editar um professor, a
    regra de repasse fica travada ("Só o dono altera...").

## Notas para a migração ao Supabase

| Aqui | No banco real |
| --- | --- |
| Tabelas `alunos`, `professores`, `matriculas`, `congelamentos` | Iguais (snake_case). `congelamentos.aulasSuspensas` vira a tabela `congelamento_aulas (congelamento_id, ocupacao_id, acao)`. |
| `garantirSemMatriculaSobreposta` | Exclusion constraint (btree_gist) em `matriculas`: `(aluno_id WITH =, daterange(inicio, fim, '[]') WITH &&)`. |
| `garantirSemCongelamentoSobreposto` | A mesma ideia em `congelamentos`, por `matricula_id` (fim aberto = `fim_real` vazio). |
| `validarCadastroAluno`, `validarCadastroProfessor`, `validarRegraRepasse`, `validarValorEVencimento` | `check` nas tabelas (formato de telefone e e-mail, `dia_vencimento between 1 and 28`, `valor_mensal > 0`, `repasse_valor >= 0`, `repasse_modo <> 'percentual' or repasse_valor <= 100`) e validação nas funções. |
| `criarMatricula`, `corrigirMatricula`, `editarAluno`, `cadastrarAluno`, `editarProfessor`, `cadastrarProfessor` | `insert`/`update` simples, com as constraints acima. |
| `trocarPlano`, `encerrarMatricula`, `cancelarMatriculaAgendada` | Funções (rpc) `trocar_plano`, `encerrar_matricula`, `desmarcar_matricula` (mexem em mais de um registro). |
| `congelarPlano`, `reativarPlano` | Funções `congelar_plano` e `reativar_plano`: gravam o congelamento e suspendem/devolvem as aulas na mesma transação; `reativar_plano` checa a quadra com a mesma constraint de conflito da agenda. |
| `inativarAluno`, `reativarCadastro` | Funções `inativar_aluno` (matrícula, congelamento, aulas, horários fixos e comentário numa transação) e `reativar_aluno`. |
| `podeAlterarCadastros`, `podeAlterarRepasse` (H9) | Políticas de acesso (RLS) por perfil do colaborador. |
| `consultas/alunos.ts`, `consultas/professores.ts` | `select` com filtros, ou views (ex.: `situacao_aluno`, `repasse_mensal`). |

## Para os outros módulos

- **Agenda:** aulas canceladas por este módulo usam o motivo em texto livre
  "Congelamento" ou "Aluno inativado" (não são siglas, não geram crédito). Ao
  gerar aulas novas a partir dos horários fixos (H12), pule o aluno congelado
  na data — use `alunoCongeladoEm(banco, alunoId, data)` de
  `regras/alunos.ts` — e respeite o `fim` dos horários fixos e a lista de
  `horarioAlunos` (a inativação mexe nos dois). O botão "Ver agenda deste
  professor" abre `/agenda?professor=<id do professor>` (id, não nome).
- **Financeiro:** a matrícula vigente (valor combinado, dia de vencimento,
  início e fim) é a base para gerar mensalidades; congelar não muda a
  mensalidade (H4).
- **Base:** a aba "Alunos" da navegação não fica marcada em `/professores`
  (a regra é `startsWith("/alunos")`). O `HistoricoDoRegistro` mostra valores
  crus (datas ISO, ids de professor e plano); um formatador por campo deixaria
  o histórico mais legível.

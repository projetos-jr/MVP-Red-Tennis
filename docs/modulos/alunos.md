# Módulo Alunos e Professores

Cadastros e fichas de alunos e professores, no modelo novo
(`docs/MODELO-E-TELAS.md`, seção 2: "Alunos", "Ficha do aluno" e "Ficha do
professor").

## O que o módulo faz

| Tela | Rota | O que tem |
| --- | --- | --- |
| Clientes (lista de alunos) | `/alunos` | Como no sistema antigo da arena: **Ativos / Inativos / Todos** e os grupos **Todos / Ranking / Alunos / Aluguel / Torneio**, cada botão com a contagem; busca por nome (aceita pedaços: "gui lim"), telefone ou e-mail; filtros por plano (tipo ou plano exato), professor principal e situação do plano (com plano, congelado, sem plano); **Limpar filtros**. Tabela densa (nome com foto e link para a ficha, celular, plano, professor, grupos, situação, saldo de reposição, valor em atraso), ordenada por nome (clique em "Nome" para inverter), 50 por vez; no celular e no tablet em pé, um cartão por cliente. Quem tem minutos de reposição para usar mostra o saldo numa etiqueta violeta (coluna **Reposição**, "1h"; no cartão, "Reposição 1h" junto das etiquetas). Ícones **Editar** e **Inativar** em cada cliente ativo (só dono e recepção); botão **Novo cliente**; botão **Professores** (só para quem abre a tela de professores: o perfil de professor não vê). Os filtros ficam no endereço (ver "Endereço da lista"). |
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

## Clientes: grupos e endereço da lista

A tela se chama **Clientes** (o nome do sistema antigo); a rota continua
`/alunos` e o cadastro continua sendo o de aluno. Nada disso muda o banco: os
grupos são calculados na hora, em `linhasDaListaDeAlunos`
(`src/lib/consultas/alunos.ts`), a partir do que já está gravado.

**Hipótese H15 — grupos de cliente** (a confirmar com a arena). Um cliente
pode estar em mais de um grupo (o aluno que também joga o ranking aparece nos
dois):

| Grupo | Quem entra |
| --- | --- |
| Ranking | Quem está inscrito no ranking (cadastro do aluno). A etiqueta mostra a categoria: "Ranking B". |
| Alunos | Quem tem plano de aula valendo hoje: Individual, Dupla ou LAP (congelado também conta). |
| Aluguel | Quem tem plano de locação valendo (Locação Mensal ou Plano de locação) **ou** é o titular (quem paga) de alguma locação da agenda (avulsa, mensal ou plano de locação), passada ou marcada, sem contar as canceladas e as reposições. Ver "Quem é o titular" abaixo. |
| Torneio | Quem está inscrito em algum torneio, de qualquer situação (inscrições, em andamento ou encerrado). |

Por que o titular e não todos os participantes da locação: nos dados de
exemplo quase todo aluno já foi convidado de alguma locação (ou repôs uma aula
num horário de locação), e o grupo Aluguel teria 82 dos 93 clientes. Contando
só o titular, ficam os 14 que de fato alugam quadra (6 com locação mensal e 8
avulsos). Perguntas para a arena: o grupo "Aluguel" do sistema antigo é isso?
Convidado de uma locação conta? Quem jogou torneio há muito tempo continua em
"Torneio"?

**Quem é o titular de uma locação** (`titularesDeLocacao`), nesta ordem:

1. a pessoa **cobrada** pela locação (lançamento a receber ligado a ela). A
   locação avulsa nasce com a cobrança no nome do primeiro aluno escolhido,
   na tela e no Supabase (`criar_horario_avulso`). Cobrança anulada também
   vale (anular muda o dinheiro, não quem alugou);
2. sem cobrança (locação mensal e plano de locação, que se pagam pela
   mensalidade): quem do horário tinha **matrícula de plano de locação**
   naquela data;
3. sem nenhum dos dois, o sistema não sabe quem paga e a locação não põe
   ninguém no grupo.

A ordem dos nomes na locação **não** decide: o banco não guarda essa ordem
(`ocupacao_alunos` não tem coluna de ordem e o id é sorteado), então "o
primeiro da lista" mudava do modo demonstração para o Supabase (nos dados de
exemplo, o grupo ia de 14 para 45 clientes). Se a arena quiser que o titular
de uma locação mensal sem matrícula conte, o caminho é o banco guardar o
titular (uma migração nova); hoje isso não acontece nos dados de exemplo.

**Ativos e Inativos.** "Inativos" são os que saíram da arena (Inativar
aluno). "Ativos" são todos os outros: com plano valendo, congelados e sem plano
mensal. A situação do plano (com plano, congelado, sem plano) é o filtro
"Todas as situações". Cada contagem nos botões considera os outros filtros
(busca, plano, professor, grupo), menos o próprio.

**Endereço da lista.** Os filtros ficam no endereço: cada filtro escolhido na
tela reescreve o endereço (sem criar um passo novo no "voltar" do
navegador), e a tela lê os filtros de lá. Por isso um link abre a lista já
filtrada, abrir uma ficha e voltar devolve os mesmos filtros, e o "Ver os N na
lista de clientes" da busca rápida sempre vale, mesmo com a lista aberta e
outro grupo escolhido. A ordem (A–Z ou Z–A) e o "Mostrar mais" não vão para o
endereço. As funções são `filtrosDaListaPeloEndereco` (lê) e
`enderecoDaListaDeClientes` (monta; só o que não é padrão), em
`src/lib/consultas/alunos.ts`, com teste. Endereços aceitos:

| Endereço | Abre |
| --- | --- |
| `/alunos?busca=ana` | A busca preenchida, em **Todos** (ativos e inativos, como a busca do topo). É o link "Ver os N na lista" da busca rápida. |
| `/alunos?professor=prof-1` | Os alunos do professor (link da ficha do professor). |
| `/alunos?situacao=congelado` | Os congelados (`ativo`, `congelado` e `avulso` funcionam; `inativo` abre **Inativos**). |
| `/alunos?plano=tipo:Dupla` | Os de plano Dupla (ou `plano:<id>`, ou `sem`). |
| `/alunos?estado=inativos` | Ativos, inativos ou todos. |
| `/alunos?categoria=torneio` | Um grupo: `ranking`, `alunos`, `aluguel` ou `torneio`. |

Os parâmetros se combinam (`/alunos?busca=ar&categoria=torneio`). Valor
desconhecido vira o padrão daquele filtro.

**Editar e Inativar pela lista.** Os ícones abrem os mesmos formulários da
ficha (`FormularioAluno` e `ModalInativar`), com as mesmas regras e a mesma
gravação. Só aparecem para quem pode alterar cadastros (dono e recepção, H9) e
só nos clientes ativos; reativar um cadastro continua sendo pela ficha. Não
há "excluir" (o histórico do cliente fica guardado) nem envio de foto.

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

1. Abra **Clientes** (a aba "Alunos" do menu). O título é "Clientes", o botão
   **Ativos** está marcado e a tabela mostra 93 clientes, 50 por vez, com
   celular, plano, professor, grupos, situação e o valor em atraso.
2. Clique na pílula **Aluguel**: aparecem 14 clientes, todos com a etiqueta
   "Aluguel" (quem tem locação mensal e quem aluga quadra avulsa, como o
   Lucas Freitas). Escolha **Sem plano mensal** em "Todos os planos": ficam 8.
   Repare que os números dos botões mudam junto. Clique em **Limpar filtros**.
3. Escolha **Plano congelado** em "Todas as situações": a lista mostra só os
   congelados. Clique em **Limpar filtros**.
4. Digite **joao xuxa** (sem acento) na busca. Deve aparecer "João Xuxa".
   Apague e digite **98812** (parte de um telefone): aparece "Guilherme Lima".
   Digite **gui lim**: também aparece "Guilherme Lima".
5. Escolha **Dupla** em "Todos os planos" e **Márcio Bueno** em "Todos os
   professores". A lista mostra só as duplas do Márcio. Clique em **Limpar
   filtros**.
6. Com a lista aberta, digite **caio** na busca do topo da tela e clique em
   "Ver os ... na lista" (ou abra o endereço `/alunos?busca=caio`). A busca da
   lista vem preenchida com "caio" e o botão **Todos** marcado.
7. Clique em **Nome** no cabeçalho laranja da tabela: a ordem passa a ser de Z
   a A. Clique de novo para voltar. No fim da lista, clique em **Mostrar
   mais**.
8. Na linha da Adriana Monteiro, clique no lápis (**Editar**): abre o mesmo
   formulário da ficha, preenchido. Mude o nome e salve: a lista mostra o nome
   novo e continua aberta.
9. Na linha da Adriana Xavier, clique no ícone de saída (**Inativar**): abre o
   mesmo "Inativar aluno" da ficha. Confirme. Ela some de **Ativos** e aparece
   em **Inativos**, sem os ícones. (Recarregue a página para voltar ao início.)
10. Clique em **Novo cliente** e depois em **Cadastrar aluno** sem preencher
   nada. Deve aparecer "Informe o nome do aluno."
11. Digite **guilherme lima** no nome. Deve aparecer o aviso "Possível cadastro
   repetido" com o link para a ficha do Guilherme.
12. Troque o nome para **Paula Teste**, digite **123** no telefone e
   **paula@** no e-mail e clique em **Cadastrar aluno**: aparecem os dois
   erros. Corrija o telefone para **11 91234 5678** e o e-mail para
   **paula@email.com**. Os erros somem. Clique em **Cadastrar aluno**.
13. Abre a ficha nova, com o aviso "Aluno cadastrado" e o telefone já
   formatado como (11) 91234-5678.
14. No bloco **Matrícula**, clique em **Nova matrícula**, escolha **Dupla · 1x
   por semana**, o dia de vencimento **12** e clique em **Criar matrícula**.
   Aparece "Matrícula criada." e o plano no cabeçalho.
15. Clique em **Congelar plano** (no cabeçalho). Escolha o motivo **Viagem**
    (botão de sugestão) e clique em **Congelar plano**. O cabeçalho passa a
    mostrar "Congelado".
16. **Erro de regra:** clique em **Trocar de plano**, escolha **LAP** e clique
    em **Trocar plano**. Deve aparecer o erro "O plano atual está congelado
    (ou tem congelamento marcado)...". Nada é gravado. Feche o formulário.
17. Clique em **Reativar plano** e confirme com a data de hoje. Como a volta é
    no dia do início, o congelamento é cancelado ("Congelamento cancelado.").
18. Clique em **Trocar de plano**, escolha **LAP**, valor **350,00** e a data
    do dia 1º do mês que vem. O texto embaixo diz em que dia o plano atual
    termina. Clique em **Trocar plano**: aparece a faixa "Troca de plano
    marcada" e o histórico de planos fica com duas linhas.
19. Na faixa amarela, clique em **Desmarcar** e confirme. A troca some e o
    plano atual volta a não ter data de fim.
20. Volte para **Clientes** e abra **Guilherme Lima**. Clique em **Congelar
    plano**, ponha o início daqui a 3 dias e o fim daqui a um mês. A caixa azul
    lista as aulas que ficam suspensas e diz que nenhuma reposição é gerada.
    Escreva um motivo e confirme. O bloco **Congelamento** mostra
    "Congelamento marcado" e, em **Próximas aulas**, as aulas aparecem como
    "Suspensa".
21. Clique em **Desmarcar congelamento**: a tela lista as aulas que voltam.
    Confirme: elas voltam a aparecer normais em **Próximas aulas**.
22. Congele de novo começando hoje, por 40 dias. Depois clique em **Reativar
    plano** e ponha a data de volta daqui a 14 dias: a tela mostra quantas
    aulas voltam e quantas, antes da volta, continuam suspensas. Confirme.
23. No **Histórico de aulas**, clique em **Mostrar mais 12** e no filtro
    **Faltas**. Cada falta mostra a sigla (24h, TIP...) e os minutos de
    crédito.
24. No **Histórico de alterações**, clique em **Matrícula**: aparecem os
    congelamentos e matrículas mexidos, com quem fez e quando.
25. Abra a ficha da Paula de novo (busca na lista), clique em **Inativar
    aluno**, escreva o motivo **Mudou de cidade** e confirme. A ficha mostra
    "Aluno inativo" e o motivo aparece nos comentários. Clique em **Reativar
    cadastro** e confirme.
26. Volte para **Clientes** e clique em **Professores**. Abra **Alexandre
    Pires**. Use as setas da **Agenda da semana** para ver a semana seguinte.
    Clique em **Ver agenda deste professor**: abre a Agenda filtrada por ele.
    (O endereço leva o id do professor, `/agenda?professor=prof-1`; o filtro
    funciona com a Agenda do modelo novo. A agenda antiga, enquanto não for
    migrada, procura pelo nome e pode mostrar a grade vazia.)
27. Na ficha do professor, clique em **Editar cadastro**, escolha
    **Percentual** e digite **120**. Ao salvar aparece "O percentual vai de 0
    a 100." Troque para **30** e salve: o cabeçalho mostra "Repasse: 30% das
    mensalidades".
28. Em **Professores**, clique em **Novo professor**, digite **Renata Coelho**
    e um valor por hora e salve: aparece o erro "Já existe um professor
    chamado Renata Coelho." Troque o nome e salve: abre a ficha nova.
29. Saia, entre como **Lucas Ferreira** (recepção), abra Clientes >
    Professores: não há botão "Novo professor" e, ao editar um professor, a
    regra de repasse fica travada ("Só o dono altera...").
30. Saia e entre como **Renata Coelho** (professora). Em **Clientes**
    aparecem só os alunos dela (28), sem **Novo cliente** e sem os ícones de
    editar e inativar.

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
- **Início e navegação:** a lista aceita `?categoria=` e `?estado=` no
  endereço (ex.: `/alunos?categoria=torneio`), para um atalho abrir um grupo
  de clientes. Os rótulos dos grupos estão em `ROTULO_CATEGORIA`
  (`consultas/alunos.ts`). A tela se chama "Clientes"; a aba da navegação, o
  link da busca rápida ("Ver os N na lista de alunos") e o formulário ("Novo
  aluno", "Cadastrar aluno") ainda dizem "aluno" (são de outros arquivos).
- **Base:** a aba "Alunos" da navegação não fica marcada em `/professores`
  (a regra é `startsWith("/alunos")`). O `HistoricoDoRegistro` mostra valores
  crus (datas ISO, ids de professor e plano); um formatador por campo deixaria
  o histórico mais legível.

## No banco (funções)

Migração `supabase/migrations/20261030120200_funcoes_alunos.sql`; testes em
`supabase/tests/50_alunos.test.sql`. Esta seção substitui a tabela "Notas para
a migração ao Supabase" acima onde as duas divergirem.

A tela chama cada função com `supabase.rpc("nome", { p_campo: valor })`. Os
parâmetros têm o nome do campo da tela em snake_case com `p_` na frente
(`alunoId` → `p_aluno_id`). As mensagens de recusa são as mesmas da tela, com
uma exceção: quem não tem permissão recebe "Seu perfil não tem permissão para
esta operação." (código 42501), igual em todo o sistema.

| Operação da tela | No banco | Retorno |
| --- | --- | --- |
| `cadastrarAluno` | grava direto em `alunos` (insert) | — |
| `editarAluno` | grava direto em `alunos` (update) | — |
| `reativarCadastro` | grava direto em `alunos` (`ativo = true`) | — |
| `corrigirMatricula` | grava direto em `matriculas` (`valor_mensal`, `dia_vencimento`; os checks garantem valor > 0 e dia de 1 a 28) | — |
| `criarMatricula` | `criar_matricula(p_aluno_id, p_plano_id, p_valor_mensal, p_dia_vencimento, p_inicio)` | id da matrícula |
| `trocarPlano` | `trocar_plano(p_matricula_id, p_plano_id, p_valor_mensal, p_dia_vencimento, p_inicio)` | id da matrícula nova |
| `encerrarMatricula` | `encerrar_matricula(p_matricula_id, p_ultimo_dia)` | id da matrícula |
| `cancelarMatriculaAgendada` | `cancelar_matricula_agendada(p_matricula_id)` | id da matrícula que voltou a valer (ou vazio) |
| `congelarPlano` | `congelar_plano(p_aluno_id, p_inicio, p_fim_previsto, p_motivo)` | `{ congelamento_id, aulas_suspensas }` (quantas aulas foram suspensas) |
| `reativarPlano` | `reativar_plano(p_congelamento_id, p_data_volta)` | `{ voltaram, nao_voltaram: [{ ocupacao_id, data, motivo }] }` |
| `inativarAluno` | `inativar_aluno(p_aluno_id, p_ultimo_dia, p_motivo)` | id do aluno |
| `cadastrarProfessor` | grava direto em `professores` (só o dono, pela RLS) | — |
| `editarProfessor` | grava direto em `professores` (dono e recepção; só o dono muda a regra de repasse) | — |

O que cada função garante, em linguagem simples:

- **Matrícula:** aluno ativo, plano ativo, valor maior que zero, vencimento de
  1 a 28, início a até um ano de hoje e nunca duas matrículas no mesmo dia (a
  regra também é garantida pela própria tabela).
- **Congelar, reativar e inativar** também mexem na agenda (cancelam aulas,
  tiram o aluno da turma, terminam horários fixos). Por isso exigem permissão
  de gravar em **Alunos e na Agenda**. A suspensão e a devolução das aulas
  ficam dentro da própria função: nada é gravado pela metade.
- **Reativar** confere, aula por aula, se a quadra continua livre (e o
  professor, se a opção "impedir professor em duas aulas" estiver ligada). As
  que não podem voltar vêm na lista `nao_voltaram`, com o motivo.

Mudanças no esquema feitas nesta migração:

- `congelamentos`: o "fim real" agora pode ser a véspera do início. É assim
  que a tela marca um congelamento **anulado** (cancelado antes de começar,
  ou marcado para depois da saída do aluno). Antes o banco recusava.
- `professores`: a recepção passou a poder corrigir o cadastro do professor
  (contato, cor, especialidade), como a tela já fazia (H9). Um gatilho recusa
  quando alguém que não é o dono tenta mudar a regra de repasse ("Só o dono
  cadastra professores e altera a regra de repasse.").

Diferenças em relação à tela (pequenas):

- Na descrição de uma aula que ocupa a quadra ("Locação Avulsa · Ana e
  Bruno"), os nomes saem em ordem alfabética.
- Nas gravações diretas (cadastro de aluno e professor, correção de
  matrícula), a limpeza do nome, o formato do telefone e do e-mail e a
  validação do professor principal continuam na tela; o banco garante só o que
  as constraints garantem (nome não vazio, nome de professor sem repetir etc.).

Como testar: com o Postgres local rodando, rode os testes do banco
(`supabase test db`) e confira que `50_alunos.test.sql` passa inteiro (97
verificações: congelar, reativar, anular, trocar e desmarcar plano, inativar,
permissões e auditoria).

### Ligação com as telas

As operações deste módulo (alunos e professores) estão ligadas ao banco real
em `src/lib/supabase/operacoes/alunos.ts`: matrícula, congelamento e
inativação chamam as funções da tabela acima; cadastro e edição de aluno e de
professor, reativar cadastro e corrigir matrícula gravam direto na tabela
(com o mesmo id que a tela gerou, por isso a ficha nova abre logo depois de
salvar). Testes de integração (as telas gravando num Supabase de verdade, com
os três perfis): `src/lib/supabase/operacoes/alunos.integracao.test.ts`.

Diferenças entre o modo demonstração e o modo Supabase:

- No modo Supabase, o banco confere tudo de novo; o que a tela já recusa nem
  chega a ser enviado. Mesmo burlando a tela, o professor não cadastra
  alunos e a recepção não muda a regra de repasse.
- Os ids de matrícula e de congelamento são criados pelo banco (a tela não
  depende deles).
- Ao reativar um plano, a mensagem "N aulas voltaram" vem da prévia da tela.
  Se alguém ocupar a quadra entre a prévia e a gravação, o banco deixa essa
  aula de fora; a agenda, relida logo depois, mostra o que de fato voltou.

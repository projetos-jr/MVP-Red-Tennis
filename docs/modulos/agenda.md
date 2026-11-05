# Módulo Agenda

Versão de 29/10/2026, com o redesign das visões de 04/11/2026 (Diária,
Quadra, Professor e Mês) e o redesign 3 de 05/11/2026 (agenda maior, barra
enxuta com "Mais opções" e a visão **Professores** igual à das quadras). A agenda do MVP mostrava um molde semanal ("toda terça
às 10h"). Agora ela mostra **as aulas de cada data**, lidas de
`banco.ocupacoes`: cancelar a aula do dia 10 não mexe nas outras semanas, e
dá para bloquear uma quadra num dia, marcar presença e falta e ver o
histórico de verdade. A especificação é a seção 2 ("Agenda") de
`docs/MODELO-E-TELAS.md`.

## O que o módulo faz

**Telas**

| Endereço | Para que serve |
| --- | --- |
| `/agenda` | A agenda, em quatro visões: **Diária** (padrão), **Professores**, **Quadra** e **Mês**. |
| `/agenda/quadra?quadra=2` | Modo quadra: as aulas do dia de uma quadra, com botões grandes de presença e falta, para o tablet na beira da quadra. |
| `/agenda/imprimir?data=2026-10-29` | A agenda de um dia em formato de papel (uma coluna por quadra), com botão **Imprimir**. |

**Redesign 3 (05/11/2026), pedido do dono da arena**: "Gostei, está bem do
jeito que ele gosta: 2 dias, 4 quadras e o paredão. Porém quero que a agenda
esteja maior, que pegue mais espaço da tela. Tem muito botãozinho que dá
para ficar menor ou em outra disposição. Aumentar o tamanho de tudo,
principalmente dos dias. As colunas das quadras maiores também. E a agenda
dos professores: deixe igual à agenda das quadras."

- **Barra de cima enxuta**, numa linha só no computador e no tablet deitado:
  as quatro visões em botões grandes (**Diária | Professores | Quadra |
  Mês**), a data grande com ‹ › ("Qui 05/11 e Sex 06/11"; no tablet deitado,
  "05/11 e 06/11") e **Hoje**; à direita, a **placa amarela** com as
  reservas de prazo vencido (só quando há alguma; abre a janela de
  Reservas), **+ Novo horário** (só quem pode alterar) e **Mais opções**. O
  título "Agenda" saiu da tela (a aba do topo já diz onde se está) e ficou
  só para o leitor de tela.
- **Mais opções** (fechado por padrão) guarda o resto: Bloquear quadra,
  Cancelar por chuva, Reservas sem pagamento (com a contagem), Imprimir o
  dia, Modo quadra, Ir para a data, os **filtros** (professor, tipo, Mostrar
  canceladas), os **números** do período e a **legenda**. O botão mostra
  quantos filtros estão ligados. Quem chega por um link já filtrado (o LAP
  do Início) encontra o painel aberto, com o filtro à vista.
- **Grade maior**: ocupa quase toda a altura que sobra da tela, com margens
  menores em volta; o dia em letra de placar grande ("Quinta-feira, 05/11" +
  selo **HOJE**), cabeçalho das quadras maior (Quadra 1 em azul, de cimento;
  as outras e o paredão em laranja, de saibro; com a contagem), horas cheias
  grandes e blocos com letra de 15–16 px (hora e nomes) e 14 px (professor).
- **Blocos sem "…" no tipo**: o tipo usa rótulos curtos (Indiv., Mensal,
  Dupla, LAP, Avulsa, Ranking, Plano, Bloqueio) e, quando nem ele cabe, some
  inteiro (a cor já diz o tipo); a hora nunca some. Numa coluna estreita,
  quem tem vários alunos aparece como "Natália Q., Pedro L." e o professor
  como "Renata C."; numa coluna larga, os nomes inteiros. Um aluno sozinho
  aparece com o nome inteiro, em até duas ou três linhas.
- **Medidas** (1440 × 900, dono, Diária, sem rolar a página): antes, a grade
  começava a 427 px do topo, ocupava 53% da altura da tela, mostrava 11
  meias horas de 36 px e o cabeçalho do dia tinha 32 px (letra de 19 px);
  depois, começa a 206 px, ocupa 75%, mostra 11,5 meias horas de 51 px e o
  cabeçalho do dia tem 49 px (letra de 32 px); as quadras passaram de 15
  para 21 px e os nomes de 13 para 16 px. No tablet deitado (1180 × 820):
  de 6 para 9,8 meias horas visíveis (de 54 px), de 40% para 75% da altura.

**As visões** (redesign de novembro, pedido do cliente: "como o sistema
antigo", com cores vivas)

- **Diária** (padrão): **hoje e amanhã lado a lado**, uma coluna por quadra
  (Quadra 1 a 4 e Paredão) e **linhas de 30 em 30 minutos**, das 07h às 22h,
  como no sistema antigo da arena. O cabeçalho de cada coluna tem a cor do
  piso (Quadra 1 de cimento em azul; as de saibro em laranja) e quantos
  horários ela tem. A partir de 1150 px de largura (o tablet deitado da arena,
  1180) aparecem as 10 colunas; entre 768 e 1149 px (tablet em pé, iPad
  deitado), um dia por vez com **Hoje | Amanhã**; no
  celular, a **lista do dia**, com uma régua para trocar entre os dois dias.
- **Professores** (Hipótese H20, "igual à agenda das quadras"): **hoje e
  amanhã lado a lado, uma coluna por professor ativo**, como a Diária faz
  com as quadras. O cabeçalho de cada coluna tem o nome e a cor do
  professor; cada bloco mostra a quadra (Q1, Q2… PAR). Clicar no nome de um
  professor (ou escolhê-lo em Mais opções) abre a **semana dele**, com a
  faixa "Todos os professores | Alexandre Pires | Renata Coelho | …" em
  cima para trocar ou voltar. No tablet em pé, um dia por vez; no celular,
  a lista do dia com a mesma faixa de professores. O professor logado
  (perfil de professor) abre direto na semana dele, travado nas próprias
  aulas.
- **Quadra**: a semana inteira de uma quadra (faixa com Quadra 1 a 4 e
  Paredão em cima da grade, a escolhida pintada na cor do piso; abre na
  Quadra 1). Clicar no cabeçalho de um dia abre a Diária daquele dia com a
  coluna da quadra realçada.
- **Mês**: quantos horários cada dia tem, a divisão por tipo e o que pede
  atenção (canceladas, chuva, bloqueio, reservas a pagar). Clicar abre a
  Diária do dia.

**Na grade (Diária, Quadra e Professor)**

- Cada horário é um **bloco na cor cheia do tipo** (as cores da legenda
  combinada com a arena), posicionado com precisão de minuto e com a altura
  da duração. Quanto texto aparece depende da altura: hora, tipo, alunos e
  professor; o que não cabe termina em "…" (a turma inteira está no painel).
- **Situações**: prazo de pagamento vencido = anel duplo (branco e vermelho)
  e ⚠; **cancelada** = fundo branco, borda tracejada na cor do tipo, nomes
  riscados e a sigla (CH, FP, IAC…); **bloqueio** = cinza listrado; uma aula
  cancelada aparece ao lado da que ocupou o lugar dela. Sozinha, a cancelada
  ocupa meia coluna: a outra metade continua livre para marcar no lugar.
- **Linha do "agora"** (vermelha, com a bolinha amarela) nas colunas de hoje,
  e uma **película cinza** sobre o que já passou. Ao abrir, a grade rola até
  o agora (ou até o primeiro horário do período).
- **Meia hora livre**: clicar (ou tocar) abre o **Novo horário** já com a
  data, a hora (inclusive :30) e a quadra; na visão Professores, com o
  professor da coluna (e a primeira quadra livre naquele horário). O término sugerido
  é 1 hora depois, mas para no início do próximo horário daquela coluna (no
  mínimo 30 min): o formulário nunca abre já em conflito. Só aparece de hoje
  em diante, como a regra de gravação.
- **Voltar do navegador (ou do tablet)** com o painel de um horário aberto:
  fecha o painel e continua na agenda. Trocar de data, visão ou filtro não
  cria passos no "Voltar" (o endereço muda no lugar).
- **Virada do dia**: com a tela aberta de um dia para o outro (o tablet da
  quadra), a página recarrega sozinha depois da meia-noite para "hoje"
  passar a ser o dia novo.
- **Nome do aluno** (com mouse) abre a ficha; o resto do bloco abre o painel
  do horário. No toque (tablet e celular) o bloco inteiro abre o painel, e lá
  cada nome abre a ficha: um nome dentro de um bloco seria um alvo pequeno
  demais para o dedo.
- Cada meia hora tem 51 px com mouse e 54 px com toque (alvo mínimo de
  44 px). Um horário de 1 h fica com espaço para a hora e o tipo, **duas
  linhas de nomes** e o professor no computador; **três linhas** no tablet,
  onde as colunas são mais estreitas (`PX_POR_MINUTO` em `grade.ts`).

**Em todas as visões** (em "Mais opções")

- **Filtros**: professor (na visão Professores, ele escolhe a semana de
  quem), tipo e **Mostrar canceladas** (interruptor com a bola de tênis).
- **Legenda**: um quadradinho na cor de cada tipo (mais o bloqueio, listrado)
  e as marcas: aguardando pagamento (relógio), prazo vencido (alerta), pago
  (✓) e reposição. Toda marca tem ícone e texto; a cor nunca é o único sinal.
- **Números**: horários, alunos, ocupação das quadras (na visão
  Professores, horas de aula), canceladas e reservas a pagar, sempre do
  período que está na tela.
- **Navegação** ‹ › (na barra de cima): um dia na Diária e na Professores
  com todos, uma semana na Quadra e na semana de um professor, um mês no
  Mês. **Hoje** volta para hoje.

**Endereço (URL)**: o endereço é quem manda na tela. Cada clique que muda a
visão, a data, a quadra, o professor, um filtro ou abre um horário reescreve
o endereço (`/agenda?visao=diaria&data=…&ocupacao=…`), então "recarregar" e
um link mandado para alguém abrem exatamente a mesma tela. Os links antigos
continuam valendo:

| Endereço recebido | Abre |
| --- | --- |
| `/agenda` | Diária de hoje (professor logado: a semana dele) |
| `?visao=dia&data=AAAA-MM-DD` | Diária a partir da data |
| `?visao=semana&quadra=2` | Quadra 2 (a semana com todas as quadras saiu) |
| `?quadra=2` | Quadra 2 |
| `?data=AAAA-MM-DD&quadra=2` (link do Início) | Diária da data com a coluna da Quadra 2 realçada |
| `?professor=prof-2` (ou o nome; link da ficha do professor) | A semana daquele professor |
| `?visao=professor` (mosaico do Início) | Professores: hoje e amanhã, uma coluna por professor |
| `?visao=professor&professor=prof-2` | A semana daquele professor |
| `?tipo=LAP` (atalho LAP do Início) | Diária filtrada por LAP |
| `?visao=mes` | Mês |
| `?ocupacao=<id>` | Abre o painel daquele horário (na data dele) |
| `?canceladas=nao` | Esconde as canceladas |

**Painel do horário** (abre ao clicar num horário)

- Alunos, professor, quadra, data e hora, repetição (horário fixo ou uma data
  só), situação e marcas.
- **Presença por aluno**: Presente, Falta ou Avisou (falta avisada, com a
  sigla). Clicar de novo na opção marcada desfaz.
- **Incluir aluno** (normal ou **usando reposição**) e **tirar aluno** da aula.
- **Pagamento**: a cobrança ligada ao horário (locação avulsa), com a
  situação calculada (pago, pendente, em atraso, anulado).
- **Reposição**: créditos que a aula gerou e minutos usados nela.
- Ações: **Remarcar**, **Cancelar aula**, **Encerrar horário fixo** e
  **Liberar horário** (reserva vencida).
- **Comentários** e **Histórico** de alterações do horário.

**Ações da agenda**

- **Novo horário**: fixo (toda semana), avulso (uma data) ou reposição.
- **Bloquear quadra**: uma ou mais quadras, data, horário e descrição.
- **Cancelar por chuva**: data (dia inteiro ou faixa) e quadras.
- **Reservas sem pagamento**: a lista, com as vencidas primeiro.
- **Imprimir o dia** e **Modo quadra**.

## Onde está o código

| Parte | Arquivo |
| --- | --- |
| Telas | `src/app/(app)/agenda/page.tsx`, `quadra/page.tsx`, `imprimir/page.tsx` |
| Componentes | `src/components/agenda/` (barra de cima: `BarraDaAgenda.tsx` e `SeletorDaVisao.tsx`; Mais opções: `OpcoesDaAgenda.tsx` e `FiltrosDaAgenda.tsx`; faixa da semana: `FaixaDeAssunto.tsx`; grade: `GradeDeColunas.tsx`; blocos e cartões: `CartaoOcupacao.tsx`; celular: `ListaDoDia.tsx`; mês: `VisaoMensal.tsx`) |
| Lógica da grade (sem tela) | `src/components/agenda/grade.ts` (colunas da Diária, dos Professores e da semana, posições, tamanhos, linhas que cabem no bloco, agora, o que pode ser marcado) e `estilos.ts` (`estiloDoBloco`) |
| Endereço | `src/lib/consultas/enderecoDaAgenda.ts` (`estadoDaAgendaPelaUrl`, `enderecoDaAgenda`, `trocarVisao`) |
| Leitura (consultas) | `src/lib/consultas/agenda.ts` |
| Gravação (operações) | `src/lib/banco/operacoes/agenda.ts` |
| Regras | `src/lib/banco/regras/agenda.ts` e `regras/reposicao.ts` |
| Testes | `src/lib/banco/operacoes/agenda.test.ts` (48 testes), `src/components/agenda/grade.test.ts` (grade) e `src/lib/consultas/enderecoDaAgenda.test.ts` (todos os links da tabela acima) |
| Dados de exemplo | `src/lib/banco/semente/agenda.ts` |

A tela lê só por funções de `consultas/agenda.ts`. `montarAgenda` faz uma
passada em cada tabela e devolve as ocupações do período já agrupadas por
data; a tela guarda o resultado com `useMemo` (uma semana leva ~3 ms com os
~5.000 horários de exemplo). As prévias (o que um cancelamento, bloqueio ou
chuva vai causar) usam **as mesmas funções** que as operações usam para
gravar: o que se vê antes de confirmar é o que se grava.

## Regras e hipóteses usadas

**Conflito de quadra (regra do banco).** Duas ocupações que não estejam
canceladas não dividem a mesma quadra no mesmo horário; bloqueio segue a
mesma regra. Uma aula que termina às 11:00 não conflita com outra que começa
às 11:00. A recusa sempre diz quem ocupa: "Quadra 1 já está ocupada em 30/10
das 19:00 às 20:00 (Individual · Paulo Oliveira)." A tela avisa antes, mas
quem garante é a regra (`garantirQuadraLivre`).

**H1 – Siglas de reposição.** Uma aula perdida com sigla que dá direito gera
crédito igual à duração da aula, válido por `validadeReposicaoMeses` meses,
só para os tipos de plano mensal (Individual, Dupla, LAP, Locação Mensal,
Plano de locação). Locação avulsa e ranking são pagos por uso e não geram
crédito.
- **Falta avisada** (siglas que valem para "aluno" ou "ambos", como 24h e
  TIP): o crédito é só daquele aluno. Em aula **Individual**, a falta avisada
  cancela a aula (com a mesma sigla).
- **Cancelar a aula** (siglas que valem para "ocupação" ou "ambos", como CH,
  FP, IAC e TIP, ou um texto livre): motivo obrigatório; texto livre não gera
  crédito; quem já ganhou crédito desta aula por falta avisada não ganha de
  novo. A sigla 24h é recusada para a aula inteira (ela é da falta de um
  aluno).
- **Desfazer a falta avisada** retira o crédito; se ele já foi usado, a
  operação é recusada (o saldo nunca fica negativo).

**H5 – Reserva sem pagamento.** Locação avulsa nasce "aguardando pagamento",
com prazo de `prazoPagamentoReservaHoras` horas e a cobrança a receber
(categoria "Locação", ligada à ocupação, valor de `precoDaLocacao`).
Vencido o prazo, a reserva **só entra em alerta** (anel vermelho no bloco, aviso no
topo da agenda e a lista de reservas): quem decide liberar é a recepção.
"Liberar horário" cancela a reserva com o motivo "Sem pagamento no prazo"
(sem crédito) e anula a cobrança. Se a opção
`liberarReservaAutomaticamente` estiver ligada nas Configurações, a agenda
libera sozinha as vencidas **ao ser aberta** por alguém da recepção ou pelo
dono (operação `liberarReservasVencidas`, com aviso na tela). No banco real
isso vira uma rotina agendada.

**H9 – Perfis.** O perfil de professor só consulta: a agenda abre filtrada
nas aulas dele, sem botões de alteração, e as operações recusam ("O seu
perfil só pode consultar a agenda…"). Comentários continuam liberados.

**H10 – Professor em duas aulas ao mesmo tempo.** A tela avisa e deixa
salvar. Com `bloquearProfessorEmDuasAulas` ligado, a operação recusa.

**H11 – Tablet.** O modo quadra foi pensado para tablet de 10" na horizontal
(1180 × 820): botões de 56 px de altura.

**H20 – Agenda dos professores "igual à das quadras".** Pedido do dono:
"deixe a agenda dos professores igual à agenda das quadras". Entendemos
como: a visão **Professores** abre em **hoje e amanhã, uma coluna por
professor ativo** (como a Diária com as quadras), e a semana de um professor
fica a um clique (no nome dele). Só os professores ativos ganham coluna;
locações e ranking (sem professor) não aparecem nela. A confirmar com a
arena; se ele preferir abrir direto na semana de um professor, o link
`/agenda?professor=<id>` continua valendo.

**H12 – Até quando a agenda é criada.** Um horário fixo novo vira uma aula
por semana até o fim da semana que fica `semanasGeradasAFrente` semanas à
frente (o mesmo limite dos dados de exemplo). A extensão automática depois
desse limite é uma rotina do banco real (ver "Migração").

### Decisões tomadas neste módulo (a confirmar com a arena)

1. **O prazo da reserva nunca passa do início dela.** Uma reserva para daqui a
   2 horas tem prazo até o início, e não 24 h depois. Os dados de exemplo
   seguem a mesma regra.
2. **Presença e falta só no dia da aula ou depois**; a falta avisada pode ser
   marcada antes. Marcar presença ou falta muda a aula para "realizada" (é
   o que o repasse do professor conta).
3. **Aula que já aconteceu ("realizada") não é remarcada**; cancelar
   continua possível (ex.: chuva registrada depois).
4. **Remarcar** muda só aquela data; o horário fixo continua igual nas
   outras semanas. A cobrança ainda não paga da locação acompanha a nova
   data e duração.
5. **Quem entrou na aula usando reposição** é tratado como os outros alunos
   se a aula for cancelada (ganha crédito se a sigla der direito). Se for
   **tirado da aula**, os minutos usados voltam.
6. **Encerrar horário fixo** tira as aulas depois da data escolhida que ainda
   não aconteceram (de hoje em diante, agendadas ou aguardando pagamento),
   junto com os alunos delas, os créditos que elas geraram e os usos de
   reposição nelas (os minutos voltam). Se um desses créditos já foi usado,
   a operação é recusada. Canceladas e realizadas ficam como histórico.
7. **Bloqueio** só a partir de hoje e nunca por cima de outro bloqueio.
8. **Chuva** aceita qualquer data (dá para registrar a chuva de ontem) e não
   mexe nos bloqueios.
9. **Reserva já paga** cancelada (chuva, bloqueio) continua paga: a tela
   avisa para combinar a devolução no Financeiro.
10. Aulas com professor (Individual, Dupla, LAP) exigem professor; locações
    e ranking não têm professor.

## O que ficou de fora (e por quê)

- **Registrar o pagamento da reserva** dentro da agenda: é do módulo
  Financeiro (a agenda mostra a cobrança e leva até lá). Pela convenção entre
  módulos, ao pagar uma cobrança ligada a uma ocupação "aguardando
  pagamento", o Financeiro muda a ocupação para "agendada".
- **Desfazer um cancelamento** (reativar a aula): não foi pedido; hoje se
  marca de novo.
- **Tirar um aluno de um horário fixo** (só ele, nas próximas semanas): não
  foi pedido; tira-se da aula de cada data ou encerra-se o horário.
- **Extensão automática do horizonte (H12)** e **liberação automática por
  horário (H5)**: são rotinas do banco real; no front não passa tempo.
- **Arrastar e soltar** na grade e **avisos aos alunos** (WhatsApp): fora da v1.

## Roteiro de teste (para fazer na tela)

Os dados voltam ao início a cada recarga da página (modo demonstração). Faça
os passos em sequência, navegando pelos botões da própria agenda.

1. **Diária**: entre como **Recepção** e clique em **Agenda**. Deve aparecer
   a **Diária** ocupando quase a tela toda: em cima, só uma linha (Diária |
   Professores | Quadra | Mês, a data grande com ‹ ›, Hoje, a placa amarela
   das reservas vencidas, + Novo horário e Mais opções). Embaixo, hoje e
   amanhã lado a lado em letra grande ("Quinta-feira, 05/11" com o selo
   HOJE), cinco colunas em cada dia (Quadra 1 em azul; 2, 3, 4 e Paredão em
   laranja), linhas de 30 em 30 minutos, a linha vermelha do agora com a
   bolinha amarela, o que já passou com uma película cinza e a grade rolada
   até o agora. Nenhum tipo aparece cortado ("IN…"): ou "INDIV." inteiro, ou
   nada.
   **Mais opções**: clique. Abre um painel com as ações (Bloquear quadra,
   Cancelar por chuva, Reservas sem pagamento, Imprimir o dia, Modo quadra,
   Ir para a data), os filtros, os números ("… horários hoje e amanhã · …
   alunos · …% de ocupação · … canceladas · … a pagar") e a legenda. Clique
   em **Renata Coelho** nos filtros: a grade fica só com as aulas dela.
   Clique em **Menos opções**: o painel fecha e o botão mostra "1" (um
   filtro ligado). Abra de novo e volte para **Todos**.
2. **Clique às 07:30**: amanhã, passe o mouse numa meia hora livre que começa
   às **07:30** (aparece "+ 07:30") e clique. O **Novo horário** abre com a
   data de amanhã, início **07:30**, término 08:30 e a quadra daquela coluna
   já marcada. Feche.
3. **Quadra**: clique em **Quadra**. Aparece a semana da Quadra 1 (botão
   "Quadra 1" pintado de azul na faixa de cima); clique em **Paredão**: a
   semana do paredão. Clique no cabeçalho de
   um dia: abre a **Diária** daquele dia com a coluna do paredão realçada em
   amarelo.
4. **Professores**: clique em **Professores**. Aparecem hoje e amanhã lado a
   lado, **uma coluna por professor** (Alexandre Pires, Renata Coelho, Márcio
   Bueno), cada cabeçalho na cor do professor, e cada bloco com a quadra
   (Q2, PAR…). Clique numa meia hora livre na coluna da Renata: o Novo
   horário abre com **Individual**, a Renata como professora e a primeira
   quadra livre naquele horário. Feche. Clique no nome **Renata Coelho** no
   cabeçalho: abre a **semana dela** (sete dias), com a faixa "Todos os
   professores | … | Renata Coelho" em cima. Clique em **Todos os
   professores**: volta para os dois dias.
5. **Mês e filtros**: clique em **Mês** e depois num dia: abre a Diária do
   dia. Os dias de chuva dos dados de exemplo (4, 19 e 33 dias atrás) mostram
   "Chuva" no mês e, na Diária, blocos brancos tracejados com a sigla **CH**.
   Desligue **Mostrar canceladas**: elas somem e o contador diz
   "(escondidas)".
6. **LAP**: abra `/agenda?tipo=LAP` (ou o atalho LAP do Início): a Diária
   mostra só as aulas LAP, com "LAP" no filtro de tipo.
7. **Link antigo**: abra `/agenda?data=<uma data>&quadra=2` (o link do
   "Precisa de atenção" do Início): abre a Diária daquela data com a coluna
   da Quadra 2 realçada. `/agenda?visao=semana&quadra=3` abre a visão Quadra
   da Quadra 3. Recarregue a página: a tela continua igual.
8. **Nome do aluno** (computador): clique no nome de um aluno num bloco:
   abre a ficha. Volte.
9. Clique num bloco (fora do nome): abre o **painel do horário** (o endereço
   ganha `&ocupacao=…`; recarregar mantém o painel aberto). Em uma
   aula de hoje, clique em **Presente** de um aluno: aparece "Presença de …
   marcada." e a aula passa a "Realizada". Clique em **Avisou** de outro
   aluno, escolha **24h** e confirme: aparece "Falta avisada (24h)
   registrada. … ganhou 1h de reposição." e o crédito aparece em
   **Reposição**. Abra **Histórico** para ver a alteração.
10. Ainda no painel, clique em **Cancelar aula**, escolha **FP — Falta do
   professor**: antes de confirmar aparecem os minutos de cada aluno. Confirme:
   a aula fica branca e tracejada na grade, riscada, com a sigla FP.
11. **Erro de regra (conflito)**: clique em **Novo horário** → **Avulso** →
   tipo **Individual**, a data de hoje, início **19:00** e uma quadra marcada
   como "ocupada" (o aviso vermelho já diz quem ocupa). Escolha um aluno e
   clique em **Salvar horário**. Deve aparecer o erro "Quadra … já está
   ocupada em … (… · nome do aluno)" e nada é gravado.
12. **Locação avulsa**: no mesmo formulário, troque para **Locação Avulsa**,
   escolha uma quadra "livre" e salve. Aparece "Reserva marcada (…). Ela
   aguarda pagamento por até 24 h." e o cartão ganha o relógio de
   "aguardando pagamento".
13. **Horário fixo com conflito**: **Novo horário** → **Fixo** → Individual,
    primeira aula no **sábado desta semana**, início **12:00**, **Quadra 2**,
    professora **Renata Coelho**, aluno **Gustavo**. A lista de datas mostra
    o sábado da semana que vem em conflito com o bloqueio do torneio interno
    (e quem ocupa), e o botão fica desabilitado. Marque **Pular esta data** e
    clique em **Criar horário fixo (… aulas)**: aparece "Horário fixo criado:
    todo sábado, 12:00–13:00, Quadra 2".
14. **Reposição sem saldo (erro de regra)**: abra uma aula futura, clique em
    **Incluir aluno**, escolha alguém com "(sem saldo)" e clique em **Usar
    reposição**: aparece "Saldo de reposição insuficiente: o aluno tem 0
    minutos e a aula precisa de 60." Agora use o aluno que ganhou crédito
    no passo 6: ele entra na aula e o saldo diminui.
15. **Remarcar**: no painel de uma aula futura, clique em **Remarcar**,
    escolha um horário ocupado (o aviso vermelho diz quem ocupa) e depois
    um livre, e salve.
16. **Encerrar horário fixo**: no painel de uma aula fixa futura, clique em
    **Encerrar horário fixo**. A janela mostra quantas aulas saem da agenda.
    Confirme e veja que as semanas seguintes ficaram sem a aula.
17. **Bloquear quadra**: clique em **Bloquear quadra**, escolha **Quadra 3**,
    amanhã, 07:00 às 10:00, descrição "Manutenção do saibro". A prévia
    lista as aulas e os minutos. Confirme duas vezes: as aulas ficam
    canceladas com **IAC** e a quadra aparece listrada como bloqueada.
18. **Chuva**: clique em **Cancelar por chuva**, deixe a data de hoje,
    escolha **Faixa de horário** 17:00 às 19:00 e todas as quadras. Confirme:
    aparece o resumo com o número de aulas, de alunos e as horas de
    reposição.
19. **Reservas sem pagamento**: clique na **placa amarela** "… reserva(s)
    vencida(s)" da barra de cima (ou em Mais opções → Reservas sem
    pagamento). A reserva com prazo vencido vem primeiro; clique em
    **Liberar horário** e confirme: ela é cancelada com "Sem pagamento no
    prazo" e a placa some quando não sobra nenhuma vencida.
20. **Modo quadra** (no tablet): em Mais opções, clique em **Modo quadra**, escolha a quadra
    e marque **Presente** e **Falta** nos botões grandes.
21. **Imprimir**: em Mais opções, clique em **Imprimir o dia** e depois em **Imprimir**. A
    folha sai deitada, uma coluna por quadra, sem os menus do sistema.
22. **Perfil de professor**: saia, entre como **Renata Coelho** e abra a
    Agenda: abre a **semana dela** ("Só as suas aulas" na barra de cima),
    sem "+ Novo horário" nem meias horas clicáveis; em Mais opções não há
    Bloquear quadra, Cancelar por chuva nem Reservas, e aparece o aviso de
    que o perfil só consulta. Na Diária e no Mês também só aparecem as
    aulas dela.
23. **Tablet e celular**: no tablet deitado (1180 px) a barra de cima cabe
    numa linha, a Diária mostra as 10 colunas e cada meia hora tem 54 px; no
    tablet em pé, um dia por vez (as setas ‹ › andam um dia); no celular, a
    barra empilhada (visões, data, placa e Mais opções) e a lista do dia com
    a régua "Hoje | Amanhã" (nas visões Quadra e semana do professor, a
    régua com os 7 dias; na Professores, a faixa com os professores em
    cima). Nenhuma tela rola para o lado.
24. **Links antigos**: `/agenda?professor=prof-2` (ficha do professor) abre
    a semana da Renata; `/agenda?visao=professor` (mosaico do Início,
    "Agenda Professores") abre os dois dias com todos os professores.

## Para os outros módulos

- **Painel (dashboard)**: lê `banco.ocupacoes` direto; nenhum campo foi
  renomeado. As ocupações criadas na sessão entram **no fim** da lista (ela
  não fica ordenada). Ocupação "Bloqueio" é a quadra fechada. Para abrir um
  horário específico: `/agenda?ocupacao=<id>` (abre na data dele); a semana
  de uma quadra: `/agenda?visao=quadra&quadra=<id>`; o dia com uma quadra
  realçada: `/agenda?data=AAAA-MM-DD&quadra=<id>`. Os endereços são montados
  e lidos em `consultas/enderecoDaAgenda.ts` (testado).
- **Financeiro**: a locação avulsa cria um `Lancamento` a receber
  (categoria "Locação", `ocupacaoId`, vencimento = data do prazo). Ao pagar,
  mude a ocupação para "agendada" (convenção). Quando a agenda cancela,
  libera, remarca ou encerra, a cobrança **ainda não paga** é anulada
  (`canceladoEm` + `motivoCancelamento`) ou atualizada; cobrança paga não é
  mexida.
- **Alunos (ficha e extrato)**: créditos em `banco.reposicoes` com `sigla`,
  `ocupacaoOrigemId` e `validade`; usos com minutos negativos e
  `ocupacaoUsoId`. Desfazer a falta avisada apaga o crédito; tirar o aluno
  da aula apaga o uso (os minutos voltam); encerrar horário fixo apaga
  créditos e usos das aulas que saem. A auditoria guarda tudo.
- **Professores**: o atalho "Ver agenda deste professor" usa
  `/agenda?professor=<id>` (o nome também funciona): abre a semana dele na
  visão Professores. O mosaico do Início ("Agenda Professores") usa
  `/agenda?visao=professor`: hoje e amanhã com todos (H20).
- **Configurações**: a agenda lê `siglas`, `validadeReposicaoMeses`,
  `prazoPagamentoReservaHoras`, `liberarReservaAutomaticamente`,
  `semanasGeradasAFrente`, `bloquearProfessorEmDuasAulas`,
  `precoLocacaoHora` e `precoParedaoHora`. Nenhum parâmetro novo foi criado.

## Notas para a migração ao Supabase

| No front | No banco |
| --- | --- |
| `garantirQuadraLivre` | Constraint de exclusão em `ocupacoes`: `EXCLUDE USING gist (quadra_id WITH =, tsrange(data + hora_inicio, data + hora_fim) WITH &&) WHERE (situacao <> 'cancelada')` (extensão `btree_gist`). |
| `garantirHorarioValido` | `CHECK (hora_inicio < hora_fim AND hora_inicio >= '07:00' AND hora_fim <= '22:00')`. |
| `criarHorarioAvulso` | Função `criar_horario_avulso`: insere a ocupação, os alunos e, na locação avulsa, o lançamento, numa transação. |
| `criarHorarioFixo` | Função `criar_horario_fixo(…, datas_puladas date[])`: molde, alunos do molde e uma ocupação por data. |
| `marcarAulaDeReposicao`, `usarReposicao` | Função `usar_reposicao`: confere o saldo na view `saldo_reposicao` e grava o uso. |
| `marcarPresenca` | Função `marcar_presenca` (crédito da falta avisada e cancelamento da aula individual). |
| `cancelarOcupacao`, `cancelarPorChuva`, `bloquearQuadra` | Funções `cancelar_ocupacao`, `cancelar_por_chuva`, `bloquear_quadra`, todas usando a mesma rotina interna de cancelamento (créditos + anulação da cobrança). |
| `remarcarOcupacao` | `update` em `ocupacoes` (a constraint recusa o conflito) + ajuste da cobrança. |
| `incluirAluno`, `removerAluno` | `insert`/`delete` em `ocupacao_alunos` (a remoção apaga o uso de reposição). |
| `encerrarHorarioFixo` | Função `encerrar_horario_fixo`. |
| `liberarReserva`, `liberarReservasVencidas` | Função `liberar_reserva` e uma rotina agendada (pg_cron) quando `liberar_reserva_automaticamente` estiver ligado. |
| Horizonte H12 | Rotina agendada semanal que gera as ocupações dos horários fixos até o novo limite. |
| `garantirPodeEditarAgenda` (H9) | Políticas de RLS por perfil (professor só lê). |
| `garantirProfessorLivre` (H10) | Gatilho que consulta `bloquear_professor_em_duas_aulas`. |
| Auditoria | O gatilho único de auditoria do banco. |

As consultas (`consultas/agenda.ts`) passam a buscar do banco por período
(`where data between …`), e as telas não mudam.

## No banco (funções)

Versão de 30/10/2026. As operações da agenda já existem como **funções do
banco** (migração `supabase/migrations/20261030120100_funcoes_agenda.sql`).
Quando o front for ligado ao Supabase, cada botão chama a função com
`supabase.rpc("nome_da_funcao", { p_campo: valor })`: os campos são os mesmos
dos `dados` da operação, em snake_case e com `p_` na frente (`alunosIds` →
`p_alunos_ids`). Datas vão como `"AAAA-MM-DD"` e horas como `"HH:MM"`.

Cada função é "tudo ou nada": se uma regra for violada, nada é gravado e a
tela recebe **a mesma mensagem** que mostra hoje. Todas rodam com as
permissões de quem está logado (a RLS continua valendo; professor recebe "Seu
perfil não tem permissão para esta operação.") e gravam o nome da operação no
Histórico (auditoria).

| Operação da tela | Função no banco | O que devolve |
| --- | --- | --- |
| `criarHorarioAvulso` | `criar_horario_avulso(p_quadra_id, p_data, p_hora_inicio, p_hora_fim, p_tipo, p_alunos_ids, p_professor_id?, p_descricao?)` | id da ocupação |
| `criarHorarioFixo` | `criar_horario_fixo(p_quadra_id, p_data_inicio, p_hora_inicio, p_hora_fim, p_tipo, p_alunos_ids, p_professor_id?, p_fim?, p_datas_puladas?)` | `{ horario_fixo_id, aulas }` |
| `marcarAulaDeReposicao` | `marcar_aula_de_reposicao(p_aluno_id, p_quadra_id, p_data, p_hora_inicio, p_hora_fim, p_tipo, p_professor_id?)` | id da ocupação |
| `incluirAluno` | `incluir_aluno(p_ocupacao_id, p_aluno_id)` | id da participação |
| `usarReposicao` | `usar_reposicao(p_ocupacao_id, p_aluno_id)` | `{ minutos, saldo }` (saldo que sobra) |
| `removerAluno` | `remover_aluno(p_ocupacao_id, p_aluno_id)` | `{ minutos_devolvidos }` |
| `marcarPresenca` | `marcar_presenca(p_ocupacao_id, p_aluno_id, p_presenca, p_sigla?)` | `{ minutos_de_credito, aula_cancelada }` |
| `cancelarOcupacao` | `cancelar_ocupacao(p_id, p_motivo)` | `{ aulas, alunos, minutos, creditos }` |
| `remarcarOcupacao` | `remarcar_ocupacao(p_id, p_quadra_id, p_data, p_hora_inicio, p_hora_fim)` | id da ocupação |
| `encerrarHorarioFixo` | `encerrar_horario_fixo(p_horario_fixo_id, p_fim)` | `{ aulas_removidas }` |
| `bloquearQuadra` | `bloquear_quadra(p_quadras_ids, p_data, p_hora_inicio, p_hora_fim, p_descricao)` | `{ bloqueios, aulas, alunos, minutos, creditos }` |
| `cancelarPorChuva` | `cancelar_por_chuva(p_data, p_quadras_ids, p_hora_inicio?, p_hora_fim?)` | `{ aulas, alunos, minutos, creditos }` |
| `liberarReserva` | `liberar_reserva(p_id)` | id da ocupação |
| `liberarReservasVencidas` | `liberar_reservas_vencidas()` | quantas reservas foram liberadas |
| Saldo de reposição (ficha, agenda) | view `saldo_reposicao` (uma linha por aluno: `aluno_id`, `saldo`, `proximo_vencimento`, `minutos_a_vencer`) | leitura: `supabase.from("saldo_reposicao").select().eq("aluno_id", id)` |

`?` = opcional. Em `creditos` vem uma lista `{ aluno_id, ocupacao_id, minutos }`
com os créditos de reposição criados; `minutos` é a soma deles.

Nenhuma operação da agenda ficou como gravação direta na tabela: todas têm
alguma regra que as constraints não garantem sozinhas (aula cancelada, aluno
inativo, saldo, crédito já usado…). Comentários continuam gravando direto em
`comentarios`.

**Como as regras ficaram no banco**

- **Conflito de quadra**: a constraint de exclusão de `ocupacoes` garante a
  regra mesmo com dois balcões ao mesmo tempo. As funções conferem antes só
  para devolver a mensagem que diz quem ocupa ("Quadra 1 já está ocupada em
  12/11 das 10:00 às 11:00 (Individual · Ana)").
- **Professor em duas aulas (H10)**: não há constraint; com
  `bloquear_professor_em_duas_aulas` ligado, as funções recusam e travam o
  professor durante a gravação (dois balcões não marcam o mesmo professor ao
  mesmo tempo).
- **Saldo de reposição**: sempre calculado do extrato (`reposicoes`), com a
  mesma regra do front: crédito vencido não conta, cada uso consome primeiro o
  crédito que vence antes, e o saldo nunca fica negativo (retirar um crédito já
  usado é recusado). O extrato do aluno fica travado durante a gravação, para
  dois balcões não gastarem o mesmo saldo.
- **Reservas sem pagamento (H5)**: além de "Liberar horário" e de
  `liberar_reservas_vencidas` (que a agenda chama ao abrir quando a opção está
  ligada), há uma **rotina automática a cada 15 minutos** (pg_cron, só no
  Supabase). Ela só libera algo se `liberar_reserva_automaticamente` estiver
  ligado nas Configurações. Como roda sem ninguém logado, fica numa função
  interna (`privado.liberar_reservas_vencidas_automaticamente`) que ninguém
  pode chamar pelo site; no Histórico ela aparece sem usuário, como "Liberar
  reservas vencidas (automático)".

**Diferenças em relação ao front (pequenas)**

- Na descrição de quem ocupa a quadra, os nomes dos alunos vêm em ordem
  alfabética (no front, na ordem em que entraram na aula).
- Quem não tem permissão de gravar na agenda recebe "Seu perfil não tem
  permissão para esta operação." (no front: "O seu perfil só pode consultar a
  agenda…").
- Data inexistente (ex.: 30/02) é recusada pelo próprio Postgres antes da
  função, com erro técnico de data; a tela já não deixa escolher.
- Reserva aguardando pagamento sem prazo (não acontece pelas funções) recusa
  "Liberar horário" com "Esta reserva não tem prazo de pagamento."
- Encerrar horário fixo apaga as aulas; a cobrança anulada delas perde o
  vínculo com a aula (o histórico guarda tudo).
- Quem enxerga a agenda mas não o financeiro não consegue marcar locação
  avulsa (a cobrança é recusada pela RLS) e, ao cancelar, a cobrança não é
  anulada. Com as permissões atuais (H9), dono e recepção têm os dois.

**Ainda não feito**: a rotina que estende os horários fixos além das 12
semanas (H12).

**Como testar**: `supabase test db` (arquivo
`supabase/tests/40_agenda.test.sql`, 88 testes: caminho feliz e cada recusa
importante, permissão do professor e auditoria).

**Ligação com as telas** (versão de 03/11/2026). As 14 operações da agenda
estão ligadas às funções acima em `src/lib/supabase/operacoes/agenda.ts`
(todas por função do banco, nenhuma grava direto na tabela). No modo
Supabase, cada botão roda primeiro a regra da tela (mesmas mensagens), depois
a função do banco, e relê as tabelas que ela pode mudar (ocupações, alunos da
aula, reposições, cobranças e, no horário fixo, os moldes). Testes de
integração: `src/lib/supabase/operacoes/agenda.integracao.test.ts` (10 testes,
com os usuários de teste da recepção, do professor e do dono; como rodar em
`src/lib/supabase/integracao/ambiente.ts`). Diferenças entre os dois modos:

- Os ids dos registros criados vêm do banco. O id do registro principal volta
  para a tela (ocupação criada, molde do horário fixo, primeiro bloqueio,
  participação incluída); hoje nenhuma tela abre o registro recém-criado (o
  "Novo horário" só leva a agenda até a data).
- Os números das mensagens de sucesso (aulas canceladas pela chuva ou pelo
  bloqueio, minutos de reposição, reservas liberadas) são os da prévia da
  tela. Se outra pessoa mudou a agenda nesse meio-tempo, a grade relida mostra
  o que de fato ficou gravado.
- "Liberar todas as vencidas" e a liberação automática ao abrir a agenda usam
  o relógio do banco e liberam **todas** as reservas vencidas, mesmo as que a
  tela ainda não contava. A liberação automática agora espera a gravação; se
  outra gravação estiver em andamento, tenta de novo quando o banco mudar.
- No teste de integração, os testes de liberar reserva só rodam depois das
  09:00 (precisam de uma reserva de hoje que já começou) e liberam também as
  reservas vencidas dos dados de exemplo do banco de teste.

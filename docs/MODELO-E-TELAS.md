# Modelo de dados e plano das telas (rascunho v1)

Rascunho de 29/10/2026, para revisão da equipe. Parte do MVP que já está no ar
e diz, tela por tela, o que fica, o que muda e o que é novo, e quais dados cada
tela vai usar. Serve de base para o trabalho no front agora e para o banco
depois.

Como ler as marcações:

- **[base]**: funcionalidade que a v1 precisa ter.
- **[cliente]**: pedido feito pela arena nas conversas de levantamento.
- **[sugestão]**: ideia da equipe; pode sair sem prejuízo.
- **[fora da v1]**: não entra agora.
- **Hipótese**: regra que a arena ainda não confirmou. Vira um parâmetro que
  pode ser trocado na tela de Configurações, sem programar.

---

## 1. As ideias principais, em linguagem simples

1. **A agenda passa a ter datas.** Hoje o MVP guarda um molde semanal ("toda
   terça às 10h"). No modelo novo o molde continua existindo, mas cada aula vira
   uma linha com data. Com isso dá para cancelar só a aula do dia 10, bloquear
   uma quadra num dia, marcar presença e falta e ver o histórico real.
2. **O banco impede o conflito.** Duas ocupações na mesma quadra e horário não
   são gravadas, e o bloqueio de quadra segue a mesma regra. A tela avisa antes,
   mas quem garante é o banco.
3. **Reposição é um extrato, não um número.** Cada crédito (aula cancelada com
   sigla que dá direito) e cada uso fica registrado, com validade de 3 meses. O
   saldo é a soma do que está válido.
4. **Todo dinheiro é um lançamento.** A receber ou a pagar, com vencimento. A
   situação (pago, pendente, em atraso) é calculada sozinha pela data.
5. **Estoque é a soma dos movimentos.** Ninguém digita o saldo. Uma venda no
   balcão gera a baixa no estoque e o lançamento a receber de uma vez só.
6. **Ranking vem das partidas.** Registra-se o resultado e a pontuação é
   recalculada. As chaves de torneio são partidas ligadas umas às outras: quem
   vence avança sozinho.
7. **Tudo deixa rastro.** Cada alteração grava quem fez, quando, como era e como
   ficou. Qualquer registro pode receber comentários.

Como as peças se ligam:

```
Aluno ── Matrícula (plano, valor, vencimento) ── Mensalidades (lançamentos a receber)
  │
  └── Horário fixo (molde semanal) ── gera ── Ocupações (uma por data)
                                                 │
                                                 ├── Presença / falta (com sigla)
                                                 └── Cancelamento ── crédito no extrato de reposição

Consumo no balcão ── baixa no estoque + lançamento a receber (tudo ou nada)

Partida ── pontuação do ranking
Torneio ── inscritos ── partidas encadeadas (o vencedor avança)
```

---

## 2. Tela por tela

### Login

- **Fica:** visual da tela.
- **Muda:** hoje escolhe-se um usuário fictício. Passa a ser e-mail e senha
  individuais **[cliente]**. O perfil de quem entra define o que aparece
  (ver Hipótese H9).

### Painel (dashboard)

- **Fica:** quadras em 3D, aulas de hoje, próximos horários, indicadores do dia.
- **Muda:** o quadro "Precisa de atenção" passa a juntar tudo o que pede ação
  **[sugestão]**:
  - reservas perto de vencer o prazo de pagamento;
  - mensalidades em atraso;
  - produtos abaixo do mínimo;
  - créditos de reposição que vencem em até 30 dias.
- **Corrige:** o cartão do financeiro dizia 12 reservas atrasadas e a lista
  mostrava 6.

### Agenda

- **Fica:** visões de semana e mês, cores por tipo e legenda, filtros por quadra,
  professor e tipo, versão de celular, clique num espaço livre para marcar.
- **Muda:**
  - A grade mostra as aulas de cada data, não o molde. Cancelar uma aula não
    mexe nas outras semanas **[base]**.
  - Conflito deixa de ser só "borda vermelha": o sistema não deixa salvar e diz
    quem já ocupa a quadra naquele horário **[base]**.
  - "Novo horário" pergunta se é **fixo** (repete toda semana) ou **avulso**
    (uma data). No fixo, antes de salvar, a tela mostra as datas que batem com
    outra ocupação e deixa a pessoa decidir o que fazer com cada uma **[base]**.
- **Novo:**
  - **Visão de dia no computador**, com uma coluna por quadra. Hoje ela só
    existe no celular **[base]**.
  - **Painel do horário**, aberto ao clicar numa aula **[base] [cliente]**:
    - alunos (nome clicável abre a ficha) e professor;
    - indicador de "confirmado" (pago);
    - comentários e histórico de alterações;
    - ações: marcar presença ou falta, cancelar (motivo obrigatório, mostra os
      minutos de reposição gerados), remarcar e usar reposição.
  - **Bloquear quadra** (manutenção, evento, torneio) **[base]**.
  - **Cancelar por chuva**: escolhe o período e as quadras, e todas as aulas
    afetadas são canceladas com a sigla CH, gerando os créditos **[cliente]**.
  - **Locação avulsa com prazo de pagamento**: fica marcada como "aguardando
    pagamento" até ser paga (ver Hipótese H5) **[cliente]**.
  - **Panorama por professor**: a agenda filtrada por professor ganha atalho a
    partir da ficha dele **[cliente]**.

### Alunos (tela nova: lista)

Hoje não existe lista de alunos: só se chega à ficha pela agenda ou pelo
ranking.

- Busca por nome e filtros por plano, professor e situação (ativo, congelado,
  inativo) **[base]**.
- Botão "Novo aluno", que abre o formulário de cadastro **[base]**.

### Ficha do aluno

- **Fica:** cabeçalho, indicadores, histórico de aulas e de pagamentos, consumo,
  comentários, horários fixos.
- **Muda:**
  - Botão **Editar cadastro** **[base]**.
  - **Matrícula**: plano atual, valor combinado, dia de vencimento e histórico
    de trocas de plano **[cliente]**.
  - **Reposição vira extrato**: cada crédito e uso, com sigla, aula que gerou,
    aula onde foi usado e validade. O saldo aparece em cima **[cliente]**.
  - **Congelar plano** pede início, fim previsto e motivo, e guarda o
    histórico de congelamentos (ver Hipótese H4) **[cliente]**.
  - O histórico de aulas mostra quem marcou cada falta e por qual motivo
    **[cliente]**.
- **Corrige:** havia uma ficha mostrando cobranças em nome de outra pessoa.

### Ficha do professor

- **Fica:** agenda da semana, alunos, indicadores.
- **Muda:** "Comissão estimada" vira **repasse do mês**: aulas dadas,
  valor previsto pela regra do professor, valor pago e diferença (ver Hipótese
  H6) **[base]**.
- **Novo:** botão "Ver agenda deste professor" e um formulário de cadastro e
  edição **[base]**.

### Financeiro

- **Fica:** indicadores do mês, tabela de lançamentos com busca e filtros, lista
  de reservas sem pagamento, botão de exportar (passa a gerar planilha de
  verdade).
- **Muda:**
  - Duas abas: **A receber** e **A pagar** (despesas, fornecedores, repasses)
    **[base]**.
  - Situação calculada sozinha: **pago**, **pendente** ou **em atraso** (passou
    do vencimento e não foi pago) **[base]**.
  - **Novo lançamento** (formulário): pessoa, quem pagou, item, valor, forma de
    pagamento, vencimento e comprovante **[cliente]**.
  - **Relatório de professores**: previsto x pago, por mês **[base] [cliente]**.
- **Sai da v1:**
  - a aba "Planejamento", com fluxo de caixa e projeções **[fora da v1]**;
  - conciliação com banco e maquininha e integração com convênio
    **[fora da v1]**. As formas de pagamento continuam existindo como opções da
    lista.
- **A confirmar:** o gráfico de divisão por forma de pagamento pode ficar como
  relatório simples **[sugestão]**. A separação "coberto pelo convênio x
  complemento" cabe na v1 se for só registro do valor, mas não se depender de
  integração.

### Estoque

- **Fica:** cartões dos produtos, alerta de mínimo, lista de compras, mais
  vendidos, movimentações, lançar consumo, entrada e perda.
- **Muda:**
  - **Cadastro e edição de produto** (formulário) **[base]**.
  - O consumo lançado gera o lançamento a receber no financeiro **[cliente]**.
  - O saldo passa a ser calculado pelos movimentos.

### Ranking e torneios

- **Fica:** ranking geral, lista de torneios, categorias A a D, foto e
  variação de posição.
- **Muda:**
  - **Registrar resultado de partida** (formulário). A pontuação é
    recalculada (ver Hipótese H7) **[base]**.
  - A **pirâmide sai** **[fora da v1]**. No lugar entra a **tela de chave** nos
    três formatos da v1: eliminatória simples (com folga para quem é cabeça de
    chave quando o número de inscritos não fecha), fase de grupos seguida de
    eliminatória, e todos contra todos. Registrar o resultado avança o vencedor
    sozinho **[base]**.
  - **Criar torneio**: nome, formato, categoria, inscritos e cabeças de chave
    **[base]**.
  - Partida de ranking com reserva de quadra (roxo) aparece na agenda
    **[cliente]**.

### Configurações (tela nova, só para o dono)

É onde moram as regras ainda sem resposta (seção 4), para que possam ser
ajustadas sem programar **[sugestão]**:

- siglas de reposição;
- prazo de pagamento de reserva;
- validade da reposição;
- pontuação do ranking;
- regras de torneio;
- planos e preços;
- formas de pagamento;
- regra de repasse.

### Histórico de alterações (tela nova, só para o dono)

Lista de tudo o que foi criado, alterado ou apagado, com filtros por pessoa,
data e tipo de registro **[cliente]**. Cada ficha também ganha uma aba
"Histórico" com o que mudou nela.

### Em todas as telas

- Campo de comentários onde fizer sentido **[cliente]**.
- Layout pensado para o **tablet** na quadra e para o **computador** na
  recepção, além do celular que o MVP já tem **[base]**.
- Mensagens de erro claras e confirmação antes de ações que apagam ou cancelam
  **[sugestão]**.

---

## 3. Modelo de dados

Cada linha é uma tabela do banco. "Situação" compara com o que já foi criado no
Supabase (branch `supabase`, PR #2).

### Base

| Tabela | O que guarda | Situação |
| --- | --- | --- |
| `colaboradores` | Quem faz login: nome, cargo, perfil (dono, recepção ou professor) e, se for professor, qual. | Existe; mudam os nomes dos perfis |
| `configuracoes` | As regras ajustáveis da tela de Configurações. | Nova |
| `auditoria` | Registro automático de toda criação, alteração e exclusão: tabela, registro, quem, quando, antes e depois. Ninguém edita nem apaga. | Nova |
| `comentarios` | Comentário ligado a qualquer registro (aluno, aula, lançamento, produto, torneio), com autor e data automáticos. Cada pessoa edita só o seu. | Existe só para aluno; passa a valer para tudo |

### Cadastros

| Tabela | O que guarda | Situação |
| --- | --- | --- |
| `quadras` | Quadras 1 a 4 e paredão, com o piso. | Existe, igual |
| `professores` | Nome, cor na agenda, especialidade e regra de repasse. | Existe; ganha a regra de repasse |
| `alunos` | Dados de contato, foto, professor principal, situação (ativo, congelado, inativo), categoria do ranking. | Existe; perde o saldo de reposição e a pontuação, que passam a ser calculados |
| `planos` | Catálogo: nome, tipo (Individual, Dupla, LAP, Locação Mensal, Locação Avulsa, Plano de locação), preço, aulas por semana, duração da aula e se é da tabela nova ou antiga. | Nova **[sugestão]** |
| `matriculas` | Qual plano cada aluno tem, valor combinado, dia de vencimento, início e fim. | Nova **[sugestão]** |
| `congelamentos` | Períodos em que a matrícula ficou parada, com motivo. | Nova; hoje é só "sim/não" no aluno **[sugestão]** |

As três tabelas marcadas como sugestão não estão na lista mínima do plano. Elas
entram porque a arena pediu matrícula, histórico de congelamento e duas tabelas
de planos, e guardar isso só dentro do aluno perderia o histórico.

### Agenda e reposição

| Tabela | O que guarda | Situação |
| --- | --- | --- |
| `horarios_fixos` | O molde de uma aula que se repete: quadra, dia da semana, horário, tipo, professor, a partir de quando e até quando. | Existe como `horarios`; ganha início e fim |
| `horario_alunos` | Alunos de cada horário fixo, sem limite de pessoas. | Existe, igual |
| `ocupacoes` | Cada uso da quadra numa data: aula, locação, ranking ou **bloqueio**. Guarda o horário fixo de origem, a situação (agendada, aguardando pagamento, realizada ou cancelada), o motivo do cancelamento e o prazo de pagamento quando houver. **Duas ocupações ativas na mesma quadra e horário são recusadas pelo banco.** | Nova; é o centro da agenda |
| `ocupacao_alunos` | Quem participa de cada ocupação e o que aconteceu: presente, faltou ou avisou, com a sigla. | Nova; substitui `aulas` |
| `reposicoes` | Extrato de minutos: crédito (+) ou uso (−), sigla, aula que gerou, aula onde foi usado e validade (3 meses a partir do crédito). Saldo = créditos válidos − usos; nunca negativo; o uso consome primeiro o que vence antes. | Nova; substitui o saldo guardado no aluno |

A tabela `dias_sem_aula` deixa de ser necessária: o cancelamento por chuva
cancela as ocupações com a sigla CH.

### Financeiro

| Tabela | O que guarda | Situação |
| --- | --- | --- |
| `lancamentos` | Tudo o que entra ou sai: a receber ou a pagar, categoria (mensalidade, aula avulsa, locação, consumo, torneio, despesa, repasse), pessoa, quem pagou, item, valor, vencimento, data do pagamento, forma de pagamento e comprovante. Ligado à matrícula, ocupação, consumo ou torneio que o gerou. A situação é calculada pelo vencimento. | Existe como `pagamentos`; ganha "a pagar", vencimento e ligações |
| `repasses` | Fechamento mensal de cada professor: aulas dadas, valor previsto pela regra e valor pago. | Nova |

### Estoque

| Tabela | O que guarda | Situação |
| --- | --- | --- |
| `produtos` | Nome, categoria, unidade, preço de custo e de venda, estoque mínimo. | Existe; o saldo deixa de ser guardado à mão |
| `movimentos_estoque` | Entradas, vendas, perdas e ajustes. O saldo é a soma deles. | Existe, igual |
| `consumos` | O que cada aluno ou professor consumiu. Gera, numa operação só, a baixa no estoque e o lançamento a receber; se uma parte falhar, nada é gravado. | Existe; passa a gerar o lançamento |

### Ranking e torneios

| Tabela | O que guarda | Situação |
| --- | --- | --- |
| `torneios` | Nome, formato (eliminatória simples, grupos + eliminatória ou todos contra todos), categoria e situação. | Existe; o formato passa a ser uma das três opções |
| `torneio_inscritos` | Inscritos, cabeças de chave e grupo de cada um. | Nova |
| `partidas` | Cada jogo: jogadores, data, placar e vencedor. Se for de torneio, também fase, rodada, grupo e para qual partida o vencedor avança. | Nova |

O ranking não é uma tabela: é calculado a partir das partidas, com a pontuação
definida nas Configurações.

O plano previa duas tabelas de partidas, uma para o ranking e outra para os
torneios. Aqui é uma só, com os campos de torneio opcionais **[sugestão]**:
fica mais simples, e uma partida de torneio pode contar para o ranking se a
arena quiser.

---

## 4. Regras sem resposta da arena: hipóteses usadas

Enquanto não houver resposta, cada item abaixo vira um parâmetro em
Configurações, com o valor da hipótese. Quando a resposta chegar, troca-se o
valor, sem programar.

| # | Assunto | Hipótese |
| --- | --- | --- |
| H1 | Siglas de reposição | CH, 24h, FP, IAC e TIP dão direito a crédito igual à duração da aula. A lista é editável, para incluir as siglas que faltam. |
| H2 | Plano amarelo ("Plano de locação") | Mantém nome e cor; significado a confirmar. |
| H3 | Duas tabelas de planos | Cada plano é marcado como "tabela nova" ou "tabela antiga". O aluno mantém o valor da matrícula. |
| H4 | Congelamento | A tela pede início, fim previsto e motivo. Aulas fixas do período ficam suspensas, sem gerar crédito. Mensalidade sem mudança automática. Sem prazo mínimo ou máximo. |
| H5 | Reserva sem pagamento | Prazo configurável, ainda sem valor definido. Vencido o prazo, a reserva entra em alerta e o horário pode ser cedido a outra pessoa, mas a recepção decide. Há uma opção para liberar automaticamente. |
| H6 | Repasse ao professor | Valor por hora-aula de cada professor, como no MVP. Configurável para percentual ou valor diferente por tipo de aula. |
| H7 | Pontuação do ranking | Pontos por vitória e por derrota configuráveis. Valores iniciais só para teste. |
| H8 | Regras de torneio | Passam 2 por grupo. Desempate: vitórias, confronto direto, saldo de sets, saldo de games. W.O. dá vitória a quem compareceu. |
| H9 | Perfis | **Dono**: tudo. **Recepção**: agenda, alunos, financeiro a receber, estoque e ranking. **Professor**: a própria agenda e os próprios alunos, só leitura. |
| H10 | Professor em duas aulas ao mesmo tempo | O sistema avisa, mas deixa salvar. Opção para bloquear. |
| H11 | Tablet | Tablet comum de 10 polegadas, na horizontal, até saber o modelo. |

**Divergência registrada (H5):** o plano de ação manda cancelar sozinho a
reserva não paga no prazo. O pedido da arena fala em alertar e permitir que
outra pessoa fique com o horário. A hipótese segue o pedido da arena (só
alertar), com a opção de liberar automaticamente.

---

## 5. Como o front muda sem esperar o banco

As telas continuam funcionando com **dados de exemplo**, mas esses dados passam
a ter o formato novo descrito acima. É o mesmo caminho que o MVP já previa:

- `src/lib/types.ts`: o formato dos dados, reescrito para o modelo novo;
- `src/lib/mock-data.ts`: os dados de exemplo, gerados no formato novo;
- `src/lib/selectors.ts`: única porta de leitura das telas;
- `src/store/AppStore.tsx`: única porta de gravação.

Quando o banco estiver pronto, só essas portas mudam: as telas não precisam
ser refeitas. O PR #2 (ligação com o Supabase) será adaptado ao modelo novo
nessa hora.

## 6. Ordem sugerida de trabalho no front

A ordem segue a prioridade do plano (agenda, ficha e financeiro primeiro):

1. Dados de exemplo no formato novo. A pessoa não vê diferença na tela, mas é a
   base de tudo o que vem depois.
2. **Agenda**:
   1. visão de dia no computador;
   2. painel do horário;
   3. novo horário fixo ou avulso;
   4. bloqueio e cancelamento;
   5. cancelamento por chuva.
3. **Alunos**: lista, cadastro, edição, matrícula, extrato de reposição e
   congelamento.
4. **Financeiro**: a receber e a pagar, novo lançamento, relatório de
   professores.
5. **Estoque**: cadastro de produto e ligação do consumo com o financeiro.
6. **Ranking e torneios**: resultado de partida, criar torneio e a chave nos
   três formatos.
7. **Configurações** e **Histórico de alterações**.

Cada etapa termina com um roteiro curto de como testar na tela.

## 7. Pontos para a equipe revisar

1. Concordam com as tabelas novas `planos`, `matriculas` e `congelamentos`?
2. Partidas de ranking e de torneio numa tabela só?
3. A hipótese de perfis (H9) faz sentido para o dia a dia da arena?
4. Algo do MVP que vocês querem manter e que este rascunho tira, ou o
   contrário?

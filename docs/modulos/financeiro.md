# Módulo Financeiro

Tela `/financeiro`, migrada do MVP para o modelo novo (seção 2 "Financeiro" de
`docs/MODELO-E-TELAS.md`). Todo dinheiro é um **lançamento**: a receber ou a
pagar, com vencimento. A situação (pago, pendente, em atraso, anulado) nunca é
digitada: sai das datas.

## O que o módulo faz

- **Mês de referência**: as setas ao lado do título trocam o mês. Os
  indicadores, a lista, o relatório de professores e o "recebido por forma"
  seguem o mês escolhido.
- **Indicadores do mês** (cartões no topo). Cada cartão é um atalho: clicar
  nele aplica na lista **exatamente o filtro que gerou o número**, então o
  cartão e a lista sempre batem (o MVP mostrava "12 atrasadas" no cartão e 6
  na lista).
  - **Recebido**: o que foi pago no mês (pela data do pagamento).
  - **A receber**: o que vence no mês e ainda está no prazo.
  - **Em atraso**: tudo o que venceu e não foi pago, **de qualquer mês** (a
    dívida de setembro continua devida em outubro).
  - **A pagar até o fim do mês**: contas a pagar em aberto que vencem até o
    último dia do mês, inclusive as que atrasaram antes (nas contas a pagar
    não há cartão separado de atrasadas).
- **Abas**: *A receber*, *A pagar* e *Professores*.
- **Lista de lançamentos**: busca (aluno ou professor, quem pagou/favorecido,
  item; sem ligar para acentos), filtros por situação (todas, em aberto,
  pendentes, em atraso, pagos, anulados), categoria, forma de pagamento e
  período (só o mês, até o mês, todos os meses); ordem por vencimento (clique
  no cabeçalho para inverter); 20 linhas por vez com "Mostrar mais"; no
  celular, um cartão por lançamento. O rodapé mostra a quantidade e o total
  (anulados ficam fora do total).
  - **Período**: vale a data do pagamento; o que ainda não foi pago entra
    pelo vencimento. Assim "recebido em outubro" é o que entrou no caixa em
    outubro.
- **Exportar planilha**: baixa a lista filtrada em CSV (arquivo de verdade,
  gerado no navegador): separador `;`, datas `dd/mm/aaaa`, valores `1.234,56`
  e marca UTF-8 — o Excel em português abre direto, com acentos.
- **Novo lançamento**: a receber (aluno com busca, quem paga — pode ser outra
  pessoa —, categoria, item, valor, vencimento, forma, comprovante, "já foi
  pago" com data e parte do convênio) ou a pagar (categoria Despesa,
  Fornecedor, Repasse ou Outros; favorecido; item; valor; vencimento...).
  No repasse lançado à mão (adiantamento) escolhe-se o professor e o mês.
- **Registrar pagamento**: data, forma, quem pagou, parte coberta por
  convênio (só registro) e comprovante. Se o lançamento é a cobrança de uma
  reserva "aguardando pagamento", a mesma operação **confirma a reserva** na
  agenda (situação "agendada").
- **Anular** (nunca apaga): pede o motivo; o lançamento continua na lista
  como "Anulado", sai dos totais e o histórico mostra quem anulou e quando.
- **Detalhe do lançamento** (clique no item): todos os dados, a que registro
  ele está ligado (reserva, matrícula, consumo, torneio, fechamento de
  repasse), ações, **comentários** e **histórico de alterações**.
- **Gerar mensalidades do mês**: escolhe o mês, mostra antes quantas serão
  criadas, o total, quantas já existiam e quem está com o plano congelado;
  depois mostra o resultado e leva à lista. Rodar de novo não duplica.
- **Relatório de professores** (aba Professores): por mês, aulas dadas,
  horas, previsto, pago, diferença e situação, com link para a ficha do
  professor. Mês terminado e sem fechamento ganha o botão **Fechar repasse**.
- **Reservas aguardando pagamento**: todas as reservas avulsas que esperam o
  pagamento, com o prazo (vencido em destaque) e o atalho "Registrar
  pagamento".
- **Recebido por forma de pagamento**: relatório simples do mês (mesmo total
  do cartão "Recebido"), com a parte coberta por convênio.
- **Link direto**: `/financeiro?aba=pagar`, `?situacao=em_atraso`,
  `?mes=2026-09` e `?lancamento=<id>` (abre o detalhe). Outros módulos podem
  apontar para cá.

## Regras (o que as operações recusam)

As regras ficam em `src/lib/banco/regras/financeiro.ts` e as gravações em
`src/lib/banco/operacoes/financeiro.ts`. A tela não valida nada além de
conforto: quem recusa é a operação, com a mensagem que aparece no aviso.

| Operação | Recusa quando |
| --- | --- |
| Novo lançamento (`criarLancamento`) | valor zero, negativo ou que não é número; vencimento inválido (ex.: 30/02); item vazio; categoria que não é do tipo; a receber sem aluno e sem "quem paga"; a pagar sem favorecido; repasse sem professor ou sem mês; mensalidade de aluno sem matrícula vigente no vencimento ou repetida no mesmo mês; pagamento com data no futuro ou sem forma; forma de pagamento fora da lista das Configurações; parte do convênio negativa ou maior que o valor. |
| Registrar pagamento (`registrarPagamento`) | lançamento anulado; já pago; sem data, data no futuro; sem forma ou forma desconhecida; convênio maior que o valor. |
| Anular (`anularLancamento`) | sem motivo; já anulado; cobrança de reserva que ainda aguarda pagamento (registre o pagamento ou cancele a reserva na agenda). |
| Gerar mensalidades (`gerarMensalidades`) | mês inválido. Sem nada a criar, não grava nada (idempotente). |
| Fechar repasse (`fecharRepasseDoMes`) | mês que ainda não terminou; mês já fechado; mês sem aulas dadas; data de pagamento inválida. |
| Todas | perfil sem acesso ao tipo de lançamento (H9). |

## Hipóteses usadas (seção 4 do plano)

- **H4 – Congelamento**: a mensalidade é gerada normalmente para quem está com
  o plano congelado no vencimento; a lista e a prévia mostram a etiqueta
  "Plano congelado".
- **H5 – Reserva sem pagamento**: o financeiro só alerta (prazo vencido em
  destaque); quem decide ceder o horário é a recepção, na agenda. Pagar
  confirma a reserva. A opção de liberar sozinho fica com a agenda.
- **H6 – Repasse**: previsto pela regra de cada professor
  (`repassePrevisto`: valor por hora-aula ou percentual). Mês aberto: cálculo
  pela regra; mês fechado: o valor gravado no fechamento (`banco.repasses`).
- **H9 – Perfis**: dono vê tudo; recepção vê só as contas a receber (sem as
  abas A pagar e Professores, sem o cartão A pagar); professor não vê o
  financeiro. Vale também nas operações (lista editável nas Configurações:
  módulos `financeiro` e `financeiro_pagar`).

Nenhum parâmetro novo foi acrescentado às Configurações. Decisões do módulo
que a arena ainda precisa confirmar:

1. Mensalidade **anulada não volta** ao gerar de novo (anular foi decisão da
   recepção). Para cobrar de novo, use "Novo lançamento".
2. Mensalidade lançada à mão fica ligada à matrícula, e o mês é o do
   vencimento; assim "Gerar mensalidades" não cobra o mesmo mês duas vezes.
3. A mensalidade gerada sugere como "quem paga" quem pagou a última
   mensalidade daquela matrícula (pai, empresa...).
4. O **fechamento do repasse desconta** o que já foi lançado de repasse para o
   professor naquele mês (adiantamento), para não pagar duas vezes.
5. A data sugerida para pagar o repasse é o dia 5 do mês seguinte (como nos
   dados de exemplo), ou hoje se esse dia já passou. Quem fecha pode mudar.
6. Lançamento **já pago pode ser anulado** (estorno ou pagamento lançado por
   engano); a tela avisa antes.
7. Professores com aula dada no mês entram no fechamento; quem não deu aula
   não tem repasse a fechar.

## O que ficou de fora e por quê

- **Aba Planejamento** (fluxo de caixa e projeções): fora da v1 pelo plano.
- **Conciliação bancária, maquininha e integração com convênio**: fora da v1.
  A "parte coberta por convênio" é só um valor registrado.
- **Envio do comprovante**: por enquanto guarda só o nome do arquivo
  escolhido; o arquivo vai para o armazenamento do Supabase quando o banco
  entrar.
- **Editar um lançamento, pagamento parcial, desfazer pagamento e reabrir um
  repasse fechado**: não estão no plano. Para corrigir, anula-se e lança-se de
  novo.
- **Rotina automática de mensalidades**: o plano prevê o botão agora e a
  rotina no banco depois (ver migração).

## Roteiro de teste (para quem não programa)

Os números mudam com a data de hoje (os dados de exemplo acompanham o dia).
Os exemplos entre parênteses são de 29/10/2026.

1. Abra o sistema, escolha **Francisco Menezes** e clique em **Entrar no
   sistema**. Clique na aba **Financeiro**.
2. No topo devem aparecer o mês ("Outubro de 2026") e quatro cartões:
   Recebido, A receber, Em atraso e A pagar.
3. Anote o número do cartão **Em atraso** (ex.: R$ 7.718,00 e "17
   lançamentos vencidos") e clique nele. A lista deve mostrar a situação "Em
   atraso", o período "Todos os meses" e, no rodapé, **a mesma quantidade e o
   mesmo total** do cartão. Faça o mesmo com os outros três cartões.
4. Na primeira linha da lista, clique em **Receber**. Sem escolher a forma de
   pagamento, clique em **Registrar pagamento**: deve aparecer o aviso
   vermelho "Escolha a forma de pagamento." Escolha **Stone** e registre: deve
   aparecer "Pagamento registrado." e o cartão Em atraso diminui um.
5. Volte para a aba **A receber**. No quadro **Reservas aguardando
   pagamento**, a reserva com o prazo vencido aparece em vermelho. Clique em
   **Registrar pagamento** nela: a janela avisa que a reserva fica confirmada
   na agenda. Escolha **Dinheiro** e registre: deve aparecer "Pagamento
   registrado. A reserva está confirmada na agenda." e a reserva sai do
   quadro.
6. No quadro de reservas, clique no texto "Locação avulsa..." de outra
   reserva para abrir o detalhe e clique em **Anular**. Escreva um motivo e
   confirme: deve aparecer o erro "Esta cobrança é de uma reserva que ainda
   aguarda pagamento...". Cancele.
7. Na lista, clique no nome de um item qualquer (ex.: "1× Biscoito de
   polvilho"). No detalhe, escreva um comentário e clique em **Adicionar
   comentário**: ele aparece embaixo, com seu nome e a hora.
8. Ainda no detalhe, clique em **Anular** e, sem escrever o motivo, em
   **Anular lançamento**: aparece o erro "Escreva o motivo da anulação."
   Escreva "Lançado em dobro" e confirme: o detalhe mostra "Anulado", o valor
   riscado e, no **Histórico**, "Alterou · Anular lançamento por Francisco
   Menezes". O lançamento continua na lista (filtro Situação: Anulados).
9. Clique em **Novo lançamento**. Em Aluno, digite "guil" e escolha um aluno.
   Escreva o item "Aula avulsa de sábado" e clique em **Lançar** sem valor:
   aparece "O valor precisa ser maior que zero." Digite 90, marque **Já foi
   pago**, escolha a forma **Dinheiro** e clique em **Lançar**: aparece
   "Lançamento criado, já como pago."
10. Clique em **Gerar mensalidades**. O mês sugerido é o próximo (ex.:
    novembro de 2026). Confira a prévia: quantas serão geradas (ex.: 85), o
    total e quantos alunos estão com o plano congelado. Clique em **Gerar**.
    Aparece o resultado; clique em **Ver na lista**: a lista mostra as
    mensalidades de novembro, e as dos congelados têm a etiqueta "Plano
    congelado". Abra **Gerar mensalidades** de novo: aparece "Todas as
    matrículas vigentes já têm a mensalidade de novembro de 2026. Nada a
    gerar." Clique em **Voltar ao mês atual**.
11. Clique em **Exportar planilha**. Um arquivo `.csv` é baixado; abra no
    Excel: as colunas aparecem separadas, com acentos, datas e valores em
    reais.
12. Clique no cartão **A pagar**. A aba A pagar mostra as contas que vencem
    até o fim do mês, inclusive uma conta atrasada do mês passado
    ("Manutenção do saibro"). Clique em **Pagar** nela, escolha **Bradesco**
    e registre.
13. Clique na aba **Professores**. O mês atual aparece "em andamento", com o
    aviso de que o mês anterior ainda tem repasse a fechar. Clique em **Ver o
    mês anterior** e depois em **Fechar repasse de setembro**. Confira os
    valores e confirme: aparece "Repasse de setembro de 2026 fechado: 3 contas
    a pagar lançadas" e cada professor fica "Fechado · a pagar". O botão de
    fechar some (o mês não fecha duas vezes). Na aba **A pagar**, filtre a
    categoria **Repasse** e o período **Todos os meses**: os repasses de
    setembro estão lá.
14. Clique no nome de um professor: abre a ficha dele.
15. Saia (ícone no canto superior direito), entre como **Lucas Ferreira**
    (recepção) e abra o Financeiro: não aparecem a aba A pagar, a aba
    Professores nem o cartão A pagar.
16. Saia e entre como **Renata Coelho** (professora): o Financeiro mostra "Sem
    acesso ao financeiro".
17. No celular, abra o Financeiro: os cartões ficam dois por linha, a lista
    vira cartões e os botões continuam ao alcance do dedo.

## Notas para a migração ao Supabase

| Hoje (front) | No banco |
| --- | --- |
| `Lancamento` (`tipos.ts`) | tabela `lancamentos` (hoje `pagamentos` no PR #2), com `tipo`, `categoria`, `vencimento`, `pago_em`, `forma_pagamento`, `valor_convenio`, `comprovante` (caminho no Storage), `competencia` e as ligações (`matricula_id`, `ocupacao_id`, `consumo_id`, `torneio_id`, `repasse_id`). |
| `situacaoLancamento` | função `situacao_lancamento(l, hoje)` ou visão `lancamentos_com_situacao` (não pode ser coluna gerada: depende do dia). |
| Regras do novo lançamento | `check (valor > 0)`, `check` de categoria por tipo, `check (valor_convenio between 0 and valor)`, `check ((cancelado_em is null) = (motivo_cancelamento is null))`, forma de pagamento como chave estrangeira para a lista de formas, gatilho para `pago_em <= current_date`. |
| "Nunca apaga" | sem permissão de `delete` em `lancamentos` (RLS). |
| `registrarPagamento` | função `registrar_pagamento(id, pago_em, forma, valor_convenio, comprovante, pagante)`: numa transação, atualiza o lançamento e, se a ocupação estiver `aguardando_pagamento`, muda para `agendada`. |
| `anularLancamento` | função `anular_lancamento(id, motivo)`. |
| `mensalidadesAGerar` + `gerarMensalidades` | função `gerar_mensalidades(competencia)` chamada pelo botão e por uma rotina mensal (`pg_cron`); índice único parcial `(matricula_id, competencia) where categoria = 'Mensalidade' and cancelado_em is null` contra duplicata; a função pula também as anuladas. |
| `fecharRepasseDoMes` | função `fechar_repasse(competencia, vencimento)`; índice único `(professor_id, competencia)` em `repasses`. |
| `garantirAcessoAoFinanceiro` (H9) | políticas RLS por perfil: recepção sem `select/insert/update` em `tipo = 'pagar'`; professor sem acesso. |
| Consultas (`consultas/financeiro.ts`) | `listarLancamentos` vira `select` com os mesmos filtros e paginação no servidor; `indicadoresDoMes` usa **o mesmo `where`** da lista com `count`/`sum`; `relatorioDeProfessores` pode virar uma visão. A planilha continua sendo gerada no navegador. |

## Arquivos

- Tela: `src/app/(app)/financeiro/page.tsx`
- Componentes: `src/components/financeiro/` (indicadores, filtros, lista,
  detalhe, modais de novo lançamento, pagamento, anulação, mensalidades e
  fechamento, relatório de professores, reservas, recebido por forma).
- Leitura: `src/lib/consultas/financeiro.ts`
- Gravação: `src/lib/banco/operacoes/financeiro.ts` (testes em
  `financeiro.test.ts`)
- Regras: `src/lib/banco/regras/financeiro.ts`
- Dados de exemplo: `src/lib/banco/semente/financeiro.ts` — o último mês
  terminado fica **sem fechamento de repasse** (para demonstrar o botão), há
  contas a pagar do mês seguinte e uma atrasada, e as mensalidades do mês
  seguinte não existem (para demonstrar "Gerar mensalidades").

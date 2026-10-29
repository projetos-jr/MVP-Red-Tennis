# Módulo base: login, navegação, Painel, Configurações e Histórico

Versão de 29/10/2026. Faz parte da migração das telas para o modelo novo
(`docs/MODELO-E-TELAS.md`, seção 2: Login, Painel, Configurações, Histórico e
"Em todas as telas").

## O que o módulo faz

| Parte | Onde | O que faz |
| --- | --- | --- |
| Login | `/` | Escolhe quem entra (a equipe de `banco.colaboradores`, com cargo, perfil e o que o perfil vê). A senha é só de demonstração: qualquer uma serve. Cada perfil cai na primeira área que pode abrir (dono e recepção no Painel, professor na Agenda). |
| Navegação | barra do topo e barra do celular | Mostra só as áreas que o perfil pode abrir (H9). Configurações e Histórico ficam no menu do usuário (clique no nome ou na foto, no canto direito), para não encher a barra. |
| Busca rápida de aluno | barra do topo | Campo com sugestões enquanto se digita: nome (sem precisar de acento), pedaços do nome ("gui lim") ou números do telefone. Setas escolhem, Enter abre a ficha, Esc fecha. A tecla `/` leva o cursor para a busca. No celular é um botão de lupa que abre a busca em tela cheia. O professor só encontra os próprios alunos. |
| Proteção de rota | todas as telas internas | Se o perfil não pode abrir a área da página atual (por exemplo, alguém volta pelo navegador depois de trocar de usuário), aparece "Sem acesso a esta área" com o atalho para o painel (ou para a primeira área do perfil). |
| Painel | `/dashboard` | Quadras de hoje em 3D (mais escuro = mais cheia), com o que está acontecendo agora, a próxima ocupação e a próxima faixa livre; indicadores do dia; próximos horários; quadro "Precisa de atenção". |
| Configurações | `/configuracoes` (só dono) | Todas as regras ajustáveis: siglas de reposição, validade da reposição, reservas, agenda, ranking, torneios, formas de pagamento, prazo do consumo, preços de locação, catálogo de planos e permissões. Cada item explica a regra e mostra o selo da hipótese (H#). |
| Histórico de alterações | `/historico` (só dono) | Tudo o que foi criado, alterado ou apagado: quem, quando, o quê e a operação. Filtros por pessoa, período, tipo de registro e ação. "Ver detalhes" mostra os campos que mudaram (antes e depois). |

### O quadro "Precisa de atenção"

Junta o que pede uma ação hoje. Cada grupo mostra a contagem da lista
inteira; os três primeiros itens aparecem e "Mostrar todos" abre o resto. O
cartão **Pendências**, em cima, é a soma dos grupos (o MVP dizia 12 no cartão
e mostrava 6 na lista; agora os números são os mesmos).

| Grupo | O que entra | Para onde o item leva |
| --- | --- | --- |
| Reservas sem pagamento (H5) | Toda reserva "aguardando pagamento", as de prazo vencido primeiro, com o selo "Prazo vencido" ou "Pagar até…". | Agenda do dia da reserva |
| Mensalidades em atraso | Mensalidades a receber vencidas e sem pagamento (situação calculada pela regra do financeiro). | Ficha do aluno |
| Produtos abaixo do mínimo | Produtos ativos com saldo (soma dos movimentos) menor que o estoque mínimo. | Estoque |
| Reposições perto de vencer | Alunos ativos com crédito de reposição que vence em até 30 dias (pelo extrato de reposição). | Ficha do aluno |

Quem não pode abrir uma área não recebe o grupo dela, e o total acompanha.

## Regras e hipóteses usadas

As regras que a arena ainda não confirmou viram parâmetros na tela de
Configurações. Os valores iniciais são os de `CONFIGURACOES_INICIAIS`.

| # | Onde aparece | Parâmetro |
| --- | --- | --- |
| H1 | Configurações › Reposição | Lista de siglas: código, nome, descrição, se gera crédito e onde vale (aula inteira, um aluno ou os dois). |
| H2 | Configurações › Planos | "Plano de locação" (amarelo) mantém nome e cor; significado a confirmar. |
| H3 | Configurações › Planos | Cada plano é da tabela nova ou da antiga. Mudar o valor do plano não muda as matrículas: o aluno mantém o valor combinado. |
| H5 | Configurações › Reservas e Painel | Prazo para pagar a reserva (24 h) e "liberar o horário sozinho" (desligado: a reserva vencida só fica em alerta e a recepção decide). |
| H6 | Configurações › Repasse | Só mostra a regra de cada professor; ela é ajustada na ficha do professor. |
| H7 | Configurações › Ranking | Pontos por vitória (10) e por derrota (2), valores de teste. |
| H8 | Configurações › Ranking | Classificados por grupo (2) e ordem dos critérios de desempate. |
| H9 | Permissões, navegação, Painel, busca | Dono vê tudo; recepção vê agenda, alunos, financeiro a receber, estoque e ranking; professor vê agenda e alunos. A matriz é editável. |
| H10 | Configurações › Reservas e agenda | Impedir professor em duas aulas ao mesmo tempo (desligado: só avisa). |
| H12 | Configurações › Reservas e agenda | Semanas da agenda criadas à frente (12). |
| H13 | Configurações › Financeiro | Prazo para pagar o consumo do balcão (7 dias). |

Regras que este módulo aplica (todas nas operações, com mensagem clara):

- **Só o dono** altera configurações, siglas, planos e permissões.
- Validade da reposição de pelo menos 1 mês; prazo da reserva de pelo menos
  1 hora; semanas da agenda entre 1 e 52; prazo do consumo de pelo menos 1 dia;
  preços maiores que zero; classificados por grupo a partir de 1.
- Pontos sem valor negativo, e a vitória vale pelo menos tanto quanto a
  derrota.
- Formas de pagamento: pelo menos uma, sem nome vazio e sem repetição
  (sem diferenciar maiúsculas e acentos).
- Critérios de desempate só mudam de ordem (o cálculo do torneio conhece cada
  um pelo nome).
- Sigla: código de 1 a 6 letras ou números, sem repetição; o código de uma
  sigla já usada em aulas ou créditos não muda. Sigla não se apaga: desativa-se
  (sai dos formulários, continua valendo no que já foi gravado).
- Plano: nome sem repetição, valor maior que zero, 1 a 7 aulas por semana,
  duração de 15 a 240 minutos. Plano com matrícula vigente não se apaga, só se
  desativa; plano que aparece no histórico de matrículas também não se apaga.
  O tipo de um plano com matrículas não muda.
- Permissões: o dono não pode tirar o próprio acesso às Configurações; só o
  perfil Dono tem acesso às Configurações; quem vê as contas a pagar precisa ver
  o Financeiro.

Escolhas do módulo que valem conferir com a arena:

- **Reservas no Painel:** aparecem todas as reservas aguardando pagamento, não
  só as "perto de vencer". Com o prazo de 24 h, toda reserva em aberto já está a
  menos de um dia do vencimento. Se a arena aumentar o prazo e achar a lista
  longa demais, dá para acrescentar um parâmetro "avisar com N horas de
  antecedência".
- **Alunos do professor** (busca rápida): os que têm o professor como principal
  ou estão num horário fixo dele que ainda vale.

Campo novo no modelo: `SiglaReposicao.desativada` (opcional; vazio = ativa).

## O que ficou de fora e por quê

- **Login de verdade** (e-mail e senha individuais): vem com o Supabase Auth.
  Hoje, recarregar a página volta para o dono, e "Sair" também volta para o
  dono (é assim que o estado da demonstração funciona em `AppStore.tsx`, que
  não é deste módulo).
- **Regra de repasse:** cada professor tem a sua, e ela se edita na ficha do
  professor (módulo de professores). As Configurações só mostram o resumo.
- **Efeito dos parâmetros nas outras telas:** a tela de Configurações grava os
  valores; quem os usa são os módulos donos de cada regra (a agenda usa o prazo
  da reserva, as semanas à frente e o choque de professor; o ranking usa os
  pontos e os critérios; o financeiro e o estoque usam as formas de pagamento e
  o prazo do consumo).
- **Histórico guardado:** na demonstração ele começa vazio a cada visita; com
  o banco real fica guardado para sempre.
- **Exportar o histórico:** não pedido para a v1.

## Roteiro de teste

1. Abra o sistema (tela de login). Devem aparecer três pessoas: Francisco
   Menezes (Dono), Lucas Ferreira (Recepção) e Renata Coelho (Professor), cada
   uma com o que o perfil vê. Embaixo, o aviso "Demonstração: qualquer senha
   serve".
2. Escolha **Francisco Menezes**, digite qualquer senha e clique em
   **Entrar como Francisco**. Deve abrir o **Painel**.
3. No Painel, confira o cartão **Pendências** (ex.: 32). Desça até
   **Precisa de atenção**: os números dos quatro grupos (ex.: 6 + 14 + 7 + 5)
   somam o mesmo valor do cartão.
4. No grupo **Mensalidades em atraso**, clique em **Mostrar todos os 14**:
   devem aparecer exatamente 14 linhas. Clique numa delas: abre a ficha do aluno.
5. Volte ao Painel. Na **Ocupação de hoje**, cada quadra mostra a porcentagem,
   as horas ocupadas, o que está acontecendo agora ou a próxima aula, e quando
   fica livre. Clique numa quadra: abre a Agenda.
6. Na barra do topo, clique no campo **Buscar aluno…** e digite `gui lim`.
   Deve aparecer **Guilherme Lima** com "Gui" e "Lim" em destaque. Aperte
   **Enter**: abre a ficha dele. (Quando há mais de um resultado, as setas para
   cima e para baixo escolhem a linha antes do Enter.)
7. Na busca, digite os quatro últimos números de um telefone (ex.: `2210`):
   aparece o aluno dono do telefone.
8. Clique no seu nome, no canto direito da barra. O menu mostra o perfil,
   **Configurações**, **Histórico de alterações** e **Sair e trocar de
   usuário**. Clique em **Configurações**.
9. Em **Reservas e agenda**, troque o prazo para pagar a reserva para `0` e
   clique em **Salvar alterações**. Deve aparecer o erro "O prazo para pagar a
   reserva precisa ser maior que zero (em horas inteiras)." e nada é salvo.
10. Troque o prazo para `48`, ligue **Liberar o horário sozinho** e salve.
    Deve aparecer "Regras de reserva e agenda salvas.".
11. Em **Reposição de aulas**, clique em **Incluir sigla**. Preencha o código
    `CH`, o nome "Atestado médico" e clique em **Incluir sigla**. Deve aparecer
    o erro "Já existe a sigla "CH". Escolha outro código.". Troque o código para
    `AT` e inclua de novo: a sigla aparece na lista.
12. Na sigla **TIP**, clique em **Desativar** e confirme. Ela fica com o selo
    "Desativada" e o botão vira **Reativar**.
13. Em **Planos**, clique na lixeira de **Individual · 1x por semana** e
    confirme. Deve aparecer o erro dizendo que o plano tem matrículas vigentes e
    não pode ser apagado. Cancele.
14. Clique em **Novo plano**, preencha "Individual · 2x por semana", valor
    `1280`, 2 aulas por semana e inclua. Depois apague esse plano novo pela
    lixeira: como não tem matrícula, ele sai do catálogo.
15. Em **Permissões**, marque **Recepção** na linha **Histórico de
    alterações** e clique em **Salvar permissões**. Repare que a célula do Dono
    em **Configurações** está travada (cadeado).
16. Abra o menu do usuário e vá em **Histórico de alterações**. Devem aparecer
    as mudanças feitas acima, da mais recente para a mais antiga, com
    "por Francisco Menezes". Clique em **Ver detalhes** numa delas: aparecem os
    campos com o valor de antes e o de depois.
17. No filtro **Tipo de registro**, escolha **Planos**: sobram só as
    alterações de planos.
18. Recarregue a página do Histórico: ele volta vazio, com a explicação de que
    a demonstração recomeça a cada visita.
19. Abra o menu do usuário e clique em **Sair e trocar de usuário**. Entre como
    **Lucas Ferreira** (Recepção). A barra mostra as mesmas abas, mas o menu do
    usuário não tem Configurações nem Histórico.
20. Aperte o botão **Voltar** do navegador duas vezes, até a página do
    Histórico que o Francisco tinha aberto. Como a página foi recarregada no
    passo 18, as permissões voltaram ao início e a recepção não abre o
    Histórico: deve aparecer **Sem acesso a esta área**, com o botão **Voltar ao
    painel**.
21. Saia e entre como **Renata Coelho** (Professor). Ela cai direto na Agenda e
    só vê as abas **Agenda** e **Alunos**. A busca diz "Buscar entre meus
    alunos…".
22. No celular (ou com a janela estreita), a navegação fica na barra de baixo e
    a busca é o botão de lupa no topo, que abre em tela cheia.

## Notas para a migração ao Supabase

| Hoje (front) | No banco real |
| --- | --- |
| `banco.configuracoes` | Tabela `configuracoes` com uma linha só (ou chave/valor). CHECKs: `validade_reposicao_meses >= 1`, `prazo_pagamento_reserva_horas >= 1`, `semanas_geradas_a_frente between 1 and 52`, `pontos_derrota >= 0 and pontos_vitoria >= pontos_derrota`, `classificados_por_grupo >= 1`, `prazo_pagamento_consumo_dias >= 1`, `preco_locacao_hora > 0`, `preco_paredao_hora > 0`. |
| `salvarParametros` | `update configuracoes` direto, protegido por RLS (só o dono). As validações de `regras/configuracoes.ts` viram os CHECKs acima. |
| Siglas (`incluirSigla`, `editarSigla`, `desativarSigla`, `reativarSigla`) | Tabela `siglas_reposicao` (`codigo` PK, `nome`, `descricao`, `gera_credito`, `aplica_a`, `desativada`). Código único sem diferenciar maiúsculas: índice único em `lower(codigo)`. Código usado não muda: chave estrangeira das ocupações/presenças/reposições com `on update restrict` (ou gatilho). |
| Formas de pagamento | Tabela `formas_pagamento` (nome único em `lower(nome)`), ou coluna `text[]` com CHECK. |
| Critérios de desempate | `enum` com os quatro critérios e coluna `criterios_desempate` como lista ordenada; CHECK de que tem os quatro, sem repetir. |
| Planos (`incluirPlano`, `editarPlano`, `desativarPlano`, `reativarPlano`, `apagarPlano`) | Tabela `planos` com índice único em `lower(nome)` e CHECKs de valor, aulas e duração. `matriculas.plano_id` com `on delete restrict` impede apagar plano usado. Gatilho impede mudar o `tipo` de plano com matrícula. |
| Permissões (`alterarPermissoes`) | Tabela `permissoes (perfil, modulo)`. As políticas de RLS de cada tabela consultam essa tabela. Gatilho garante: o dono sempre tem `configuracoes`; só o dono tem `configuracoes`; `financeiro_pagar` exige `financeiro`. |
| "Só o dono" | Função `perfil_atual()` (a partir de `auth.uid()` e `colaboradores`) usada nas políticas de `update/insert/delete` dessas tabelas. |
| Login | Supabase Auth (e-mail e senha). `colaboradores` ganha `user_id` ligado a `auth.users`. A proteção de rota passa a ser o middleware + RLS; o aviso "Sem acesso a esta área" continua igual. |
| Histórico (`filtrarHistorico`, `descreverRegistro`) | Lê a tabela `auditoria` preenchida pelo gatilho único. Índices em `em`, `usuario_id` e `tabela`. A tradução dos nomes de tabelas e campos continua no front. |
| Painel (`ocupacaoDasQuadras`, `precisaDeAtencao`...) | Viram consultas ou funções (`rpc`): ocupação do dia por quadra, reservas aguardando pagamento, mensalidades em atraso (view com a situação do lançamento), saldo de estoque (view sobre os movimentos) e créditos a vencer (view `saldo_reposicao`). As telas não mudam. |
| Busca rápida (`buscarAlunosRapido`) | `select` em `alunos` com `unaccent(nome) ilike` e telefone só com dígitos; índice trigram (`pg_trgm`) para ficar rápido. |

## Para os outros módulos

- Para listar as siglas nos formulários, use `siglasAtivas(banco.configuracoes)`
  de `lib/consultas/configuracoes.ts` (as desativadas ficam de fora).
- Ofereça em matrículas novas só os planos com `ativo: true`.
- A permissão `financeiro_pagar` controla a aba "A pagar" dentro do Financeiro;
  esconder essa aba é do módulo financeiro.
- O perfil professor vê agenda e alunos "só os dele, só leitura" (H9): o filtro
  é de cada módulo. A busca rápida já faz isso com `alunosDoProfessor`.
- Rota nova de primeiro nível precisa entrar em `MODULO_DA_ROTA`
  (`components/layout/abas.ts`) para a proteção de rota valer nela.
- Links que o Painel e a busca abrem: `/agenda?quadra=<id>`,
  `/agenda?data=AAAA-MM-DD&quadra=<id>` e `/alunos?busca=<termo>`. Se a agenda e
  a lista de alunos lerem esses parâmetros, os atalhos já chegam filtrados.
- Parâmetro novo em `Configuracoes` precisa ganhar um campo na tela de
  Configurações (`components/base/configuracoes/`).
- `useHoraAtual()` (`components/base/useHoraAtual.ts`) dá a hora da arena sem
  `new Date()` na renderização (sem erro de hidratação).

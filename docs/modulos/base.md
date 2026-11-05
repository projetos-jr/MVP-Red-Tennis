# Módulo base: login, navegação, Início, Configurações e Histórico

Versão de 29/10/2026, atualizada em 04/11/2026 com o redesign (Início com as
quadras e o mosaico de atalhos, como no sistema antigo do cliente, e a
navegação nova) e em 05/11/2026 com o redesign 3 (login com a quadra de saibro
e a bola de tênis para entrar; Início só com quadras, atalhos e a placa de
atenção). Faz parte da migração das telas para o modelo novo
(`docs/MODELO-E-TELAS.md`, seção 2: Login, Painel — hoje **Início** —,
Configurações, Histórico e "Em todas as telas").

## O que o módulo faz

| Parte | Onde | O que faz |
| --- | --- | --- |
| Login | `/` | Escolhe quem entra (a equipe de `banco.colaboradores`: três botões com foto, primeiro nome e o selo do perfil; embaixo, o cargo e o que o perfil vê). A senha é só de demonstração: qualquer uma serve. Entra-se clicando na **bola de tênis** ao lado da senha (ou com Enter), como no sistema antigo. Cada perfil cai na primeira área que pode abrir (dono e recepção no Início, professor na Agenda). Com o Supabase, e-mail e senha (`LoginComEmail`), com a mesma aparência. Detalhes em "O login", abaixo. |
| Navegação | barra do topo e barra do celular | Mostra só as áreas que o perfil pode abrir (H9): Início, Agenda, Clientes (inclui Professores), Financeiro, Estoque e Ranking / Torneio. Configurações e Histórico ficam no menu do usuário (clique no nome ou na foto, no canto direito) e no mosaico do Início. Detalhes em "A navegação", abaixo. |
| Busca rápida de aluno | barra do topo | Campo com sugestões enquanto se digita: nome (sem precisar de acento), pedaços do nome ("gui lim") ou números do telefone. Setas escolhem, Enter abre a ficha, Esc fecha. A tecla `/` leva o cursor para a busca. No celular é um botão de lupa que abre a busca em tela cheia. O professor só encontra os próprios alunos. |
| Proteção de rota | todas as telas internas | Se o perfil não pode abrir a área da página atual (por exemplo, alguém volta pelo navegador depois de trocar de usuário), aparece "Sem acesso a esta área" com o botão **Voltar ao Início** (ou "Ir para" a primeira área do perfil, como a Agenda do professor). |
| Início | `/dashboard` (o endereço não mudou) | Só as entradas: a faixa das quadras (quem está jogando agora em cada quadra), o mosaico de atalhos laranja e, embaixo, a **placa de atenção** (só quando há pendência), que abre a janela "Precisa de atenção". Detalhes em "O Início", abaixo. |
| Configurações | `/configuracoes` (só dono) | Todas as regras ajustáveis: siglas de reposição, validade da reposição, reservas, agenda, ranking, torneios, formas de pagamento, prazo do consumo, preços de locação, catálogo de planos e permissões. Cada item explica a regra e mostra o selo da hipótese (H#). |
| Histórico de alterações | `/historico` (só dono) | Tudo o que foi criado, alterado ou apagado: quem, quando, o quê e a operação. Filtros por pessoa, período, tipo de registro e ação. "Ver detalhes" mostra os campos que mudaram (antes e depois). |

### O login

Pedido do cliente (redesign 3): sair do fundo branco e entrar "clicando na
bolinha de tênis, igual o sistema antigo, só que mais bonito".

- **Fundo:** um pedaço de quadra de saibro visto de cima, **desenhado em
  código** (`components/base/login/FundoDeSaibro.tsx`), inspirado na foto que
  a equipe trouxe, mas sem usar a foto (ela tem direito autoral). Camadas: o
  saibro laranja da paleta com luz no meio, os grãos claros e escuros e manchas
  largas (ruído SVG em ladrilhos repetidos, sem imagem), a linha branca em "T"
  com a borda irregular de pó, a bola amarela encostada no "T" com a sombra
  comprida do sol e uma vinheta nas bordas. Não carrega nenhum arquivo: funciona
  offline. No computador e no tablet o "T" fica à esquerda do cartão, mais
  embaixo que a bola de entrar (para ninguém confundir as duas); no celular, no
  pé da tela.
- **Cartão branco** no meio (`CenaDoLogin.tsx`), com a logo grande. No
  celular ocupa a largura com 16 px de margem; o rodapé com as quadras e o
  horário fica numa pílula escura sobre o saibro (só do tablet para cima).
- **Bola de entrar** (`BotaoBola.tsx` e `BolaDeTenis.tsx`, SVG próprio): bola
  amarela com a costura branca, de 72 a 80 px, ao lado do campo de senha, com a
  palavra **Entrar** embaixo (clicar na palavra também entra). É o botão de
  enviar do formulário (`type="submit"`), então **Enter** no campo de senha
  também entra. O nome para leitor de tela é "Entrar como Francisco" (ou
  "Entrar no sistema"). Mouse por cima: a bola sobe e gira; enquanto entra, ela
  gira sem parar e o texto vira "Entrando…" (só com movimento liberado no
  sistema).
- **Demonstração:** "Quem está entrando?" com três botões (foto, primeiro nome
  e o selo Dono, Recepção ou Professor); a pessoa escolhida fica com a borda
  laranja e um ✓, e embaixo aparece o nome completo, o cargo e o que o perfil
  vê. O aviso "qualquer senha serve" ficou numa linha.
- **Modo Supabase:** e-mail e senha (campos grandes, com ícone), a mesma bola;
  o erro aparece logo abaixo, em letra grande, com borda vermelha. A lógica de
  autenticação não mudou.

### O Início

O dono pediu que a tela inicial lembre a do sistema antigo, que ele usa há
anos: as quadras desenhadas no topo e um mosaico de botões grandes laranja.
No redesign 3 ele pediu que o Início tenha **só isso** e, embaixo, um alerta
em forma de placa triangular de exclamação que **só aparece quando há algo**.
A tela continua no endereço `/dashboard`; o nome em todo lugar é **Início**
(aba, barra do celular, Configurações › Permissões e o botão "Voltar ao
Início"). Saíram os cartões de indicadores, os cartões de ocupação do dia e a
lista "Próximos horários" (a Diária da agenda mostra o dia inteiro). A
saudação ("Boa noite, Francisco" e a data) continua, discreta.

**1. Faixa das quadras** (`components/inicio/FaixaDasQuadras.tsx` e
`QuadraAgora.tsx`). Faixa verde com as 4 quadras e o paredão (um pouco menor)
desenhados em perspectiva, com cores fixas e vivas: Quadra 1 de cimento azul,
2 a 4 e paredão de saibro laranja (`PISO` em `lib/paleta.ts`). No alto:
"Agora nas quadras · 14:32", quantas estão em uso ("3 de 5 em uso") e o botão
**Abrir Diária** (só para quem abre a agenda). Cada quadra mostra:

| Situação | Selo | O que aparece |
| --- | --- | --- |
| Alguém jogando agora | **Em jogo** (amarelo) e uma bola amarela no piso | Até 2 nomes e "+n" (sem quem avisou a falta ou faltou), o tipo na cor da legenda, "até 18:00" e o professor |
| Bloqueio agora | **Bloqueada** (piso apagado) | O motivo do bloqueio e até que horas |
| Livre | **Livre** | "Livre agora" e a próxima aula ("Próxima: 17:00 · Dupla") ou "Sem mais horários hoje" |
| Antes das 07h ou depois das 22h | **Fechada** (piso apagado) | "Abre às 07:00" e o primeiro horário, ou "Fechada por hoje" |

Clicar numa quadra abre a agenda dela (`/agenda?visao=quadra&quadra=<id>`).
No celular e em telas médias a faixa rola para o lado, parando em cada
quadra; a página não rola para o lado. Os dados vêm de `ocupacaoDasQuadras`
(`lib/consultas/painel.ts`), que ganhou `emQuadra` (alunos de agora) e
`professorAgora`.

**2. Mosaico de atalhos** (`components/inicio/MosaicoDeAtalhos.tsx`, dados em
`components/layout/atalhos.ts`, ícones próprios em
`components/inicio/IconesDoMosaico.tsx`). Botões grandes laranja com textura
de saibro, rótulo branco grande e ícone de dois tons, em 2 colunas no celular,
3 em telas médias e 4 no tablet e no computador. O primeiro (Diária) fica mais
largo quando sobra espaço na última linha, para a grade fechar sem buraco. Só
aparecem as telas que o perfil pode abrir (a mesma permissão das abas, H9):

| Atalho | Abre | Permissão | Dono | Recepção | Professor* |
| --- | --- | --- | --- | --- | --- |
| Diária | `/agenda` | Agenda | sim | sim | sim |
| Agenda Professores | `/agenda?visao=professor` | Agenda | sim | sim | sim |
| Financeiro | `/financeiro` | Financeiro | sim | sim | não |
| Estoque | `/estoque` | Estoque | sim | sim | não |
| Histórico | `/historico` | Histórico | sim | não | não |
| Clientes | `/alunos` | Alunos | sim | sim | sim |
| Professores | `/professores` | Professores | sim | sim | não |
| Configurações | `/configuracoes` | Configurações | sim | não | não |
| Ranking | `/ranking` | Ranking | sim | sim | não |
| Torneio | `/ranking?aba=torneios` | Ranking | sim | sim | não |
| LAP | `/agenda?tipo=LAP` (agenda filtrada por LAP, hipótese a confirmar) | Agenda | sim | sim | sim |
| Site | endereço de `SITE_DA_ARENA` em `src/lib/branding.ts`, em nova aba | nenhuma | — | — | — |

\* O professor não abre o Início (não tem a permissão do módulo): ele cai
direto na Agenda. A coluna mostra o que o filtro devolveria se a permissão
fosse liberada. **Site:** a constante está **vazia** até o cliente confirmar
o endereço (o site atual não tem HTTPS); vazia, o atalho não aparece. A ordem
dos atalhos é a da lista combinada para o Início; vale conferir com o dono se
é a mesma do sistema antigo.

**3. Placa de atenção** (embaixo, `components/inicio/AtencaoDoInicio.tsx`):
o botão grande com a placa amarela de "!" (`BotaoDeAtencao` de
`components/ui/PlacaDeAtencao.tsx`), o número de pendências e a frase "28
itens precisam de você". **Sem nenhuma pendência, a placa não aparece** e o
Início fica só com as quadras e os atalhos. Clicar na placa abre a janela
**Precisa de atenção**, descrita a seguir; Esc, o X ou um clique fora fecham.

### A navegação

- **Barra do topo** em vidro translúcido (o conteúdo passa por baixo,
  desfocado) e, embaixo dela, uma faixa laranja de saibro com uma linha branca
  no meio, como a linha pintada na quadra. A marca "RED TENNIS" continua em
  vermelho (é o letreiro da arena).
- **Abas** (computador e tablet): Início, Agenda, Clientes, Financeiro,
  Estoque e Ranking / Torneio. Uma pílula laranja desliza até a aba ativa
  (`components/layout/AbasComIndicador.tsx`); a tela de Professores marca a
  aba Clientes. Configurações e Histórico (menu do usuário) não marcam aba.
  Quem pede "menos movimento" no sistema operacional vê a pílula pular direto.
- **Barra do celular** (abaixo de 768 px), também em vidro: ícone e rótulo,
  com uma pílula laranja clara atrás do ícone da aba ativa. A busca vira o
  botão de lupa no topo.

### A janela "Precisa de atenção"

Junta o que pede uma ação hoje, em letra grande, um grupo embaixo do outro.
Só aparecem os grupos que têm algo; os que estão em dia viram uma linha verde
no fim ("Em dia: estoque e reposições."). Cada grupo mostra a contagem da lista
inteira; os três primeiros itens aparecem e "Mostrar todos" abre o resto. O
número da placa e da janela ("28 itens") é a soma dos grupos (o MVP dizia 12
no cartão e mostrava 6 na lista; agora os números são os mesmos). Cada item é
um link para a tela certa (a janela fecha sozinha ao abrir a outra tela).

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
| H5 | Configurações › Reservas e Início | Prazo para pagar a reserva (24 h) e "liberar o horário sozinho" (desligado: a reserva vencida só fica em alerta e a recepção decide). |
| H6 | Configurações › Repasse | Só mostra a regra de cada professor; ela é ajustada na ficha do professor. |
| H7 | Configurações › Ranking | Pontos por vitória (10) e por derrota (2), valores de teste. |
| H8 | Configurações › Ranking | Classificados por grupo (2) e ordem dos critérios de desempate. |
| H9 | Permissões, navegação, Início (mosaico e placa de atenção), busca | Dono vê tudo; recepção vê agenda, alunos, financeiro a receber, estoque e ranking; professor vê agenda e alunos. A matriz é editável. |
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

- **Reservas no Início:** aparecem todas as reservas aguardando pagamento, não
  só as "perto de vencer". Com o prazo de 24 h, toda reserva em aberto já está a
  menos de um dia do vencimento. Se a arena aumentar o prazo e achar a lista
  longa demais, dá para acrescentar um parâmetro "avisar com N horas de
  antecedência".
- **Alunos do professor** (busca rápida): os que têm o professor como principal
  ou estão num horário fixo dele que ainda vale.
- **Perguntas do redesign para o cliente:** o endereço do site (atalho
  "Site"); o que é LAP e se o atalho deve abrir a agenda filtrada por LAP; se o
  professor deve ver o Início; se "Clientes" substitui "Alunos" em todo o
  sistema; se a ordem do mosaico é a do sistema antigo.
- **O que acende a placa de atenção (redesign 3):** hoje, qualquer item dos
  quatro grupos (inclusive reposições que vencem em até 30 dias e produtos
  abaixo do mínimo). Na prática a placa vai aparecer quase sempre. Vale
  perguntar ao dono se a placa deve acender só para o que é urgente (prazo de
  reserva vencido, mensalidade em atraso) e deixar o resto só dentro da janela.
- **Duas bolas no login (redesign 3):** a bola do fundo é decorativa (não
  clica) e fica mais embaixo; a de entrar fica dentro do cartão, com a palavra
  "Entrar". Conferir no teste com o dono se ele não tenta clicar na do fundo.

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

1. Abra o sistema (tela de login). O fundo é uma quadra de saibro com a linha
   branca em "T" e uma bola amarela; no meio, o cartão branco com a logo.
   Devem aparecer três pessoas: Francisco (Dono), Lucas (Recepção) e Renata
   (Professor). Clique em **Lucas**: ele fica com a borda laranja e o ✓, e
   embaixo aparece "Lucas Ferreira · Recepção · …" com o que o perfil vê.
   Embaixo da senha, o aviso "Demonstração: qualquer senha serve".
2. Passe o mouse sobre a **bola de tênis** ao lado da senha: ela sobe e gira, e
   a palavra **Entrar** embaixo dela fica laranja. Escolha **Francisco**,
   digite qualquer senha e aperte **Enter** (ou clique na bola). Deve abrir o
   **Início**: no topo, a faixa verde **Agora nas quadras** com a hora atual e
   as 5 quadras desenhadas (a Quadra 1 azul, as outras laranja); no meio, o
   mosaico laranja; embaixo, a placa preta **Atenção** com o triângulo amarelo
   e o número de pendências. Na barra do topo, a aba **Início** está com a
   pílula laranja.
3. Na faixa, confira uma quadra **Em jogo**: aparecem até dois nomes (com "+n"
   se houver mais gente), o tipo na cor da legenda, "até HH:MM" e o professor.
   Abra a **Diária** em outra aba e confira que é o mesmo horário. Clique na
   quadra: abre a agenda daquela quadra (visão Quadra). Volte.
4. Conte os botões do mosaico: o dono vê **11** (Diária, Agenda Professores,
   Financeiro, Estoque, Histórico, Clientes, Professores, Configurações,
   Ranking, Torneio e LAP). O **Site** não aparece enquanto o endereço não for
   confirmado. Clique em **Torneio**: abre o Ranking na aba de torneios. Volte e
   clique em **LAP**: abre a agenda filtrada por LAP.
5. Clique na placa **Atenção**: abre a janela **Precisa de atenção**. O número
   da placa (ex.: 28) é a soma dos grupos da janela (ex.: 9 + 5 + 7 + 7).
   Aperte **Esc**: a janela fecha. Abra de novo e feche pelo **X**. Abra mais
   uma vez; no grupo **Mensalidades em atraso**, clique em **Mostrar todos**:
   aparecem todas as linhas do número do grupo. Clique numa delas: abre a
   ficha do aluno. (Sem nenhuma pendência, a placa não aparece; isso está
   provado no teste `components/inicio/AtencaoDoInicio.test.ts`.)
6. Clique nas abas **Agenda**, **Clientes** e **Ranking / Torneio**: a pílula
   laranja desliza até a aba clicada. Abra **Professores** (pelo mosaico): a
   aba **Clientes** fica marcada.
7. Na barra do topo, clique no campo **Buscar aluno…** e digite `gui lim`.
   Deve aparecer **Guilherme Lima** com "Gui" e "Lim" em destaque. Aperte
   **Enter**: abre a ficha dele. (Quando há mais de um resultado, as setas para
   cima e para baixo escolhem a linha antes do Enter.)
8. Na busca, digite os quatro últimos números de um telefone (ex.: `2210`):
   aparece o aluno dono do telefone.
9. Clique no seu nome, no canto direito da barra. O menu mostra o perfil,
   **Configurações**, **Histórico de alterações** e **Sair e trocar de
   usuário**. Clique em **Configurações**.
10. Em **Reservas e agenda**, troque o prazo para pagar a reserva para `0` e
   clique em **Salvar alterações**. Deve aparecer o erro "O prazo para pagar a
   reserva precisa ser maior que zero (em horas inteiras)." e nada é salvo.
11. Troque o prazo para `48`, ligue **Liberar o horário sozinho** e salve.
    Deve aparecer "Regras de reserva e agenda salvas.".
12. Em **Reposição de aulas**, clique em **Incluir sigla**. Preencha o código
    `CH`, o nome "Atestado médico" e clique em **Incluir sigla**. Deve aparecer
    o erro "Já existe a sigla "CH". Escolha outro código.". Troque o código para
    `AT` e inclua de novo: a sigla aparece na lista.
13. Na sigla **TIP**, clique em **Desativar** e confirme. Ela fica com o selo
    "Desativada" e o botão vira **Reativar**.
14. Em **Planos**, clique na lixeira de **Individual · 1x por semana** e
    confirme. Deve aparecer o erro dizendo que o plano tem matrículas vigentes e
    não pode ser apagado. Cancele.
15. Clique em **Novo plano**, preencha "Individual · 2x por semana", valor
    `1280`, 2 aulas por semana e inclua. Depois apague esse plano novo pela
    lixeira: como não tem matrícula, ele sai do catálogo.
16. Em **Permissões**, marque **Recepção** na linha **Histórico de
    alterações** e clique em **Salvar permissões**. Repare que a célula do Dono
    em **Configurações** está travada (cadeado).
17. Abra o menu do usuário e vá em **Histórico de alterações**. Devem aparecer
    as mudanças feitas acima, da mais recente para a mais antiga, com
    "por Francisco Menezes". Na linha "Prazo para pagar a reserva (horas) e
    Liberar reserva vencida sozinho", clique em **Ver detalhes**: aparecem os
    campos com o valor de antes e o de depois (24 → 48; não → sim). Nas
    alterações de permissões e de siglas, o detalhe vem em frases ("Recepção:
    passou a ver Histórico de alterações").
18. No filtro **Tipo de registro**, escolha **Planos**: sobram só as
    alterações de planos.
19. Recarregue a página do Histórico: ele volta vazio, com a explicação de que
    a demonstração recomeça a cada visita.
20. Abra o menu do usuário e clique em **Sair e trocar de usuário**. Entre como
    **Lucas Ferreira** (Recepção). A barra mostra as mesmas abas, mas o menu do
    usuário não tem Configurações nem Histórico.
21. Aperte o botão **Voltar** do navegador duas vezes, até a página do
    Histórico que o Francisco tinha aberto. Como a página foi recarregada no
    passo 19, as permissões voltaram ao início e a recepção não abre o
    Histórico: deve aparecer **Sem acesso a esta área**, com o botão **Voltar ao
    Início**. No Início, o mosaico da recepção tem **9** botões (sem Histórico
    nem Configurações) e a Diária ocupa a primeira linha inteira.
22. Saia e entre como **Renata Coelho** (Professor). Ela cai direto na Agenda e
    só vê as abas **Agenda** e **Clientes**. A busca diz "Buscar entre meus
    alunos…". Digite `/dashboard` no endereço: aparece **Sem acesso a esta
    área** com o botão **Ir para Agenda**.
23. No celular (ou com a janela estreita), a navegação fica na barra de baixo e
    a busca é o botão de lupa no topo, que abre em tela cheia. A aba ativa
    tem uma pílula laranja clara atrás do ícone. No Início, a faixa das quadras
    rola para o lado com o dedo (uma quadra por vez) e o mosaico fica em duas
    colunas; a página não rola para o lado.

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
| Início (`ocupacaoDasQuadras`, `precisaDeAtencao`...) | Viram consultas ou funções (`rpc`): ocupação do dia por quadra (com quem está em quadra agora e o professor), reservas aguardando pagamento, mensalidades em atraso (view com a situação do lançamento), saldo de estoque (view sobre os movimentos) e créditos a vencer (view `saldo_reposicao`). As telas não mudam. |
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
- Links que o Início e a busca abrem: `/agenda?visao=quadra&quadra=<id>`
  (faixa das quadras), `/agenda?visao=professor`, `/agenda?tipo=LAP`,
  `/agenda?data=AAAA-MM-DD&quadra=<id>` (reservas do "Precisa de atenção"),
  `/ranking?aba=torneios` e `/alunos?busca=<termo>`. Se a agenda, o ranking e a
  lista de clientes lerem esses parâmetros, os atalhos já chegam filtrados.
- Tela nova que deva ganhar um botão no mosaico: acrescente em
  `components/layout/atalhos.ts` (com a permissão), um ícone em
  `components/inicio/IconesDoMosaico.tsx` e o caso em `atalhos.test.ts`.
- Parâmetro novo em `Configuracoes` precisa ganhar um campo na tela de
  Configurações (`components/base/configuracoes/`).
- `useHoraAtual()` (`components/base/useHoraAtual.ts`) dá a hora da arena sem
  `new Date()` na renderização (sem erro de hidratação).

## No banco (funções)

Migração `supabase/migrations/20261030120200_funcoes_alunos.sql` (a mesma do
módulo de alunos); testes em `supabase/tests/50_alunos.test.sql`. Esta seção
substitui a tabela "Notas para a migração ao Supabase" acima onde as duas
divergirem: as siglas, as formas de pagamento e as permissões continuam como
listas dentro da linha única de `configuracoes` (não viraram tabelas).

A tela chama cada função com `supabase.rpc("nome", { p_campo: valor })`
(campo da tela em snake_case com `p_` na frente). As mensagens de recusa são
as mesmas da tela; sem permissão, a mensagem é "Seu perfil não tem permissão
para esta operação." (código 42501).

**Configurações (só o dono):**

| Operação da tela | No banco | Retorno |
| --- | --- | --- |
| `salvarParametros` | `salvar_parametros(p_validade_reposicao_meses, p_prazo_pagamento_reserva_horas, p_liberar_reserva_automaticamente, p_semanas_geradas_a_frente, p_bloquear_professor_em_duas_aulas, p_pontos_vitoria, p_pontos_derrota, p_torneio_conta_para_ranking, p_classificados_por_grupo, p_criterios_desempate, p_formas_pagamento, p_prazo_pagamento_consumo_dias, p_preco_locacao_hora, p_preco_paredao_hora)` — todos opcionais; o que não vier fica como está | nada |
| `incluirSigla` | `incluir_sigla(p_codigo, p_nome, p_descricao, p_gera_credito, p_aplica_a)` | nada |
| `editarSigla` | `editar_sigla(p_codigo_atual, p_sigla)`; `p_sigla` = `{ codigo, nome, descricao, geraCredito, aplicaA }` | nada |
| `desativarSigla` / `reativarSigla` | `desativar_sigla(p_codigo)` / `reativar_sigla(p_codigo)` | nada |
| `incluirPlano` | `incluir_plano(p_nome, p_tipo, p_valor_mensal, p_aulas_por_semana, p_duracao_minutos, p_tabela, p_ativo)` | id do plano |
| `editarPlano` | `editar_plano(p_id, p_nome, p_tipo, p_valor_mensal, p_aulas_por_semana, p_duracao_minutos, p_tabela, p_ativo)` | id do plano |
| `desativarPlano` / `reativarPlano` (catálogo) | grava direto em `planos` (`ativo = false/true`) | — |
| `apagarPlano` | `apagar_plano(p_id)` | nada |
| `alterarPermissoes` | `alterar_permissoes(p_permissoes)`; `p_permissoes` = `{ dono: [...], recepcao: [...], professor: [...] }` | nada |
| `alterarConfiguracoes` | não tem função própria: a tela grava pelas funções acima, que validam os valores antes | — |

O que as funções garantem e a tabela sozinha não garantia: vitória vale pelo
menos a derrota; formas de pagamento sem nome vazio e sem repetição; critérios
de desempate só mudam de ordem; código de sigla de 1 a 6 letras ou números,
sem repetir, e que não muda depois de usado; nome de plano sem repetir; tipo
de plano que não muda depois de ter matrícula; plano usado não se apaga
(vigente ou no histórico); o dono nunca perde o acesso às Configurações e só
ele o tem; contas a pagar exigem o Financeiro. Atenção: um `update` direto em
`configuracoes` (permitido ao dono pela RLS) pula essas conferências, por
isso a tela deve usar sempre as funções.

**Comentários (qualquer pessoa da equipe):**

| Operação da tela | No banco | Retorno |
| --- | --- | --- |
| `adicionarComentario` | `adicionar_comentario(p_entidade, p_entidade_id, p_texto)`: autor e nome do autor vêm de quem está logado, não da tela | id do comentário |
| `editarComentario` | `editar_comentario(p_id, p_texto)`: só quem escreveu; grava a hora da edição | id do comentário |
| `apagarComentario` | `apagar_comentario(p_id)`: só quem escreveu (a auditoria guarda o texto) | nada |

Comentar não depende de módulo: o professor também comenta (a mesma regra da
RLS de `comentarios`).

Diferença em relação à tela: na comparação de nomes (siglas, formas de
pagamento, planos), o banco ignora maiúsculas, espaços nas pontas e os
acentos mais comuns do português (á, ã, ç, é...), sem a extensão `unaccent`.

### Ligação com as telas

As operações de Configurações estão ligadas ao banco real em
`src/lib/supabase/operacoes/configuracoes.ts` (comentários: `base.ts`, na
mesma pasta). Todas usam as funções da tabela acima, menos desativar e
reativar plano do catálogo, que gravam direto em `planos`. Ao salvar uma
seção, só os parâmetros dela vão para `salvar_parametros`; os outros ficam
como estão. Testes de integração:
`src/lib/supabase/operacoes/configuracoes.integracao.test.ts` (cada teste
devolve o valor anterior no fim, porque a linha de configurações é uma só).

Diferenças entre o modo demonstração e o modo Supabase:

- O id de um plano novo é criado pelo banco (a tela não depende dele).
- No modo demonstração, o menu do usuário mostra "Modo demonstração · nada é
  gravado": ali tudo fica só no navegador e some ao recarregar a página.

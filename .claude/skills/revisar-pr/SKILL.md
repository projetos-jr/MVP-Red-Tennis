---
name: revisar-pr
description: Revisa um pull request do sistema Red Tennis pela definição de pronto do projeto e produz um parecer em linguagem simples para o consultor que vai aprovar (o que muda, riscos, como testar clicando, o que falta). Use sempre que alguém pedir para revisar, conferir, aprovar ou "dar uma olhada" num PR, numa branch ou num diff deste repositório, ou perguntar se pode fazer merge.
---

# Revisar um pull request (definição de pronto)

Quem aprova o PR é um consultor sem formação em computação. O seu papel é dar a ele um parecer
que ele consiga entender e conferir, sem esconder risco. A aprovação e o merge são dele: não
aprove nem faça merge por conta própria, a menos que a pessoa peça explicitamente.

## Como levantar o material

- PR do GitHub: leia título, descrição, arquivos, diff, comentários e o resultado do CI
  (jobs `verificar`, `banco` e `integracao`). Sem acesso ao GitHub, use
  `git diff main...<branch>`.
- Leia os documentos do módulo afetado (`docs/modulos/`, `docs/BANCO.md`) para saber qual
  regra deveria valer.
- Confira o estado real antes de opinar: o PR ainda está aberto (ou já entrou na `main`)? A
  base mudou depois dele? Os passos de "como testar" funcionam hoje no repositório como ele
  está (branch padrão, segredos e ambientes configurados, site publicado)? Um passo de teste
  que a pessoa não consegue executar é um problema do parecer, não dela.

## O que conferir (definição de pronto do projeto)

1. **Escopo**: o que o PR faz está no contratado ou foi pedido por escrito? Se não, sinalize
   (a skill `pedido-do-cliente` ajuda a classificar). PR que mistura assuntos: peça para
   separar.
2. **Regras de negócio**: nada inventado; regra não confirmada pelo cliente aparece como
   hipótese configurável e documentada.
3. **Banco**: mudança só por migração NOVA (nenhuma migração existente editada — confira no
   diff), RLS e gatilho de auditoria em tabela nova, função com `security invoker` e
   `iniciar_operacao`, teste pgTAP. Nada de chave secreta, senha ou string de conexão no código.
4. **Permissões**: respeita o perfil (dono, recepção, professor)? Há teste de perfil recusado?
5. **Auditoria**: alteração de dados aparece no histórico com o nome da operação?
6. **Tela**: gravação com `await gravar(...)`; mensagens claras; funciona no computador, no
   tablet e no celular; nenhum texto ou visual mudou sem motivo.
7. **Testes**: o CI está verde? Os testes novos cobrem o caminho certo e as recusas?
8. **Documentação**: o documento do módulo e o roteiro de teste foram atualizados?
9. **LGPD e segurança**: nenhum dado real de aluno (nomes, telefones, CPF, pagamentos) em
   código, testes, prints ou descrição — o repositório é público.

Verifique de fato (rode `npm test`, leia o código) em vez de confiar na descrição do PR.

## Formato do parecer

Escreva em português simples, curto, nesta ordem:

```
## Parecer: <Pode aprovar | Aprovar depois de ajustes | Não aprovar ainda>

**O que este PR muda** (2 a 4 frases, sem jargão)

**Como testar** (passos de clique, com o que deve aparecer em cada passo)

**Problemas encontrados** (do mais grave ao menos grave; para cada um: o que é, por que importa,
onde está — arquivo:linha — e sugestão de correção. Marque cada um como Bloqueante, Alta,
Média ou Baixa.)

**Conferido** (lista curta do que foi verificado e passou)

**Fica para depois / perguntas** (dúvidas de regra para o cliente, melhorias fora do escopo)
```

Se não houver problema, diga isso claramente — não invente ressalvas para parecer rigoroso.
Diferencie o que você **verificou** (rodou, leu) do que está só **descrito** no PR.

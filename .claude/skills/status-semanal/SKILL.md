---
name: status-semanal
description: Prepara o rascunho do e-mail de status semanal que o coordenador da UFABC Jr. envia ao cliente da arena Red Tennis (toda sexta), a partir do que de fato foi entregue no repositório na semana, do plano de ação e das pendências do cliente. Use quando pedirem "status da semana", "e-mail de sexta", "resumo para o cliente", "o que fizemos essa semana" ou quando for sexta-feira e o coordenador estiver fechando a semana.
---

# Status semanal para o cliente

O status semanal é o compromisso de transparência com o cliente (plano de ação, seção 7): o
que foi concluído, o que vem na próxima semana, o que depende da arena e o próximo marco. Ele
também é o registro escrito que protege a equipe quando a arena atrasa respostas (atraso do
cliente suspende o prazo do contrato). Você só prepara o rascunho; quem revisa e envia é o
coordenador — nunca envie e-mail por conta própria.

## Levantamento (fatos, não impressões)

1. **Entregas da semana**: PRs mergeados na `main` entre segunda e hoje (GitHub, ou
   `git log --merges --since=<segunda> origin/main`). Leia título e descrição de cada um.
   Considere entregue só o que está na `main` — PR aberto entra como "em andamento".
2. **O que está publicado**: se o ambiente de teste já foi atualizado (workflow
   `publicar-banco`, site na Cloudflare), diga onde o cliente pode ver.
3. **Plano**: a semana corrente e a próxima em `docs/privado/CONTEXTO-COMPLETO-RED-TENNIS.md`
   (seções 5 e 8). Compare o previsto com o entregue e seja honesto sobre atrasos.
4. **Pendências da arena**: perguntas ainda sem resposta (seção 13 do contexto e as hipóteses
   H1–H14 de `docs/MODELO-E-TELAS.md`), com a data em que foram pedidas, se houver registro.
5. Se o contexto privado não estiver disponível, avise e monte o status só com o repositório.

## Rascunho (formato)

```
Assunto: Red Tennis — status da semana <dd/mm a dd/mm>

Olá, <nome>,

**Concluído nesta semana**
- <entrega em linguagem do dia a dia da arena: o que a recepção/o dono passa a conseguir fazer>

**Em andamento**
- <item> — previsão: <dia>

**Próxima semana**
- <itens do plano>

**O que precisamos da arena**
- <pergunta objetiva> (pedida em <data>; precisamos até <data> para manter o prazo)

**Próximo marco:** <ex.: demonstração e pesquisa de satisfação em 06/11>

Qualquer dúvida, estamos à disposição.
<assinatura do coordenador>
```

## Cuidados

- Linguagem da arena, não de programador: "a agenda agora impede marcar duas aulas na mesma
  quadra e horário", e não "exclusion constraint".
- Nada de dados de alunos, valores do contrato, senhas ou links internos sensíveis.
- Não prometa o que não está no plano; o que estiver fora do escopo segue a skill
  `pedido-do-cliente`.
- Pendência do cliente com prazo vencido: registre de forma cordial e objetiva que o prazo
  depende da resposta (é isso que formaliza a suspensão do prazo).
- Entregue também, separado do e-mail, uma lista curta para o coordenador conferir: o que
  foi verificado no repositório e o que você deduziu.

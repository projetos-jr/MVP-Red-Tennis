---
name: pedido-do-cliente
description: Classifica um pedido, ideia ou reclamação do cliente da arena Red Tennis (ou de alguém da equipe) quanto ao escopo do contrato e indica o caminho certo — vira tarefa, vira pergunta ao cliente, ajuste por e-mail ou Termo Aditivo — com a mensagem pronta em linguagem simples. Use sempre que chegar algo como "o dono da arena pediu…", "o cliente quer…", "dá pra colocar…", "e se o sistema também…", um comentário do CSAT, um pedido por WhatsApp, ou antes de começar qualquer funcionalidade que não esteja claramente no plano.
---

# Pedido do cliente: está no escopo?

A UFABC Jr. tem um contrato de **escopo fechado**: o que fugir dele exige nova contratação ou
Termo Aditivo assinado, e todo ajuste é formalizado por e-mail. Aceitar pedidos "de boca" é o
caminho mais curto para estourar prazo e gerar conflito — e recusar sem explicar estraga a
relação. O seu trabalho é classificar com justificativa e deixar o próximo passo pronto.

## Fontes (leia nesta ordem)

1. `docs/privado/CONTEXTO-COMPLETO-RED-TENNIS.md` — seção 4 (contrato: 4.2 escopo
   contratado, 4.3 pedidos da descoberta, 4.4 fora do contrato), seção 13 (perguntas em
   aberto) e seção 11 (decisões). É confidencial e fica fora do Git: **nunca** copie trechos
   dele para arquivos do repositório, issues ou PRs (o repositório é público).
   Se o arquivo não existir nesta sessão, avise que a classificação fica limitada e peça para
   salvá-lo em `docs/privado/`.
2. `CLAUDE.md` (resumo dos módulos contratados) e `README.md` ("Fora do escopo desta versão").
3. `docs/MODELO-E-TELAS.md` (hipóteses H1–H14) e `docs/modulos/<módulo>.md` (o que já existe).

## Classifique em uma destas categorias

| Categoria | Quando | Próximo passo |
| --- | --- | --- |
| **Já existe** | O sistema já faz (talvez a pessoa não achou) | Explicar onde está e como usar |
| **Erro** | Algo contratado não funciona como combinado | Issue de correção, com gravidade |
| **Dentro do escopo** | Detalhe ou ajuste de algo contratado (Cl. 2) ou levantado na descoberta | Issue com critério de aceite; registrar por e-mail se mudar comportamento |
| **Falta regra** | Está no escopo, mas depende de informação que o cliente não deu | Pergunta objetiva ao cliente (prazo de 2 dias úteis); se der para seguir, parâmetro configurável + hipótese registrada |
| **Fora do escopo** | Não está na Cl. 2 nem na descoberta, ou está listado como fora (seção 4.4) | E-mail explicando que fica para a fase 2 ou para Termo Aditivo; nada é feito antes da assinatura |

Na dúvida entre "dentro" e "fora", diga que é dúvida e recomende confirmar com o coordenador
antes de prometer qualquer coisa. Pedido grande disfarçado de pequeno ("é só um botão") merece
atenção: avalie o que ele exige no banco, nas permissões e nos testes.

## Resposta (sempre neste formato)

```
**Classificação:** <categoria>
**Por quê:** <1 a 3 frases citando a parte do escopo/plano que sustenta a classificação — sem copiar texto confidencial>
**Impacto:** <módulos afetados, esforço aproximado (pequeno/médio/grande), risco para o prazo>
**Próximo passo:** <o que fazer, quem faz (coordenador, consultor X) e até quando>
**Mensagem pronta** (para o coordenador revisar e enviar por e-mail — nunca envie você mesmo):
<texto curto, cordial, linguagem simples, sem jargão técnico>
```

A mensagem nunca promete prazo ou entrega que não foi combinada, nunca menciona valores do
contrato e, para fora do escopo, apresenta a alternativa (fase 2 ou aditivo) em vez de só
dizer "não".

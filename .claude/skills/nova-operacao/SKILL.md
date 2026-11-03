---
name: nova-operacao
description: Passo a passo para criar ou mudar uma ação que grava dados no sistema Red Tennis, de ponta a ponta — operação da tela (src/lib/banco/operacoes), função do banco ou gravação direta, ligação ao Supabase (src/lib/supabase/operacoes), botão/formulário na tela com await, testes e documentação. Use sempre que a pessoa pedir um botão, formulário ou fluxo novo que salva, altera, cancela ou apaga algo (por exemplo, "quero poder transferir um aluno de horário", "adicionar desconto na mensalidade", "o botão de cancelar torneio"), ou quando uma regra de gravação existente precisar mudar.
---

# Operação nova (ou alterada) de ponta a ponta

No Red Tennis, toda gravação é uma **operação**: tudo ou nada, com a mesma regra valendo na
tela (conforto, mensagem imediata) e no banco (onde vale de verdade). Uma operação só está
pronta quando funciona nos dois modos do sistema — demonstração (dados em memória) e Supabase
— e tem testes. Se o pedido cair fora do escopo contratado ou depender de regra que o cliente
não confirmou, pare e use a skill `pedido-do-cliente` antes.

Leia primeiro `docs/ARQUITETURA.md` e o documento do módulo em `docs/modulos/`.

## 1. A operação da tela — `src/lib/banco/operacoes/<modulo>.ts`

- `export const fazerAlgo = definirOperacao("Nome que aparece no histórico", (banco, dados, ctx) => novoBanco)`.
- Função pura: copie listas e objetos (`map`, spread), nunca altere no lugar. A auditoria do modo
  demonstração depende disso (compara referências).
- Recuse com `exigir(condição, "Mensagem clara para quem está na recepção.")`.
- "Hoje" e "agora" vêm de `ctx.hoje`/`ctx.agora` (nunca `new Date()`), no fuso da arena.
- Teste em `src/lib/banco/operacoes/<modulo>.test.ts`: caminho certo, cada recusa, permissão.

## 2. No banco — escolha UMA forma

- **Grava em uma tabela só, regras já garantidas por constraints + RLS** (cadastro simples):
  não precisa de função; a ligação usa `espelhar([...])`.
- **Grava em várias tabelas, lê-e-decide (saldo, conflito, numeração) ou é regra crítica**:
  crie uma função do Postgres numa migração nova seguindo a skill `mudar-banco` (padrão
  `iniciar_operacao` + `recusar` com a MESMA mensagem da tela, `security invoker`, teste pgTAP).

## 3. A ligação — `src/lib/supabase/operacoes/<modulo>.ts`

```ts
ligar(fazerAlgo, porFuncao("fazer_algo", (d) => ({ p_campo: d.campo }), ["tabela1", "tabela2"]));
// ou
ligar(cadastrarCoisa, espelhar(["coisas"]));
```

- Parâmetros: `p_` + campo em snake_case, conferidos na assinatura da função.
- O último argumento lista TODAS as tabelas que a gravação pode mudar: elas são relidas depois,
  senão a tela mostra dado velho.
- Se a tela precisa do id criado (para abrir o registro), devolva-o (`idDoRetorno`) e use
  `resultado.id` na tela: o banco pode gerar um id diferente do da tela.
- O teste `src/lib/supabase/ligacoes.test.ts` falha enquanto a operação não estiver ligada.

## 4. A tela

```tsx
const gravar = useGravar();
async function salvar() {
  if (await gravar(fazerAlgo, dados, "Pronto: algo feito.")) aoFechar();
}
```

Sempre `await`: gravar é assíncrono (o banco responde depois). O lint
(`no-misused-promises`) acusa `if (gravar(...))` sem `await`. Peças comuns em
`src/components/ui/` (Modal, Formulario, Confirmacao, Avisos). Layout para computador, tablet
(quadra) e celular.

## 5. Testes de integração (modo Supabase)

Em `src/lib/supabase/operacoes/<modulo>.integracao.test.ts`, com `entrar(perfil)` e
`executar(sessao, op, dados)` de `src/lib/supabase/integracao/ambiente.ts`: caminho certo
conferindo o que ficou no banco, a recusa do banco mesmo burlando a tela
(`sessao.cliente.rpc(...)` direto) e a permissão. Use nomes e datas únicos (`EXECUCAO`,
`dataDeTeste`). Como rodar está no cabeçalho de `ambiente.ts`.

## 6. Conferência final

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Mais `npx supabase test db` e `npm run test:integracao` se mexeu no banco. Atualize o
documento do módulo (regras, hipóteses, roteiro de teste para quem não é programador) e abra
o PR com "como testar" em passos de clique. Diga à pessoa o que foi feito, testado e o que
falta validar.

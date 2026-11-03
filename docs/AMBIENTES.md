# Ambientes: teste e produção

O sistema tem dois ambientes, cada um com o seu banco (Supabase) e o seu site
(Cloudflare). Nada é feito direto na produção: tudo passa primeiro pelo teste.

| | Teste | Produção |
| --- | --- | --- |
| Para quê | Demonstração, testes da equipe e do cliente, dados de exemplo e (a partir da semana 3) a importação dos dados reais para conferência | O sistema em uso pela arena |
| Supabase | projeto **Red Tennis Teste** (`mpmbnwqaiqgoojdtmrqr`) | projeto **Red Tennis** (`xfludepkrcnwovnckpfc`) |
| Endereço da API | `https://mpmbnwqaiqgoojdtmrqr.supabase.co` | `https://xfludepkrcnwovnckpfc.supabase.co` |
| Banco atualizado | sozinho, a cada merge na `main` que muda uma migração | manual, com aprovação (ver abaixo) |
| Dados de exemplo | sim, enquanto não houver dados reais | **nunca** |
| Site | Worker `mvp-red-tennis` na Cloudflare | a definir na entrega (conta do cliente, cláusula 49) |

Os dois projetos do Supabase estão no plano gratuito, na região de São Paulo
(sa-east-1). O plano gratuito pausa o projeto depois de 7 dias sem uso e não
tem backup diário: o backup próprio entra na semana 3 (`docs/BANCO.md`).

---

## Como o banco é atualizado (`.github/workflows/publicar-banco.yml`)

1. Alguém cria uma migração nova em `supabase/migrations/`, com testes.
2. O pull request roda o CI: as migrações são aplicadas num banco limpo e os
   testes do banco rodam (`job banco`).
3. Depois do merge na `main`, o GitHub aplica as migrações novas no projeto de
   **teste** sozinho.
4. Para a **produção**: GitHub → Actions → **publicar-banco** → *Run workflow*
   → ambiente `producao`. O GitHub pede a aprovação de quem estiver como
   revisor do ambiente.

O passo "Mostrar o que vai ser aplicado" lista as migrações antes de aplicar.
Migração que já foi aplicada nunca roda de novo.

**Dados de exemplo no teste:** *Run workflow* → ambiente `teste` → marcar
"Carregar os dados de exemplo". Só funciona com o banco vazio (os registros de
exemplo têm ids fixos). Os dados de exemplo são fictícios; antes de importar
dados reais, eles são apagados.

---

## Configuração única no GitHub (feita por uma pessoa)

O Claude não vê nem guarda senhas e tokens. Quem tem acesso às contas do
projeto faz isto uma vez, direto no GitHub:

1. **Token do Supabase** (vale para os dois projetos): no Supabase, clique no
   avatar → *Account preferences* → *Access Tokens* → *Generate new token*,
   nome `github-actions-red-tennis`. Copie o token.
   No GitHub: *Settings → Secrets and variables → Actions → New repository
   secret*, nome `SUPABASE_ACCESS_TOKEN`, cole o token.
2. **Ambiente de teste**: GitHub → *Settings → Environments → New environment*
   → `teste`.
   - *Add environment variable*: `SUPABASE_PROJECT_ID` = `mpmbnwqaiqgoojdtmrqr`.
   - *Add environment secret*: `SUPABASE_DB_PASSWORD` = a senha do banco do
     projeto Red Tennis Teste (definida na criação do projeto; se ninguém
     souber, troque em Supabase → projeto → *Database → Settings → Reset
     database password* e guarde no cofre de senhas da equipe).
3. **Ambiente de produção**: *New environment* → `producao`.
   - Marque *Required reviewers* e escolha quem aprova (o coordenador, por
     exemplo).
   - Variável `SUPABASE_PROJECT_ID` = `xfludepkrcnwovnckpfc`.
   - Segredo `SUPABASE_DB_PASSWORD` = a senha do banco do projeto Red Tennis.
4. Teste: *Actions → publicar-banco → Run workflow* (ambiente `teste`). Se
   faltar alguma configuração, o primeiro passo diz exatamente qual.

**Recomendado no Supabase (nos dois projetos):** *Authentication → Sign In /
Providers → Email* → desligar **Allow new users to sign up**. Usuários da
equipe são criados pelo painel; ninguém precisa se cadastrar sozinho. (Mesmo
com o cadastro aberto, quem não estiver em `colaboradores` não vê nada, por
causa da RLS; desligar fecha a porta de vez.)

---

## O site (Cloudflare)

Publicação pelo painel da Cloudflare, ligada ao GitHub (passo a passo no
`README.md`, seção "Publicação na Cloudflare"). Cada push na `main` publica uma
nova versão.

O site escolhe o banco pelas variáveis de ambiente (modelo em `.env.example`):

| Variável | Valor no ambiente de teste |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mpmbnwqaiqgoojdtmrqr.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | a chave **publicável** do projeto de teste (Supabase → *Project Settings → API Keys*) |

Na Cloudflare elas ficam em *Workers & Pages → mvp-red-tennis → Settings →
Build → Variables and secrets* (são lidas na hora do build; depois de mudar,
rode um novo deploy). **Sem as variáveis, o site abre em modo demonstração**
(dados de exemplo em memória, nada é gravado).

A chave publicável pode ir para o site: quem a tem só vê o que a RLS deixa, e
sem login não vê nada. A chave secreta (`service_role`/`secret`), a senha do
banco e a string de conexão **nunca** vão para o site, o código ou o chat.

---

## Usuários da equipe

1. Supabase → projeto → *Authentication → Users → Add user → Create new user*
   (e-mail e senha, marcando *Auto Confirm User*).
2. Liberar no sistema: informe ao Claude **só o e-mail e o perfil** (`dono`,
   `recepcao` ou `professor`). Ele roda:

   ```sql
   insert into public.colaboradores (id, nome, cargo, perfil)
   select id, '<Nome>', '<Cargo>', '<perfil>'
   from auth.users where email = '<email>';
   ```

Quem não está em `colaboradores` (ou está com `ativo = false`) consegue fazer
login, mas não vê nenhum dado.

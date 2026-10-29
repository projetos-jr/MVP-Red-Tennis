# Fotos dos alunos

As fotos dos 23 membros cadastrados pelo cliente já estão aqui, nomeadas com o
id de cada pessoa (`a01.jpg` … `a23.jpg`).

## Adicionar a foto de mais alguém (dados de exemplo)

1. Salve o arquivo como `public/avatars/<id>.jpg` — de preferência quadrado,
   enquadrado no rosto, com cerca de 400×400.
2. Preencha `fotoUrl` do aluno nos dados de exemplo
   (`src/lib/banco/semente/cadastros.ts`).

Quem não tem foto aparece com as iniciais sobre uma cor derivada do id. O
componente `<Avatar>` também usa as iniciais se o arquivo falhar ao carregar.

Com o banco real, as fotos irão para o armazenamento de arquivos do Supabase
(Storage), e não para esta pasta. Fotos são dado pessoal (LGPD): só com
autorização, e com cuidado redobrado no caso de menores de idade.

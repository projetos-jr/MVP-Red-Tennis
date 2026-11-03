-- Historico: nome da operacao vindo do cabecalho x-operacao (gravacoes
-- diretas da tela nas tabelas).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000002', 'recepcao@teste');
insert into public.colaboradores (id, nome, perfil) values
  ('00000000-0000-0000-0000-000000000002', 'Recepção Teste', 'recepcao');

create function pg_temp.entrar_como(p_id text, p_cabecalhos text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_id, true);
  select set_config('request.headers', p_cabecalhos, true);
  set local role authenticated;
$$;

-- Como a tela manda: texto JSON com os acentos escritos como \u00e7.
select pg_temp.entrar_como(
  '00000000-0000-0000-0000-000000000002',
  '{"x-operacao": "\"Cadastrar aluno \\u00e7\""}'
);
insert into public.alunos (id, nome) values ('t-al-1', 'Aluno Cabeçalho');
reset role;

select is(
  (select operacao from public.auditoria where tabela = 'alunos' and registro_id = 't-al-1'),
  'Cadastrar aluno ç',
  'o nome da operacao vem do cabecalho, com acento'
);

select is(
  (select usuario_nome from public.auditoria where tabela = 'alunos' and registro_id = 't-al-1'),
  'Recepção Teste',
  'quem fez continua vindo do login'
);

-- Cabecalho estragado nao impede a gravacao: so fica sem nome.
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002', '{"x-operacao": "sem aspas"}');
insert into public.alunos (id, nome) values ('t-al-2', 'Outro Aluno');
reset role;

select is(
  (select operacao from public.auditoria where tabela = 'alunos' and registro_id = 't-al-2'),
  null,
  'cabecalho invalido grava sem o nome da operacao'
);

select * from finish();
rollback;

-- Quem ve e quem grava o que (RLS por perfil, Hipotese H9) e a auditoria.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Tres pessoas da equipe, uma de cada perfil.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'dono@teste'),
  ('00000000-0000-0000-0000-000000000002', 'recepcao@teste'),
  ('00000000-0000-0000-0000-000000000003', 'professor@teste');
insert into public.professores (id, nome, cor) values ('t-prof', 'Professor Teste', '#000000');
insert into public.colaboradores (id, nome, perfil, professor_id) values
  ('00000000-0000-0000-0000-000000000001', 'Dono Teste', 'dono', null),
  ('00000000-0000-0000-0000-000000000002', 'Recepção Teste', 'recepcao', null),
  ('00000000-0000-0000-0000-000000000003', 'Professor Teste', 'professor', 't-prof');

insert into public.produtos (id, nome, categoria, unidade, preco_custo, preco_venda)
values ('t-prod', 'Água teste', 'Bebidas', 'garrafa', 2, 5);
insert into public.lancamentos (id, tipo, categoria, item, valor, vencimento) values
  ('t-receber', 'receber', 'Outros', 'Recebimento', 10, '2026-11-10'),
  ('t-pagar', 'pagar', 'Despesa', 'Conta de luz', 10, '2026-11-10');

-- Entra como alguem: o papel "authenticated" com o id do usuario.
create function pg_temp.entrar_como(p_id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_id, true);
  set local role authenticated;
$$;

-- --- Anonimo -----------------------------------------------------------------
set local role anon;
select throws_ok(
  $$ select count(*) from public.alunos $$,
  '42501', null,
  'anonimo nao le nada'
);
reset role;

-- --- Recepcao ----------------------------------------------------------------
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from public.lancamentos where id in ('t-receber', 't-pagar')),
  1,
  'recepcao ve contas a receber, mas nao contas a pagar'
);
select lives_ok(
  $$ insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo)
     values ('t-oc', '4', '2026-11-11', '08:00', '09:00', 'Individual') $$,
  'recepcao marca horario na agenda'
);
-- Atualizacao barrada pela politica nao da erro: so nao muda nada.
update public.configuracoes set pontos_vitoria = 99 where id = 1;
select is(
  (select pontos_vitoria::int from public.configuracoes where id = 1),
  10,
  'recepcao nao altera configuracoes'
);
select is(
  (select count(*)::int from public.auditoria),
  0,
  'recepcao nao ve o historico de alteracoes'
);
select lives_ok(
  $$ insert into public.comentarios (id, entidade, entidade_id, texto, autor_nome)
     values ('t-com', 'ocupacao', 't-oc', 'Comentário da recepção', 'Recepção Teste') $$,
  'recepcao comenta'
);
reset role;

-- --- Professor ---------------------------------------------------------------
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000003');
select is(
  (select count(*)::int from public.ocupacoes where id = 't-oc'),
  1,
  'professor ve a agenda'
);
select throws_ok(
  $$ insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo)
     values ('t-oc2', '4', '2026-11-11', '10:00', '11:00', 'Individual') $$,
  '42501', null,
  'professor nao grava na agenda (so consulta)'
);
select is(
  (select count(*)::int from public.lancamentos),
  0,
  'professor nao ve o financeiro'
);
select is(
  (select count(*)::int from public.produtos),
  0,
  'professor nao ve o estoque'
);
-- Atualizacao barrada pela politica nao da erro: so nao muda nada.
update public.comentarios set texto = 'Alterado pelo professor' where id = 't-com';
reset role;
select is(
  (select texto from public.comentarios where id = 't-com'),
  'Comentário da recepção',
  'cada um edita so o proprio comentario'
);

-- --- Dono --------------------------------------------------------------------
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.lancamentos where id in ('t-receber', 't-pagar')),
  2,
  'dono ve contas a receber e a pagar'
);
select lives_ok(
  $$ update public.configuracoes set pontos_vitoria = 3 where id = 1 $$,
  'dono altera configuracoes'
);
select ok(
  (select count(*) > 0 from public.auditoria where tabela = 'ocupacoes' and registro_id = 't-oc'),
  'dono ve o historico de alteracoes'
);
reset role;

-- --- Auditoria ---------------------------------------------------------------
select is(
  (select usuario_nome || ' · ' || acao from public.auditoria
    where tabela = 'ocupacoes' and registro_id = 't-oc'),
  'Recepção Teste · criar',
  'a auditoria grava quem fez e o que fez'
);

select * from finish();
rollback;

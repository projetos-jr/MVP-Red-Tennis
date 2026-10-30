-- Funcoes de apoio das operacoes: permissao e nome da operacao na auditoria.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000002', 'recepcao@teste'),
  ('00000000-0000-0000-0000-000000000003', 'professor@teste');
insert into public.professores (id, nome, cor) values ('t-prof', 'Professor Teste', '#000000');
insert into public.colaboradores (id, nome, perfil, professor_id) values
  ('00000000-0000-0000-0000-000000000002', 'Recepção Teste', 'recepcao', null),
  ('00000000-0000-0000-0000-000000000003', 'Professor Teste', 'professor', 't-prof');

create function pg_temp.entrar_como(p_id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_id, true);
  set local role authenticated;
$$;

select is(privado.hoje(), (now() at time zone 'America/Sao_Paulo')::date, 'hoje e a data da arena');

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ select privado.iniciar_operacao('Cancelar aula', 'agenda') $$,
  '42501', 'Seu perfil não tem permissão para esta operação.',
  'professor nao inicia operacao que grava na agenda'
);
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select privado.iniciar_operacao('Bloquear quadra', 'agenda');
insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo, descricao)
values ('t-bl', '2', '2026-11-12', '08:00', '09:00', 'Bloqueio', 'Manutenção');
select throws_ok(
  $$ select privado.recusar('Esta aula já está cancelada.') $$,
  'P0001', 'Esta aula já está cancelada.',
  'recusar devolve a mensagem para a tela'
);
reset role;

select is(
  (select operacao from public.auditoria where tabela = 'ocupacoes' and registro_id = 't-bl'),
  'Bloquear quadra',
  'a auditoria grava o nome da operacao'
);

select * from finish();
rollback;

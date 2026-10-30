-- Estrutura: todas as tabelas com RLS e os dados fixos no lugar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'todas as tabelas de public tem RLS ligado'
);

select is(
  (select string_agg(id, ',' order by ordem) from public.quadras),
  '1,2,3,4,paredao',
  'as 5 areas da arena estao cadastradas'
);

select is(
  (select jsonb_array_length(siglas) from public.configuracoes where id = 1),
  5,
  'as 5 siglas de reposicao (H1) vem nas configuracoes'
);

select ok(
  (select permissoes -> 'professor' ? 'agenda' and not permissoes -> 'recepcao' ? 'configuracoes'
     from public.configuracoes where id = 1),
  'permissoes iniciais seguem a hipotese H9'
);

select * from finish();
rollback;

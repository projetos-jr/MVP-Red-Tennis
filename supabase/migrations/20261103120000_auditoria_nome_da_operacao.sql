-- ============================================================================
--  Historico: nome da operacao tambem nas gravacoes diretas nas tabelas
-- ============================================================================
--  As funcoes do banco gravam o nome da operacao ("Cancelar aula") no
--  historico com `privado.iniciar_operacao`. Os cadastros simples a tela grava
--  direto na tabela (ex.: "Cadastrar aluno"); para esses, o nome vem no
--  cabecalho `x-operacao` da requisicao, como texto JSON (ex.: "Cadastrar aluno"
--  com aspas, acentos escritos como ç).
--
--  O cabecalho e so descritivo: quem fez (usuario) continua vindo do login,
--  que ninguem consegue falsificar.
-- ============================================================================

create or replace function privado.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text;
  v_operacao text := nullif(current_setting('app.operacao', true), '');
  v_cabecalho text;
begin
  if v_operacao is null then
    v_cabecalho := current_setting('request.headers', true)::json ->> 'x-operacao';
    if v_cabecalho is not null then
      begin
        v_operacao := left(nullif(v_cabecalho::json #>> '{}', ''), 120);
      exception when others then
        v_operacao := null;
      end;
    end if;
  end if;

  select nome into v_nome from public.colaboradores where id = (select auth.uid());

  if tg_op = 'DELETE' then
    insert into public.auditoria (usuario_nome, tabela, registro_id, acao, antes, operacao)
    values (v_nome, tg_table_name, to_jsonb(old) ->> 'id', 'apagar', to_jsonb(old), v_operacao);
    return old;
  end if;

  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;

  insert into public.auditoria (usuario_nome, tabela, registro_id, acao, antes, depois, operacao)
  values (
    v_nome,
    tg_table_name,
    to_jsonb(new) ->> 'id',
    case tg_op when 'INSERT' then 'criar' else 'alterar' end,
    case tg_op when 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new),
    v_operacao
  );
  return new;
end;
$$;

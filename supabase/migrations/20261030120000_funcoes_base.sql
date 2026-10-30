-- ============================================================================
--  Funcoes de apoio para as operacoes da tela
-- ============================================================================
--  As operacoes que gravam em mais de uma tabela (cancelar aula gerando
--  creditos, lancar consumo, registrar pagamento...) viram funcoes do Postgres,
--  chamadas pela tela com `supabase.rpc(...)`. Tudo ou nada: se uma regra for
--  violada, nada e gravado.
--
--  Padrao de toda funcao de operacao (migracoes seguintes):
--   - `security invoker`: roda com as permissoes de quem chamou, entao a RLS
--     continua valendo; a funcao nunca faz mais do que a pessoa poderia fazer.
--   - Comeca com `privado.iniciar_operacao('Nome da tela', 'modulo')`: confere a
--     permissao (mensagem clara em vez de "nada aconteceu") e grava o nome da
--     operacao na auditoria.
--   - Regra violada: `privado.recusar('mensagem')`, com a mesma mensagem que o
--     front mostra hoje (src/lib/banco/operacoes/).
--   - "Hoje" e "agora" sempre no fuso da arena: `privado.hoje()`, `privado.agora()`.
-- ============================================================================

-- Data e hora no fuso da arena (America/Sao_Paulo), qualquer que seja o fuso
-- do servidor.
create function privado.agora()
returns timestamp
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo');
$$;

create function privado.hoje()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Recusa a operacao com uma mensagem para a tela. Nada e gravado.
-- Codigo P0001 (raise_exception): a tela mostra a mensagem como veio.
create function privado.recusar(mensagem text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = mensagem;
end;
$$;

-- Confere se quem chamou pode gravar no modulo e marca o nome da operacao na
-- auditoria desta transacao (coluna `auditoria.operacao`).
create function privado.iniciar_operacao(nome text, modulo text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not privado.pode_gravar(modulo) then
    raise exception using
      errcode = '42501',
      message = 'Seu perfil não tem permissão para esta operação.';
  end if;
  perform set_config('app.operacao', nome, true);
end;
$$;

revoke execute on function
  privado.agora(), privado.hoje(), privado.recusar(text), privado.iniciar_operacao(text, text)
  from public, anon;
grant execute on function
  privado.agora(), privado.hoje(), privado.recusar(text), privado.iniciar_operacao(text, text)
  to authenticated;

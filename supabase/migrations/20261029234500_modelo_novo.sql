-- ============================================================================
--  Modelo novo do banco da Red Tennis
-- ============================================================================
--  Substitui a estrutura inicial (que espelhava o MVP antigo) pelo modelo de
--  `docs/MODELO-E-TELAS.md`, o mesmo que o front usa em `src/lib/banco/tipos.ts`
--  (nomes de tabela e coluna em snake_case).
--
--  As tabelas antigas estavam vazias (o seed de demonstracao nunca foi
--  carregado), por isso podem ser apagadas aqui. As migracoes antigas nao sao
--  editadas: o historico continua valendo.
--
--  O que fica garantido pelo banco (e nao so pela tela):
--   - duas ocupacoes ativas nunca dividem a mesma quadra no mesmo horario
--     (exclusion constraint), bloqueios inclusive;
--   - o estoque nunca fica negativo;
--   - valores, datas e situacoes so aceitam o que faz sentido (CHECKs);
--   - RLS em todas as tabelas, por perfil (permissoes editaveis nas
--     Configuracoes, Hipotese H9);
--   - auditoria automatica de toda criacao, alteracao e exclusao.
--
--  As operacoes que gravam em mais de uma tabela (lancar consumo, cancelar
--  aula com creditos, registrar pagamento...) viram funcoes numa proxima
--  migracao.
-- ============================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Sai a estrutura antiga
-- ---------------------------------------------------------------------------
drop table if exists public.consumos cascade;
drop table if exists public.movimentos_estoque cascade;
drop table if exists public.produtos cascade;
drop table if exists public.torneios cascade;
drop table if exists public.pagamentos cascade;
drop table if exists public.comentarios cascade;
drop table if exists public.aulas cascade;
drop table if exists public.dias_sem_aula cascade;
drop table if exists public.horario_alunos cascade;
drop table if exists public.horarios cascade;
drop table if exists public.alunos cascade;
drop table if exists public.colaboradores cascade;
drop table if exists public.professores cascade;
drop table if exists public.quadras cascade;
drop function if exists public.lancar_consumo(text, text, text, integer);
drop function if exists public.aplicar_movimento_estoque();
drop function if exists privado.eh_colaborador();

create schema if not exists privado;
grant usage on schema privado to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Base: configuracoes, colaboradores, auditoria e comentarios
-- ---------------------------------------------------------------------------

-- Regras ajustaveis sem programar (tela de Configuracoes). Uma linha so.
create table public.configuracoes (
  id smallint primary key default 1 check (id = 1),
  siglas jsonb not null default '[]',
  validade_reposicao_meses smallint not null default 3 check (validade_reposicao_meses > 0),
  prazo_pagamento_reserva_horas smallint not null default 24 check (prazo_pagamento_reserva_horas > 0),
  liberar_reserva_automaticamente boolean not null default false,
  semanas_geradas_a_frente smallint not null default 12 check (semanas_geradas_a_frente between 1 and 52),
  bloquear_professor_em_duas_aulas boolean not null default false,
  pontos_vitoria smallint not null default 10 check (pontos_vitoria >= 0),
  pontos_derrota smallint not null default 2 check (pontos_derrota >= 0),
  torneio_conta_para_ranking boolean not null default false,
  classificados_por_grupo smallint not null default 2 check (classificados_por_grupo > 0),
  criterios_desempate jsonb not null default '[]',
  formas_pagamento jsonb not null default '[]',
  prazo_pagamento_consumo_dias smallint not null default 7 check (prazo_pagamento_consumo_dias >= 0),
  preco_locacao_hora numeric(10, 2) not null default 120 check (preco_locacao_hora >= 0),
  preco_paredao_hora numeric(10, 2) not null default 60 check (preco_paredao_hora >= 0),
  -- { "dono": ["painel", ...], "recepcao": [...], "professor": [...] }
  permissoes jsonb not null default '{}'
);

create table public.colaboradores (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  cargo text not null default '',
  perfil text not null check (perfil in ('dono', 'recepcao', 'professor')),
  professor_id text,
  ativo boolean not null default true
);

-- Perfil de quem esta logado (vazio se nao for colaborador ativo).
-- SECURITY DEFINER para ler `colaboradores` sem cair na propria politica.
create function privado.meu_perfil()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select perfil from public.colaboradores
  where id = (select auth.uid()) and ativo;
$$;

-- O perfil de quem esta logado enxerga o modulo? (Hipotese H9.)
create function privado.tem_acesso(modulo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (c.permissoes -> privado.meu_perfil()) ? modulo
       from public.configuracoes c where c.id = 1),
    false
  );
$$;

-- Logado e ativo em `colaboradores`.
create function privado.eh_colaborador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.meu_perfil() is not null;
$$;

-- Pode gravar no modulo: enxerga e nao e professor (H9: professor so consulta).
create function privado.pode_gravar(modulo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.tem_acesso(modulo) and privado.meu_perfil() <> 'professor';
$$;

revoke execute on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated;

-- Registro de toda criacao, alteracao e exclusao. Ninguem edita nem apaga.
create table public.auditoria (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  usuario_id uuid default auth.uid(),
  usuario_nome text,
  tabela text not null,
  registro_id text,
  acao text not null check (acao in ('criar', 'alterar', 'apagar')),
  antes jsonb,
  depois jsonb,
  -- Nome da operacao da tela ("Cancelar aula"), quando a funcao informar.
  operacao text
);

create function privado.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text;
  v_operacao text := nullif(current_setting('app.operacao', true), '');
begin
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

-- Comentario ligado a qualquer registro. Autor e data sao gravados sozinhos.
create table public.comentarios (
  id text primary key default gen_random_uuid()::text,
  entidade text not null check (entidade in
    ('aluno', 'professor', 'ocupacao', 'lancamento', 'produto', 'torneio', 'partida')),
  entidade_id text not null,
  texto text not null check (btrim(texto) <> ''),
  -- Vazio so em comentarios importados ou de quem saiu da equipe; o nome fica.
  autor_id uuid default auth.uid() references public.colaboradores (id) on delete set null,
  autor_nome text not null,
  criado_em timestamptz not null default now(),
  editado_em timestamptz
);
create index comentarios_registro_idx on public.comentarios (entidade, entidade_id);

-- ---------------------------------------------------------------------------
-- 3. Cadastros
-- ---------------------------------------------------------------------------
create table public.quadras (
  id text primary key check (id in ('1', '2', '3', '4', 'paredao')),
  nome text not null,
  piso text not null check (piso in ('saibro', 'cimento')),
  ordem smallint not null
);

create table public.professores (
  id text primary key default gen_random_uuid()::text,
  nome text not null check (btrim(nome) <> ''),
  cor text not null,
  especialidade text not null default '',
  telefone text,
  email text,
  repasse_modo text not null default 'por_hora' check (repasse_modo in ('por_hora', 'percentual')),
  repasse_valor numeric(10, 2) not null default 0 check (repasse_valor >= 0),
  ativo boolean not null default true,
  constraint professores_percentual_valido check (repasse_modo <> 'percentual' or repasse_valor <= 100)
);
create unique index professores_nome_unico on public.professores (lower(nome));

alter table public.colaboradores
  add constraint colaboradores_professor_fk
  foreign key (professor_id) references public.professores (id) on delete set null;
create index colaboradores_professor_idx on public.colaboradores (professor_id);

create table public.alunos (
  id text primary key default gen_random_uuid()::text,
  nome text not null check (btrim(nome) <> ''),
  foto_url text,
  telefone text not null default '',
  email text not null default '',
  data_nascimento date,
  professor_principal_id text references public.professores (id) on delete set null,
  -- false = saiu da arena. "Congelado" vem da tabela de congelamentos.
  ativo boolean not null default true,
  inscrito_ranking boolean not null default false,
  categoria_ranking text check (categoria_ranking in ('A', 'B', 'C', 'D')),
  criado_em timestamptz not null default now()
);
create index alunos_professor_idx on public.alunos (professor_principal_id);

-- Catalogo de planos (Hipotese H3: tabela nova e tabela antiga).
create table public.planos (
  id text primary key default gen_random_uuid()::text,
  nome text not null check (btrim(nome) <> ''),
  tipo text not null check (tipo in ('Individual', 'Dupla', 'LAP', 'Locação Mensal', 'Plano de locação')),
  valor_mensal numeric(10, 2) not null check (valor_mensal >= 0),
  aulas_por_semana smallint not null check (aulas_por_semana > 0),
  duracao_minutos smallint not null check (duracao_minutos > 0),
  tabela text not null check (tabela in ('nova', 'antiga')),
  ativo boolean not null default true
);

create table public.matriculas (
  id text primary key default gen_random_uuid()::text,
  aluno_id text not null references public.alunos (id) on delete cascade,
  plano_id text not null references public.planos (id),
  valor_mensal numeric(10, 2) not null check (valor_mensal > 0),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 28),
  inicio date not null,
  fim date,
  check (fim is null or fim >= inicio),
  -- Um aluno nunca tem duas matriculas vigentes ao mesmo tempo.
  exclude using gist (
    aluno_id with =,
    daterange(inicio, fim, '[]') with &&
  )
);
create index matriculas_plano_idx on public.matriculas (plano_id);

-- Periodo em que a matricula ficou parada (Hipotese H4).
create table public.congelamentos (
  id text primary key default gen_random_uuid()::text,
  matricula_id text not null references public.matriculas (id) on delete cascade,
  inicio date not null,
  fim_previsto date,
  fim_real date,
  motivo text not null check (btrim(motivo) <> ''),
  -- Aulas fixas suspensas, para voltarem na reativacao:
  -- [{ "ocupacaoId": "...", "acao": "cancelada" | "retirado" }]
  aulas_suspensas jsonb not null default '[]',
  check (fim_previsto is null or fim_previsto >= inicio),
  check (fim_real is null or fim_real >= inicio)
);
create index congelamentos_matricula_idx on public.congelamentos (matricula_id);

-- ---------------------------------------------------------------------------
-- 4. Agenda e reposicao
-- ---------------------------------------------------------------------------
create table public.horarios_fixos (
  id text primary key default gen_random_uuid()::text,
  quadra_id text not null references public.quadras (id),
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fim time not null,
  tipo text not null check (tipo in
    ('Individual', 'Locação Mensal', 'Dupla', 'LAP', 'Locação Avulsa', 'Ranking', 'Plano de locação', 'Bloqueio')),
  professor_id text references public.professores (id),
  inicio date not null,
  fim date,
  check (hora_fim > hora_inicio),
  check (hora_inicio >= '07:00' and hora_fim <= '22:00'),
  check (fim is null or fim >= inicio)
);
create index horarios_fixos_quadra_idx on public.horarios_fixos (quadra_id);
create index horarios_fixos_professor_idx on public.horarios_fixos (professor_id);

create table public.horario_alunos (
  id text primary key default gen_random_uuid()::text,
  horario_fixo_id text not null references public.horarios_fixos (id) on delete cascade,
  aluno_id text not null references public.alunos (id) on delete cascade,
  unique (horario_fixo_id, aluno_id)
);
create index horario_alunos_aluno_idx on public.horario_alunos (aluno_id);

-- Cada uso de uma quadra numa data: aula, locacao, ranking ou bloqueio.
-- Data e horas no fuso da arena (America/Sao_Paulo), como na tela.
create table public.ocupacoes (
  id text primary key default gen_random_uuid()::text,
  quadra_id text not null references public.quadras (id),
  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  tipo text not null check (tipo in
    ('Individual', 'Locação Mensal', 'Dupla', 'LAP', 'Locação Avulsa', 'Ranking', 'Plano de locação', 'Bloqueio')),
  professor_id text references public.professores (id),
  horario_fixo_id text references public.horarios_fixos (id) on delete set null,
  situacao text not null default 'agendada' check (situacao in
    ('agendada', 'aguardando_pagamento', 'realizada', 'cancelada')),
  motivo_cancelamento text,
  cancelada_em timestamptz,
  prazo_pagamento timestamptz,
  descricao text,
  criado_em timestamptz not null default now(),
  check (hora_fim > hora_inicio),
  check (hora_inicio >= '07:00' and hora_fim <= '22:00'),
  -- Cancelar exige motivo.
  check (situacao <> 'cancelada' or btrim(coalesce(motivo_cancelamento, '')) <> ''),
  -- A regra principal: duas ocupacoes ativas nunca dividem quadra e horario.
  -- Uma aula que termina as 11:00 nao conflita com outra que comeca as 11:00.
  constraint ocupacoes_sem_conflito exclude using gist (
    quadra_id with =,
    tsrange(data + hora_inicio, data + hora_fim) with &&
  ) where (situacao <> 'cancelada')
);
create index ocupacoes_data_idx on public.ocupacoes (data);
create index ocupacoes_professor_idx on public.ocupacoes (professor_id, data);
create index ocupacoes_horario_fixo_idx on public.ocupacoes (horario_fixo_id);

create table public.ocupacao_alunos (
  id text primary key default gen_random_uuid()::text,
  ocupacao_id text not null references public.ocupacoes (id) on delete cascade,
  aluno_id text not null references public.alunos (id) on delete cascade,
  presenca text not null default 'a_marcar' check (presenca in
    ('a_marcar', 'presente', 'falta', 'falta_avisada')),
  sigla text,
  unique (ocupacao_id, aluno_id)
);
create index ocupacao_alunos_aluno_idx on public.ocupacao_alunos (aluno_id);

-- Extrato de minutos de reposicao: credito (+, com validade) ou uso (-).
-- O saldo e sempre calculado, nunca guardado.
create table public.reposicoes (
  id text primary key default gen_random_uuid()::text,
  aluno_id text not null references public.alunos (id) on delete cascade,
  minutos integer not null check (minutos <> 0),
  sigla text,
  ocupacao_origem_id text references public.ocupacoes (id) on delete set null,
  ocupacao_uso_id text references public.ocupacoes (id) on delete set null,
  validade date,
  observacao text,
  criado_em timestamptz not null default now(),
  -- Todo credito tem validade; uso nao tem.
  check ((minutos > 0) = (validade is not null))
);
create index reposicoes_aluno_idx on public.reposicoes (aluno_id);
create index reposicoes_origem_idx on public.reposicoes (ocupacao_origem_id);
create index reposicoes_uso_idx on public.reposicoes (ocupacao_uso_id);

-- ---------------------------------------------------------------------------
-- 5. Estoque
-- ---------------------------------------------------------------------------
create table public.produtos (
  id text primary key default gen_random_uuid()::text,
  nome text not null check (btrim(nome) <> ''),
  categoria text not null check (categoria in ('Bebidas', 'Cervejas', 'Lanches', 'Acessórios')),
  unidade text not null check (btrim(unidade) <> ''),
  preco_custo numeric(10, 2) not null check (preco_custo >= 0),
  preco_venda numeric(10, 2) not null check (preco_venda >= 0),
  estoque_minimo integer not null default 0 check (estoque_minimo >= 0),
  ativo boolean not null default true
);
create unique index produtos_nome_unico on public.produtos (lower(nome));

create table public.consumos (
  id text primary key default gen_random_uuid()::text,
  pessoa_id text not null,
  pessoa_tipo text not null check (pessoa_tipo in ('aluno', 'professor')),
  data timestamptz not null default now(),
  produto_id text not null references public.produtos (id),
  -- Nome e preco do momento da venda: mudar o cadastro nao reescreve a conta.
  produto_nome text not null,
  quantidade integer not null check (quantidade > 0),
  valor_unitario numeric(10, 2) not null check (valor_unitario >= 0)
);
create index consumos_pessoa_idx on public.consumos (pessoa_id);
create index consumos_produto_idx on public.consumos (produto_id);

create table public.movimentos_estoque (
  id text primary key default gen_random_uuid()::text,
  produto_id text not null references public.produtos (id),
  data timestamptz not null default now(),
  tipo text not null check (tipo in ('entrada', 'venda', 'perda', 'ajuste')),
  -- Entrada, venda e perda: positiva. Ajuste: com sinal (diferenca da contagem).
  quantidade integer not null check (quantidade <> 0),
  responsavel text not null,
  observacao text,
  consumo_id text references public.consumos (id) on delete set null,
  check (tipo = 'ajuste' or quantidade > 0)
);
create index movimentos_produto_idx on public.movimentos_estoque (produto_id);
create index movimentos_consumo_idx on public.movimentos_estoque (consumo_id);

-- Saldo de cada produto = soma dos movimentos. Ninguem digita o saldo.
create view public.saldo_estoque
with (security_invoker = true) as
select
  p.id as produto_id,
  coalesce(sum(case m.tipo
    when 'entrada' then m.quantidade
    when 'ajuste' then m.quantidade
    else -m.quantidade
  end), 0)::integer as saldo
from public.produtos p
left join public.movimentos_estoque m on m.produto_id = p.id
group by p.id;

-- O estoque nunca fica negativo. Trava o produto para dois balcoes nao
-- venderem a ultima unidade ao mesmo tempo.
create function privado.garantir_saldo_de_estoque()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saldo integer;
  v_nome text;
  v_efeito integer := case new.tipo
    when 'entrada' then new.quantidade
    when 'ajuste' then new.quantidade
    else -new.quantidade
  end;
begin
  select nome into v_nome from public.produtos where id = new.produto_id for update;
  select coalesce(sum(case tipo
      when 'entrada' then quantidade
      when 'ajuste' then quantidade
      else -quantidade
    end), 0)
    into v_saldo
    from public.movimentos_estoque
   where produto_id = new.produto_id;

  if v_saldo + v_efeito < 0 then
    raise exception using
      errcode = 'check_violation',
      message = case when v_saldo = 0
        then format('%s está esgotado.', v_nome)
        else format('Só há %s unidade(s) de %s em estoque.', v_saldo, v_nome)
      end;
  end if;
  return new;
end;
$$;

create trigger movimentos_estoque_saldo
  before insert on public.movimentos_estoque
  for each row execute function privado.garantir_saldo_de_estoque();

-- ---------------------------------------------------------------------------
-- 6. Ranking e torneios
-- ---------------------------------------------------------------------------
create table public.torneios (
  id text primary key default gen_random_uuid()::text,
  nome text not null check (btrim(nome) <> ''),
  data date not null,
  formato text not null check (formato in ('eliminatoria', 'grupos_eliminatoria', 'todos_contra_todos')),
  categoria text check (categoria in ('A', 'B', 'C', 'D')),
  duplas boolean not null default false,
  situacao text not null default 'inscricoes' check (situacao in ('inscricoes', 'em_andamento', 'encerrado')),
  criado_em timestamptz not null default now()
);

create table public.torneio_inscritos (
  id text primary key default gen_random_uuid()::text,
  torneio_id text not null references public.torneios (id) on delete cascade,
  -- Um aluno (simples) ou dois (duplas).
  alunos_ids text[] not null check (cardinality(alunos_ids) between 1 and 2),
  cabeca_de_chave smallint check (cabeca_de_chave > 0),
  grupo text
);
create index torneio_inscritos_torneio_idx on public.torneio_inscritos (torneio_id);

create table public.partidas (
  id text primary key default gen_random_uuid()::text,
  data date,
  lado_a text[] not null default '{}',
  lado_b text[] not null default '{}',
  placar text,
  vencedor text check (vencedor in ('A', 'B')),
  wo boolean not null default false,
  ocupacao_id text references public.ocupacoes (id) on delete set null,
  torneio_id text references public.torneios (id) on delete cascade,
  inscricao_a_id text references public.torneio_inscritos (id) on delete set null,
  inscricao_b_id text references public.torneio_inscritos (id) on delete set null,
  fase text,
  rodada smallint,
  grupo text,
  ordem smallint,
  proxima_partida_id text references public.partidas (id) on delete set null,
  lado_na_proxima text check (lado_na_proxima in ('A', 'B')),
  criado_em timestamptz not null default now(),
  check (not wo or vencedor is not null)
);
create index partidas_torneio_idx on public.partidas (torneio_id);
create index partidas_ocupacao_idx on public.partidas (ocupacao_id);
create index partidas_proxima_idx on public.partidas (proxima_partida_id);

-- ---------------------------------------------------------------------------
-- 7. Financeiro
-- ---------------------------------------------------------------------------
create table public.repasses (
  id text primary key default gen_random_uuid()::text,
  professor_id text not null references public.professores (id),
  competencia text not null check (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  aulas_dadas integer not null check (aulas_dadas >= 0),
  minutos_dados integer not null check (minutos_dados >= 0),
  valor_previsto numeric(10, 2) not null check (valor_previsto >= 0),
  fechado_em timestamptz not null default now(),
  -- Cada mes de cada professor e fechado uma vez so.
  unique (professor_id, competencia)
);

-- Tudo o que entra ou sai. A situacao (pago, pendente, em atraso, anulado)
-- e calculada pelas datas na view `lancamentos_com_situacao`.
create table public.lancamentos (
  id text primary key default gen_random_uuid()::text,
  tipo text not null check (tipo in ('receber', 'pagar')),
  categoria text not null check (categoria in
    ('Mensalidade', 'Aula avulsa', 'Locação', 'Consumo', 'Torneio', 'Despesa', 'Fornecedor', 'Repasse', 'Outros')),
  pessoa_id text,
  pessoa_tipo text check (pessoa_tipo in ('aluno', 'professor')),
  nome_pagante text,
  item text not null check (btrim(item) <> ''),
  valor numeric(10, 2) not null check (valor > 0),
  vencimento date not null,
  pago_em date,
  forma_pagamento text,
  valor_convenio numeric(10, 2) check (valor_convenio >= 0),
  comprovante text,
  competencia text check (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  matricula_id text references public.matriculas (id) on delete set null,
  ocupacao_id text references public.ocupacoes (id) on delete set null,
  consumo_id text references public.consumos (id) on delete set null,
  torneio_id text references public.torneios (id) on delete set null,
  repasse_id text references public.repasses (id) on delete set null,
  movimento_estoque_id text references public.movimentos_estoque (id) on delete set null,
  cancelado_em timestamptz,
  motivo_cancelamento text,
  criado_em timestamptz not null default now(),
  -- Categorias de cada lado.
  check (
    (tipo = 'receber' and categoria in ('Mensalidade', 'Aula avulsa', 'Locação', 'Consumo', 'Torneio', 'Outros'))
    or (tipo = 'pagar' and categoria in ('Despesa', 'Fornecedor', 'Repasse', 'Outros'))
  ),
  check (pago_em is null or forma_pagamento is not null),
  check (valor_convenio is null or valor_convenio <= valor),
  -- Anular exige motivo (lancamento nunca se apaga).
  check (cancelado_em is null or btrim(coalesce(motivo_cancelamento, '')) <> '')
);
create index lancamentos_pessoa_idx on public.lancamentos (pessoa_id);
create index lancamentos_vencimento_idx on public.lancamentos (vencimento);
create index lancamentos_matricula_idx on public.lancamentos (matricula_id);
create index lancamentos_ocupacao_idx on public.lancamentos (ocupacao_id);
create index lancamentos_consumo_idx on public.lancamentos (consumo_id);
create index lancamentos_torneio_idx on public.lancamentos (torneio_id);
create index lancamentos_repasse_idx on public.lancamentos (repasse_id);
create index lancamentos_movimento_idx on public.lancamentos (movimento_estoque_id);
-- Uma mensalidade por matricula por mes (gerar de novo nao duplica).
create unique index lancamentos_mensalidade_unica
  on public.lancamentos (matricula_id, competencia)
  where categoria = 'Mensalidade';

create view public.lancamentos_com_situacao
with (security_invoker = true) as
select
  l.*,
  case
    when l.cancelado_em is not null then 'cancelado'
    when l.pago_em is not null then 'pago'
    when l.vencimento < (now() at time zone 'America/Sao_Paulo')::date then 'em_atraso'
    else 'pendente'
  end as situacao
from public.lancamentos l;

-- ---------------------------------------------------------------------------
-- 8. Auditoria em todas as tabelas de negocio
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'configuracoes', 'colaboradores', 'comentarios', 'quadras', 'professores',
    'alunos', 'planos', 'matriculas', 'congelamentos', 'horarios_fixos',
    'horario_alunos', 'ocupacoes', 'ocupacao_alunos', 'reposicoes', 'produtos',
    'consumos', 'movimentos_estoque', 'torneios', 'torneio_inscritos', 'partidas',
    'repasses', 'lancamentos'
  ] loop
    execute format(
      'create trigger auditar after insert or update or delete on public.%I
         for each row execute function privado.registrar_auditoria()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Seguranca: RLS em todas as tabelas, por perfil (Hipotese H9)
-- ---------------------------------------------------------------------------
--  Leitura: quem enxerga o modulo. Gravacao: quem enxerga e nao e professor.
--  Nada para anonimos. As permissoes de cada perfil sao editaveis nas
--  Configuracoes (coluna `permissoes`).

do $$
declare
  t text;
begin
  foreach t in array array[
    'configuracoes', 'colaboradores', 'auditoria', 'comentarios', 'quadras',
    'professores', 'alunos', 'planos', 'matriculas', 'congelamentos',
    'horarios_fixos', 'horario_alunos', 'ocupacoes', 'ocupacao_alunos',
    'reposicoes', 'produtos', 'consumos', 'movimentos_estoque', 'torneios',
    'torneio_inscritos', 'partidas', 'repasses', 'lancamentos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- Base
create policy "colaboradores leem as configuracoes" on public.configuracoes
  for select to authenticated using (privado.eh_colaborador());
create policy "dono altera as configuracoes" on public.configuracoes
  for update to authenticated
  using (privado.tem_acesso('configuracoes'))
  with check (privado.tem_acesso('configuracoes'));

-- Colaboradores sao cadastrados pelo painel do Supabase (ou por SQL).
create policy "colaboradores leem a equipe" on public.colaboradores
  for select to authenticated using (privado.eh_colaborador());

-- Ninguem grava na auditoria pela API: so o gatilho. Ninguem edita nem apaga.
create policy "historico para quem pode ver" on public.auditoria
  for select to authenticated using (privado.tem_acesso('historico'));

create policy "colaboradores leem comentarios" on public.comentarios
  for select to authenticated using (privado.eh_colaborador());
create policy "colaborador comenta em nome proprio" on public.comentarios
  for insert to authenticated
  with check (privado.eh_colaborador() and autor_id = (select auth.uid()));
create policy "cada um edita o proprio comentario" on public.comentarios
  for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));
create policy "cada um apaga o proprio comentario" on public.comentarios
  for delete to authenticated using (autor_id = (select auth.uid()));

-- Cadastros
create policy "colaboradores leem as quadras" on public.quadras
  for select to authenticated using (privado.eh_colaborador());

create policy "colaboradores leem os professores" on public.professores
  for select to authenticated using (privado.eh_colaborador());
create policy "dono cadastra professores" on public.professores
  for all to authenticated
  using (privado.meu_perfil() = 'dono')
  with check (privado.meu_perfil() = 'dono');

create policy "colaboradores leem os planos" on public.planos
  for select to authenticated using (privado.eh_colaborador());
create policy "dono mantem os planos" on public.planos
  for all to authenticated
  using (privado.tem_acesso('configuracoes'))
  with check (privado.tem_acesso('configuracoes'));

-- Alunos, matriculas e congelamentos: modulo "alunos" (a agenda tambem le).
do $$
declare
  t text;
begin
  foreach t in array array['alunos', 'matriculas', 'congelamentos'] loop
    execute format(
      'create policy "leitura" on public.%I for select to authenticated
         using (privado.tem_acesso(''alunos'') or privado.tem_acesso(''agenda''))', t);
    execute format(
      'create policy "gravacao" on public.%I for all to authenticated
         using (privado.pode_gravar(''alunos''))
         with check (privado.pode_gravar(''alunos''))', t);
  end loop;
end;
$$;

-- Agenda e reposicao: modulo "agenda" (a ficha do aluno tambem le).
do $$
declare
  t text;
begin
  foreach t in array array[
    'horarios_fixos', 'horario_alunos', 'ocupacoes', 'ocupacao_alunos', 'reposicoes'
  ] loop
    execute format(
      'create policy "leitura" on public.%I for select to authenticated
         using (privado.tem_acesso(''agenda'') or privado.tem_acesso(''alunos''))', t);
    execute format(
      'create policy "gravacao" on public.%I for all to authenticated
         using (privado.pode_gravar(''agenda''))
         with check (privado.pode_gravar(''agenda''))', t);
  end loop;
end;
$$;

-- Estoque e consumo: modulo "estoque". A ficha do aluno mostra o consumo,
-- mas so para quem grava em alunos (o professor nao ve valores).
do $$
declare
  t text;
begin
  foreach t in array array['produtos', 'consumos', 'movimentos_estoque'] loop
    execute format(
      'create policy "leitura" on public.%I for select to authenticated
         using (privado.tem_acesso(''estoque'') or privado.pode_gravar(''alunos''))', t);
    execute format(
      'create policy "gravacao" on public.%I for all to authenticated
         using (privado.pode_gravar(''estoque''))
         with check (privado.pode_gravar(''estoque''))', t);
  end loop;
end;
$$;

-- Ranking e torneios: modulo "ranking".
do $$
declare
  t text;
begin
  foreach t in array array['torneios', 'torneio_inscritos', 'partidas'] loop
    execute format(
      'create policy "leitura" on public.%I for select to authenticated
         using (privado.eh_colaborador())', t);
    execute format(
      'create policy "gravacao" on public.%I for all to authenticated
         using (privado.pode_gravar(''ranking''))
         with check (privado.pode_gravar(''ranking''))', t);
  end loop;
end;
$$;

-- Financeiro: a receber com o modulo "financeiro"; a pagar e repasses com
-- "financeiro_pagar" (a recepcao nao ve contas a pagar). A ficha do aluno
-- mostra os pagamentos, mas so para quem grava em alunos (o professor nao
-- ve valores).
create policy "leitura por tipo" on public.lancamentos
  for select to authenticated
  using (
    case tipo
      when 'receber' then privado.tem_acesso('financeiro') or privado.pode_gravar('alunos')
      else privado.tem_acesso('financeiro_pagar')
    end
  );
create policy "gravacao por tipo" on public.lancamentos
  for all to authenticated
  using (
    case tipo
      when 'receber' then privado.pode_gravar('financeiro')
      else privado.pode_gravar('financeiro_pagar')
    end
  )
  with check (
    case tipo
      when 'receber' then privado.pode_gravar('financeiro')
      else privado.pode_gravar('financeiro_pagar')
    end
  );

create policy "leitura" on public.repasses
  for select to authenticated using (privado.tem_acesso('financeiro_pagar'));
create policy "gravacao" on public.repasses
  for all to authenticated
  using (privado.pode_gravar('financeiro_pagar'))
  with check (privado.pode_gravar('financeiro_pagar'));

-- ---------------------------------------------------------------------------
-- 10. Dados fixos: quadras e configuracoes iniciais (hipoteses H1-H14)
-- ---------------------------------------------------------------------------
insert into public.quadras (id, nome, piso, ordem) values
  ('1', 'Quadra 1', 'cimento', 1),
  ('2', 'Quadra 2', 'saibro', 2),
  ('3', 'Quadra 3', 'saibro', 3),
  ('4', 'Quadra 4', 'saibro', 4),
  ('paredao', 'Paredão', 'saibro', 5);

insert into public.configuracoes (
  id, siglas, criterios_desempate, formas_pagamento, permissoes
) values (
  1,
  '[
    {"codigo": "CH", "nome": "Chuva", "descricao": "Aula cancelada por chuva.", "geraCredito": true, "aplicaA": "ocupacao"},
    {"codigo": "24h", "nome": "Aviso prévio de 24h", "descricao": "Aluno avisou com no mínimo 24 horas de antecedência.", "geraCredito": true, "aplicaA": "aluno"},
    {"codigo": "FP", "nome": "Falta do professor", "descricao": "Ausência do professor.", "geraCredito": true, "aplicaA": "ocupacao"},
    {"codigo": "IAC", "nome": "Interesse da academia", "descricao": "Remanejamento por evento, manutenção ou torneio.", "geraCredito": true, "aplicaA": "ocupacao"},
    {"codigo": "TIP", "nome": "Transferência por interesse do professor", "descricao": "Troca de horário pedida pelo professor.", "geraCredito": true, "aplicaA": "ambos"}
  ]',
  '["Vitórias", "Confronto direto", "Saldo de sets", "Saldo de games"]',
  '["Stone", "Bradesco", "Total Pass", "Dinheiro"]',
  '{
    "dono": ["painel", "agenda", "alunos", "professores", "financeiro", "financeiro_pagar", "estoque", "ranking", "configuracoes", "historico"],
    "recepcao": ["painel", "agenda", "alunos", "professores", "financeiro", "estoque", "ranking"],
    "professor": ["agenda", "alunos"]
  }'
);

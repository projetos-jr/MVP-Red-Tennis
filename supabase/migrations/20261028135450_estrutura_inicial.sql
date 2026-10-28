-- ============================================================================
--  Estrutura inicial do banco da Red Tennis
-- ============================================================================
--  Espelha o contrato de dados de `src/lib/types.ts`.
--
--  Seguranca: RLS ligado em todas as tabelas. Só quem está cadastrado e ativo
--  em `colaboradores` (e logado pelo Supabase Auth) lê e escreve. Usuarios
--  anonimos nao enxergam nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Colaboradores (quem acessa o sistema)
-- ---------------------------------------------------------------------------
create table public.colaboradores (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  cargo text not null,
  perfil text not null check (perfil in ('diretor', 'operacao', 'professor')),
  professor_id text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Usada pelas politicas de todas as tabelas. SECURITY DEFINER para poder ler
-- `colaboradores` sem cair na propria politica da tabela.
create function public.eh_colaborador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.colaboradores
    where id = (select auth.uid()) and ativo
  );
$$;

revoke execute on function public.eh_colaborador() from public, anon;
grant execute on function public.eh_colaborador() to authenticated;

-- ---------------------------------------------------------------------------
-- Cadastros
-- ---------------------------------------------------------------------------
create table public.quadras (
  id text primary key,
  nome text not null,
  piso text not null check (piso in ('saibro', 'cimento')),
  ordem smallint not null
);

create table public.professores (
  id text primary key default gen_random_uuid()::text,
  nome text not null unique,
  cor text not null,
  especialidade text not null default '',
  valor_hora_aula numeric(10, 2) not null default 0,
  ativo boolean not null default true
);

alter table public.colaboradores
  add constraint colaboradores_professor_fk
  foreign key (professor_id) references public.professores (id) on delete set null;

create table public.alunos (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  avatar_url text,
  telefone text not null default '',
  email text not null default '',
  plano text not null check (plano in ('Individual', 'Dupla', 'Locação Mensal', 'Locação Avulsa', 'LAP')),
  mensalidade numeric(10, 2) not null default 0,
  data_inicio date not null default current_date,
  professor_principal_id text references public.professores (id) on delete set null,
  saldo_minutos_reposicao integer not null default 0 check (saldo_minutos_reposicao >= 0),
  validade_reposicao date,
  plano_congelado boolean not null default false,
  motivo_congelamento text,
  inscrito_ranking boolean not null default false,
  ranking_pontuacao integer not null default 0,
  categoria_ranking text not null default 'D' check (categoria_ranking in ('A', 'B', 'C', 'D')),
  variacao_ranking integer not null default 0,
  criado_em timestamptz not null default now()
);

create index alunos_professor_idx on public.alunos (professor_principal_id);

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------
create table public.horarios (
  id text primary key default gen_random_uuid()::text,
  quadra_id text not null references public.quadras (id),
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fim time not null,
  tipo text not null check (tipo in ('Individual', 'Locação Mensal', 'Dupla', 'LAP', 'Locação Avulsa', 'Ranking', 'Plano de locação')),
  professor_id text references public.professores (id) on delete set null,
  criado_em timestamptz not null default now(),
  check (hora_fim > hora_inicio)
);

create index horarios_quadra_dia_idx on public.horarios (quadra_id, dia_semana);
create index horarios_professor_idx on public.horarios (professor_id);

create table public.horario_alunos (
  horario_id text not null references public.horarios (id) on delete cascade,
  aluno_id text not null references public.alunos (id) on delete cascade,
  ordem smallint not null default 0,
  primary key (horario_id, aluno_id)
);

create index horario_alunos_aluno_idx on public.horario_alunos (aluno_id);

-- Dias em que a operacao inteira foi cancelada (chuva, feriado).
create table public.dias_sem_aula (
  data date primary key,
  motivo text not null default 'CH'
);

create table public.aulas (
  id text primary key default gen_random_uuid()::text,
  aluno_id text not null references public.alunos (id) on delete cascade,
  data date not null,
  quadra_id text not null references public.quadras (id),
  professor_id text references public.professores (id) on delete set null,
  horario time not null,
  status text not null check (status in ('realizada', 'falta', 'reagendada')),
  motivo_falta text check (motivo_falta in ('CH', 'aviso_24h', 'falta_professor', 'IAC', 'TIP')),
  minutos_repostos integer
);

create index aulas_aluno_data_idx on public.aulas (aluno_id, data desc);
create index aulas_professor_idx on public.aulas (professor_id);

-- ---------------------------------------------------------------------------
-- Ficha do aluno
-- ---------------------------------------------------------------------------
create table public.comentarios (
  id text primary key default gen_random_uuid()::text,
  aluno_id text not null references public.alunos (id) on delete cascade,
  criado_em timestamptz not null default now(),
  autor text not null,
  autor_id uuid default auth.uid() references auth.users (id) on delete set null,
  texto text not null check (length(trim(texto)) > 0)
);

create index comentarios_aluno_idx on public.comentarios (aluno_id, criado_em desc);
create index comentarios_autor_idx on public.comentarios (autor_id);

-- ---------------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------------
create table public.pagamentos (
  id text primary key default gen_random_uuid()::text,
  aluno_id text not null references public.alunos (id) on delete restrict,
  data date not null,
  -- Prazo acordado para o dinheiro entrar. Os dias de atraso sao calculados
  -- a partir dele, para nao ficarem desatualizados no banco.
  data_limite date not null,
  data_compensacao date not null,
  nome_pagante text not null,
  item text not null,
  valor numeric(10, 2) not null check (valor >= 0),
  forma_pagamento text not null check (forma_pagamento in ('Stone', 'Bradesco', 'Total Pass', 'Dinheiro')),
  status text not null check (status in ('confirmado', 'pendente')),
  valor_total_pass numeric(10, 2),
  participantes_confirmados boolean not null default false
);

create index pagamentos_aluno_idx on public.pagamentos (aluno_id);
create index pagamentos_data_idx on public.pagamentos (data);

-- ---------------------------------------------------------------------------
-- Ranking
-- ---------------------------------------------------------------------------
create table public.torneios (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  data date not null,
  formato text not null default '',
  inscritos integer not null default 0,
  status text not null check (status in ('inscrições abertas', 'em andamento', 'encerrado'))
);

-- ---------------------------------------------------------------------------
-- Estoque e consumo
-- ---------------------------------------------------------------------------
create table public.produtos (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  categoria text not null check (categoria in ('Bebidas', 'Cervejas', 'Lanches', 'Acessórios')),
  unidade text not null,
  preco_custo numeric(10, 2) not null default 0,
  preco_venda numeric(10, 2) not null default 0,
  quantidade integer not null default 0 check (quantidade >= 0),
  estoque_minimo integer not null default 0,
  ultima_entrada date
);

create table public.movimentos_estoque (
  id text primary key default gen_random_uuid()::text,
  produto_id text not null references public.produtos (id) on delete cascade,
  criado_em timestamptz not null default now(),
  tipo text not null check (tipo in ('entrada', 'venda', 'perda', 'ajuste')),
  quantidade integer not null check (quantidade > 0),
  responsavel text not null,
  observacao text
);

create index movimentos_produto_idx on public.movimentos_estoque (produto_id, criado_em desc);

create table public.consumos (
  id text primary key default gen_random_uuid()::text,
  aluno_id text references public.alunos (id) on delete restrict,
  professor_id text references public.professores (id) on delete restrict,
  criado_em timestamptz not null default now(),
  produto_id text references public.produtos (id) on delete set null,
  produto_nome text not null,
  quantidade integer not null check (quantidade > 0),
  valor_unitario numeric(10, 2) not null,
  status text not null default 'em aberto' check (status in ('em aberto', 'pago')),
  -- O consumo e lancado na conta de um aluno OU de um professor.
  check ((aluno_id is null) <> (professor_id is null))
);

create index consumos_aluno_idx on public.consumos (aluno_id);
create index consumos_professor_idx on public.consumos (professor_id);
create index consumos_produto_idx on public.consumos (produto_id);

-- Mantem o saldo do produto em dia a cada movimento. `ajuste` fica de fora
-- porque a quantidade e sempre positiva e o sentido depende do caso.
create function public.aplicar_movimento_estoque()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo = 'entrada' then
    update public.produtos
      set quantidade = quantidade + new.quantidade,
          ultima_entrada = (new.criado_em at time zone 'America/Sao_Paulo')::date
      where id = new.produto_id;
  elsif new.tipo in ('venda', 'perda') then
    update public.produtos
      set quantidade = greatest(0, quantidade - new.quantidade)
      where id = new.produto_id;
  end if;
  return new;
end;
$$;

create trigger movimentos_estoque_aplicar
  after insert on public.movimentos_estoque
  for each row execute function public.aplicar_movimento_estoque();

-- Lanca o consumo na ficha e da baixa no estoque na mesma transacao.
create function public.lancar_consumo(
  p_aluno_id text,
  p_professor_id text,
  p_produto_id text,
  p_quantidade integer
)
returns public.consumos
language plpgsql
set search_path = ''
as $$
declare
  v_produto public.produtos;
  v_responsavel text;
  v_consumo public.consumos;
begin
  select * into v_produto from public.produtos where id = p_produto_id;
  if not found then
    raise exception 'Produto % não encontrado', p_produto_id;
  end if;

  select nome into v_responsavel from public.colaboradores where id = (select auth.uid());

  insert into public.consumos (aluno_id, professor_id, produto_id, produto_nome, quantidade, valor_unitario)
    values (p_aluno_id, p_professor_id, p_produto_id, v_produto.nome, p_quantidade, v_produto.preco_venda)
    returning * into v_consumo;

  insert into public.movimentos_estoque (produto_id, tipo, quantidade, responsavel, observacao)
    values (p_produto_id, 'venda', p_quantidade, coalesce(v_responsavel, 'Sistema'), 'Consumo lançado na ficha');

  return v_consumo;
end;
$$;

revoke execute on function public.lancar_consumo(text, text, text, integer) from public, anon;
grant execute on function public.lancar_consumo(text, text, text, integer) to authenticated;
revoke execute on function public.aplicar_movimento_estoque() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.colaboradores enable row level security;
alter table public.quadras enable row level security;
alter table public.professores enable row level security;
alter table public.alunos enable row level security;
alter table public.horarios enable row level security;
alter table public.horario_alunos enable row level security;
alter table public.dias_sem_aula enable row level security;
alter table public.aulas enable row level security;
alter table public.comentarios enable row level security;
alter table public.pagamentos enable row level security;
alter table public.torneios enable row level security;
alter table public.produtos enable row level security;
alter table public.movimentos_estoque enable row level security;
alter table public.consumos enable row level security;

-- Colaboradores: cada um enxerga a equipe; o cadastro e feito pelo painel.
create policy "colaboradores leem a equipe" on public.colaboradores
  for select to authenticated using ((select public.eh_colaborador()));

-- Demais tabelas: acesso completo para colaboradores ativos.
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'quadras', 'professores', 'alunos', 'horarios', 'horario_alunos',
    'dias_sem_aula', 'aulas', 'comentarios', 'pagamentos', 'torneios',
    'produtos', 'movimentos_estoque', 'consumos'
  ] loop
    execute format(
      'create policy "colaboradores acessam" on public.%I for all to authenticated
         using ((select public.eh_colaborador()))
         with check ((select public.eh_colaborador()))',
      tabela
    );
  end loop;
end;
$$;

-- Nada para usuarios anonimos.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Dados fixos da arena
-- ---------------------------------------------------------------------------
insert into public.quadras (id, nome, piso, ordem) values
  ('1', 'Quadra 1', 'cimento', 1),
  ('2', 'Quadra 2', 'saibro', 2),
  ('3', 'Quadra 3', 'saibro', 3),
  ('4', 'Quadra 4', 'saibro', 4),
  ('paredao', 'Paredão', 'saibro', 5);

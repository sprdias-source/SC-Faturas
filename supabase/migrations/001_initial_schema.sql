-- Confere — schema inicial
-- Cole este arquivo inteiro no SQL Editor do seu projeto Supabase e rode.
-- Modelo: "household" = a fatura/orçamento compartilhado entre os 2 usuários.
-- Cada linha das tabelas abaixo pertence a um household; RLS garante que só
-- quem é membro daquele household consegue ler ou escrever nelas.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- households & membros
-- ---------------------------------------------------------------------
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nossa fatura',
  invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 6),
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_color text not null default '#2d3f6b',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create or replace function is_household_member(target_household uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = target_household and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- contas (com hierarquia pai/filho via parent_id)
-- ---------------------------------------------------------------------
create table accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  type text not null check (type in ('despesa', 'receita')),
  parent_id uuid references accounts(id) on delete set null,
  color text not null default '#2d3f6b',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- importações (arquivo de fatura/extrato)
-- ---------------------------------------------------------------------
create table imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  filename text not null,
  file_type text not null check (file_type in ('pdf', 'ofx')),
  card_or_bank_label text,
  due_date date,
  total_amount numeric(12,2),
  entries_count integer not null default 0,
  imported_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- lançamentos (previstos/manuais E importados vivem na mesma tabela;
-- "matched_entry_id" liga um previsto ao lançamento importado que bateu
-- com ele por data+valor)
-- ---------------------------------------------------------------------
create table entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  kind text not null check (kind in ('previsto', 'importado')),
  date date not null,
  description text not null,
  amount numeric(12,2) not null,
  type text not null check (type in ('despesa', 'receita')),
  status text not null default 'pendente' check (status in ('pendente', 'classificado', 'confirmado')),
  source_import_id uuid references imports(id) on delete set null,
  matched_entry_id uuid references entries(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index entries_household_date_idx on entries (household_id, date desc);
create index entries_matched_idx on entries (matched_entry_id);

-- rateio: cada lançamento pode ter 1+ linhas de divisão entre contas
create table entry_splits (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  account_id uuid not null references accounts(id),
  percent numeric(5,2) not null,
  amount numeric(12,2) not null
);
create index entry_splits_entry_idx on entry_splits (entry_id);

-- ---------------------------------------------------------------------
-- configuração de notificação por usuário (visual / som / só novos)
-- ---------------------------------------------------------------------
create table notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  notify_visual boolean not null default true,
  notify_sound boolean not null default false,
  notify_only_new boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- feed de atividade (o que cada um fez, pra tela de Resumo)
-- ---------------------------------------------------------------------
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index activity_log_household_idx on activity_log (household_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS: só membro do household enxerga/mexe nos dados daquele household
-- ---------------------------------------------------------------------
alter table households enable row level security;
alter table household_members enable row level security;
alter table accounts enable row level security;
alter table imports enable row level security;
alter table entries enable row level security;
alter table entry_splits enable row level security;
alter table notification_settings enable row level security;
alter table activity_log enable row level security;

create policy "membro vê seu household" on households
  for select using (is_household_member(id));
create policy "usuário autenticado pode criar um household" on households
  for insert with check (auth.uid() is not null);

create policy "membro vê membros do household" on household_members
  for select using (is_household_member(household_id));
create policy "usuário entra num household com convite" on household_members
  for insert with check (user_id = auth.uid());

create policy "crud contas do household" on accounts
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "crud imports do household" on imports
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "crud entries do household" on entries
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "crud splits do household" on entry_splits
  for all using (is_household_member((select household_id from entries where id = entry_id)))
  with check (is_household_member((select household_id from entries where id = entry_id)));

create policy "usuário vê e edita suas próprias configs" on notification_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "membro vê atividade do household" on activity_log
  for select using (is_household_member(household_id));
create policy "membro registra atividade do household" on activity_log
  for insert with check (is_household_member(household_id) and user_id = auth.uid());

-- ---------------------------------------------------------------------
-- entrar num household existente a partir do código de convite (6 chars)
-- security definer: o usuário não precisa enxergar a tabela households
-- pra achar o id, só sabe o código que o outro membro compartilhou.
-- ---------------------------------------------------------------------
create or replace function join_household(p_code text, p_display_name text, p_avatar_color text default '#2d3f6b')
returns uuid
language plpgsql
security definer
as $$
declare
  target_id uuid;
begin
  select id into target_id from households where invite_code = lower(p_code);
  if target_id is null then
    raise exception 'Código de convite inválido';
  end if;

  insert into household_members (household_id, user_id, display_name, avatar_color)
  values (target_id, auth.uid(), p_display_name, p_avatar_color)
  on conflict (household_id, user_id) do update set display_name = excluded.display_name;

  return target_id;
end;
$$;

-- ---------------------------------------------------------------------
-- realtime: habilita as tabelas que a tela precisa ouvir ao vivo
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table accounts;
alter publication supabase_realtime add table entries;
alter publication supabase_realtime add table entry_splits;
alter publication supabase_realtime add table activity_log;

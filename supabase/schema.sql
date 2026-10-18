-- My Chill World · online worlds (stage 1: accounts, worlds, joining by code, town summaries)
-- Run this once in Supabase → SQL Editor → New query → Run. It is safe to run again.

-- ---------- tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Mayor',
  created_at timestamptz not null default now()
);

create table if not exists public.worlds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  host uuid not null references auth.users (id) on delete cascade,
  seed bigint not null,
  max_players int not null default 6,
  -- real seconds in one game day: the same clock for everyone, no speeding up
  day_seconds int not null default 1200,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.world_members (
  world_id uuid not null references public.worlds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  city_name text not null,
  slot int not null,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  -- what the others see of this town: people, money, happiness… (written by its player)
  summary jsonb not null default '{}'::jsonb,
  primary key (world_id, user_id),
  unique (world_id, slot)
);

alter table public.profiles enable row level security;
alter table public.worlds enable row level security;
alter table public.world_members enable row level security;

-- ---------- helpers ----------
create or replace function public.is_member(w uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.world_members m where m.world_id = w and m.user_id = auth.uid());
$$;

-- ---------- policies ----------
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated using (true);
drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "worlds of my own" on public.worlds;
create policy "worlds of my own" on public.worlds for select to authenticated using (host = auth.uid() or public.is_member(id));

drop policy if exists "members of my worlds" on public.world_members;
create policy "members of my worlds" on public.world_members for select to authenticated using (public.is_member(world_id));
drop policy if exists "my own town row" on public.world_members;
create policy "my own town row" on public.world_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- worlds and members are created only through the functions below (they check the rules)

-- ---------- functions ----------
create or replace function public.create_world(p_name text, p_city text)
returns public.worlds
language plpgsql security definer set search_path = public as $$
declare
  w public.worlds;
  c text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if (select count(*) from public.worlds where host = auth.uid()) >= 3 then raise exception 'You can host at most 3 worlds'; end if;
  loop
    c := upper(translate(substr(md5(random()::text || clock_timestamp()::text), 1, 6), '01', 'GH'));
    exit when not exists (select 1 from public.worlds where code = c);
  end loop;
  insert into public.worlds (code, name, host, seed)
  values (c, left(coalesce(nullif(trim(p_name), ''), 'Online world'), 40), auth.uid(), floor(random() * 1000000000)::bigint)
  returning * into w;
  insert into public.world_members (world_id, user_id, city_name, slot)
  values (w.id, auth.uid(), left(coalesce(nullif(trim(p_city), ''), 'My town'), 30), 0);
  return w;
end $$;

create or replace function public.join_world(p_code text, p_city text)
returns public.worlds
language plpgsql security definer set search_path = public as $$
declare
  w public.worlds;
  s int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into w from public.worlds where code = upper(trim(p_code));
  if w.id is null then raise exception 'No world with this code'; end if;
  if exists (select 1 from public.world_members where world_id = w.id and user_id = auth.uid()) then return w; end if;
  if (select count(*) from public.world_members where world_id = w.id) >= w.max_players then raise exception 'This world is full'; end if;
  select min(g) into s from generate_series(0, w.max_players - 1) g
   where not exists (select 1 from public.world_members m where m.world_id = w.id and m.slot = g);
  insert into public.world_members (world_id, user_id, city_name, slot)
  values (w.id, auth.uid(), left(coalesce(nullif(trim(p_city), ''), 'My town'), 30), s);
  return w;
end $$;

create or replace function public.leave_world(p_world uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.world_members where world_id = p_world and user_id = auth.uid();
  -- the last one out closes the world
  delete from public.worlds w where w.id = p_world and not exists (select 1 from public.world_members m where m.world_id = w.id);
end $$;

grant execute on function public.create_world(text, text) to authenticated;
grant execute on function public.join_world(text, text) to authenticated;
grant execute on function public.leave_world(uuid) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;

-- live updates of the towns in a world (used from stage 2)
do $$ begin
  alter publication supabase_realtime add table public.world_members;
exception when duplicate_object then null; end $$;

-- =====================================================================
-- Stage 2–6: deals between players (gifts, sales, investments) and the chat
-- =====================================================================
create table if not exists public.offers (
  id bigint generated always as identity primary key,
  world_id uuid not null references public.worlds (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  -- gift: goods or money given; sell: goods for money; invest: money now, paid back with interest; repay: a part paid back
  kind text not null check (kind in ('gift', 'sell', 'invest', 'repay')),
  good text not null default 'money',
  amount int not null check (amount > 0),
  price int not null default 0,
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'done', 'cancelled')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offers_to on public.offers (to_user, status);
create index if not exists offers_from on public.offers (from_user, status);

create table if not exists public.chat (
  id bigint generated always as identity primary key,
  world_id uuid not null references public.worlds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  text text not null check (char_length(text) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists chat_world on public.chat (world_id, id desc);

alter table public.offers enable row level security;
alter table public.chat enable row level security;

drop policy if exists "my offers" on public.offers;
create policy "my offers" on public.offers for select to authenticated using (from_user = auth.uid() or to_user = auth.uid());
drop policy if exists "send offers" on public.offers;
create policy "send offers" on public.offers for insert to authenticated
  with check (from_user = auth.uid() and from_user <> to_user and public.is_member(world_id)
    and exists (select 1 from public.world_members m where m.world_id = offers.world_id and m.user_id = offers.to_user));
drop policy if exists "answer offers" on public.offers;
create policy "answer offers" on public.offers for update to authenticated using (from_user = auth.uid() or to_user = auth.uid());

drop policy if exists "read chat" on public.chat;
create policy "read chat" on public.chat for select to authenticated using (public.is_member(world_id));
drop policy if exists "write chat" on public.chat;
create policy "write chat" on public.chat for insert to authenticated with check (user_id = auth.uid() and public.is_member(world_id));

-- the chat cleans itself: messages older than 24 hours go, and at most the last 200 of a world are kept;
-- finished deals older than 7 days go too
create or replace function public.tidy_world() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.chat where world_id = new.world_id and created_at < now() - interval '24 hours';
  delete from public.chat where world_id = new.world_id and id not in (select id from public.chat where world_id = new.world_id order by id desc limit 200);
  delete from public.offers where world_id = new.world_id and status in ('done', 'cancelled', 'declined') and updated_at < now() - interval '7 days';
  return new;
end $$;
drop trigger if exists chat_tidy on public.chat;
create trigger chat_tidy after insert on public.chat for each row execute function public.tidy_world();
drop trigger if exists offers_tidy on public.offers;
create trigger offers_tidy after insert on public.offers for each row execute function public.tidy_world();

do $$ begin alter publication supabase_realtime add table public.offers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat; exception when duplicate_object then null; end $$;

-- =====================================================================
-- Servers: four public worlds of up to 8 players each (people only, no AI towns).
-- Every account chooses one server, once, and plays only there.
-- =====================================================================
alter table public.worlds alter column host drop not null;
alter table public.worlds add column if not exists is_server boolean not null default false;
alter table public.profiles add column if not exists server_id uuid references public.worlds (id) on delete set null;

insert into public.worlds (code, name, host, seed, max_players, is_server)
select v.code, v.name, null, v.seed, 8, true
from (values ('SRV1', 'Server 1 · Toshkent', 104729), ('SRV2', 'Server 2 · Samarqand', 224737),
             ('SRV3', 'Server 3 · Buxoro', 350377), ('SRV4', 'Server 4 · Xiva', 479909)) as v (code, name, seed)
where not exists (select 1 from public.worlds w where w.code = v.code);

drop policy if exists "worlds of my own" on public.worlds;
create policy "worlds of my own" on public.worlds for select to authenticated using (is_server or host = auth.uid() or public.is_member(id));

-- the servers with how many play on each (everyone may see this list)
create or replace function public.server_list()
returns table (id uuid, code text, name text, players int, max_players int, started_at timestamptz)
language sql security definer stable set search_path = public as $$
  select w.id, w.code, w.name, (select count(*)::int from public.world_members m where m.world_id = w.id), w.max_players, w.started_at
  from public.worlds w where w.is_server order by w.code;
$$;

-- join a server: only the one chosen the first time, and only while it has room
create or replace function public.join_server(p_world uuid, p_city text)
returns public.worlds
language plpgsql security definer set search_path = public as $$
declare
  w public.worlds;
  mine uuid;
  s int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select server_id into mine from public.profiles where id = auth.uid();
  if mine is not null and mine <> p_world then raise exception 'You already chose a server: you can play only on that one'; end if;
  select * into w from public.worlds where id = p_world and is_server;
  if w.id is null then raise exception 'No such server'; end if;
  if not exists (select 1 from public.world_members where world_id = w.id and user_id = auth.uid()) then
    if (select count(*) from public.world_members where world_id = w.id) >= w.max_players then raise exception 'This server is full'; end if;
    select min(g) into s from generate_series(0, w.max_players - 1) g
     where not exists (select 1 from public.world_members m where m.world_id = w.id and m.slot = g);
    insert into public.world_members (world_id, user_id, city_name, slot)
    values (w.id, auth.uid(), left(coalesce(nullif(trim(p_city), ''), 'My town'), 30), s);
  end if;
  insert into public.profiles (id, server_id) values (auth.uid(), w.id)
  on conflict (id) do update set server_id = excluded.server_id;
  return w;
end $$;

grant execute on function public.server_list() to authenticated;
grant execute on function public.join_server(uuid, text) to authenticated;

-- a server is never closed when its last player leaves
create or replace function public.leave_world(p_world uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.world_members where world_id = p_world and user_id = auth.uid();
  delete from public.worlds w where w.id = p_world and not w.is_server and not exists (select 1 from public.world_members m where m.world_id = w.id);
end $$;

-- =====================================================================
-- More players, less traffic: eight servers with English names, and each town's map and card kept in a table of
-- its own — sent only when it changed and fetched by the others only when its version moved on.
-- =====================================================================
update public.worlds set name = 'Maple Valley' where code = 'SRV1';
update public.worlds set name = 'Silver Coast' where code = 'SRV2';
update public.worlds set name = 'Sunny Hills' where code = 'SRV3';
update public.worlds set name = 'Pine Ridge' where code = 'SRV4';
insert into public.worlds (code, name, host, seed, max_players, is_server)
select v.code, v.name, null, v.seed, 8, true
from (values ('SRV5', 'Golden Fields', 593573), ('SRV6', 'Blue Lagoon', 611953),
             ('SRV7', 'Cedar Harbor', 733067), ('SRV8', 'Willow Creek', 857929)) as v (code, name, seed)
where not exists (select 1 from public.worlds w where w.code = v.code);

alter table public.world_members add column if not exists layout_ver int not null default 0;

create table if not exists public.town_layouts (
  world_id uuid not null references public.worlds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  ver int not null default 0,
  layout jsonb not null default '{}'::jsonb,
  town jsonb,
  updated_at timestamptz not null default now(),
  primary key (world_id, user_id)
);
alter table public.town_layouts enable row level security;
drop policy if exists "read layouts" on public.town_layouts;
create policy "read layouts" on public.town_layouts for select to authenticated using (public.is_member(world_id));
drop policy if exists "write my layout" on public.town_layouts;
create policy "write my layout" on public.town_layouts for insert to authenticated with check (user_id = auth.uid() and public.is_member(world_id));
drop policy if exists "update my layout" on public.town_layouts;
create policy "update my layout" on public.town_layouts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

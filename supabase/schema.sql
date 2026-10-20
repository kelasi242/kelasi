-- KELASI — schéma Supabase idempotent (à exécuter dans SQL Editor)
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  weekly_target numeric not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.versements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null, amount numeric not null check (amount >= 100),
  category text not null check (category in ('perso','business','congo')), note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.soldes_bancaires (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  balance numeric not null check (balance >= 0), captured_at date not null, note text,
  created_at timestamptz not null default now()
);
create table if not exists public.projets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, target numeric not null check (target > 0), allocated numeric not null default 0,
  category text, color text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.versements enable row level security;
alter table public.soldes_bancaires enable row level security;
alter table public.projets enable row level security;

drop policy if exists "own profiles" on public.profiles;
drop policy if exists "own versements" on public.versements;
drop policy if exists "own soldes" on public.soldes_bancaires;
drop policy if exists "own projets" on public.projets;
create policy "own profiles" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own versements" on public.versements for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own soldes" on public.soldes_bancaires for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own projets" on public.projets for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

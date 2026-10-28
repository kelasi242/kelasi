-- KELASI v3 — schéma/migration unique, additive et idempotente.
-- Compatible avec une base vide, KELASI v1 ou v2. Ne supprime aucune donnée.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, weekly_target numeric not null default 100,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.versements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null, amount numeric not null default 0, category text, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.soldes_bancaires (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  balance numeric not null default 0, captured_at date, note text, created_at timestamptz not null default now()
);
create table if not exists public.projets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, target numeric not null default 0, allocated numeric not null default 0,
  category text, color text, deadline date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.versements_mensuels (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  month text not null, planned numeric not null default 0, paid numeric,
  "paidAt" date, "projectId" text, note text, updated_at timestamptz not null default now()
);
create table if not exists public.dettes (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, creditor text, total numeric not null default 0,
  "monthlyPayment" numeric not null default 0, "firstPaymentDate" date, "paidCount" integer not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.paiements_dettes (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  "debtId" text not null, installment integer not null, "paidAt" date, amount numeric, updated_at timestamptz not null default now()
);
create table if not exists public.reglages_rappels (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true, "dayOfMonth" integer not null default 1, "daysBefore" integer not null default 7,
  updated_at timestamptz not null default now()
);

-- Complément de colonnes pour les tables déjà créées par v1/v2/v3.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists weekly_target numeric default 100;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();
alter table public.versements add column if not exists week_start date;
alter table public.versements add column if not exists amount numeric default 0;
alter table public.versements add column if not exists category text;
alter table public.versements add column if not exists note text;
alter table public.versements add column if not exists created_at timestamptz default now();
alter table public.versements add column if not exists updated_at timestamptz default now();
alter table public.soldes_bancaires add column if not exists balance numeric default 0;
alter table public.soldes_bancaires add column if not exists captured_at date;
alter table public.soldes_bancaires add column if not exists note text;
alter table public.soldes_bancaires add column if not exists bank_name text default 'BPC';
alter table public.soldes_bancaires add column if not exists account_hint text;
alter table public.soldes_bancaires add column if not exists created_at timestamptz default now();
alter table public.projets add column if not exists title text;
alter table public.projets add column if not exists target numeric default 0;
alter table public.projets add column if not exists allocated numeric default 0;
alter table public.projets add column if not exists category text;
alter table public.projets add column if not exists color text;
alter table public.projets add column if not exists deadline date;
alter table public.projets add column if not exists created_at timestamptz default now();
alter table public.projets add column if not exists updated_at timestamptz default now();
alter table public.versements_mensuels add column if not exists "paidAt" date;
alter table public.versements_mensuels add column if not exists "projectId" text;
alter table public.versements_mensuels add column if not exists note text;
alter table public.versements_mensuels add column if not exists updated_at timestamptz default now();
alter table public.dettes add column if not exists creditor text;
alter table public.dettes add column if not exists "paidCount" integer default 0;
alter table public.dettes add column if not exists updated_at timestamptz default now();
alter table public.paiements_dettes add column if not exists "paidAt" date;
alter table public.paiements_dettes add column if not exists amount numeric;
alter table public.paiements_dettes add column if not exists updated_at timestamptz default now();

-- Politiques propres à chaque table, sans toucher aux lignes existantes.
do $$ declare t text; begin
  foreach t in array array['profiles','versements','soldes_bancaires','projets','versements_mensuels','dettes','paiements_dettes','reglages_rappels'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
  end loop;
end $$;
drop policy if exists "own profiles" on public.profiles;
drop policy if exists "own versements" on public.versements;
drop policy if exists "own soldes" on public.soldes_bancaires;
drop policy if exists "own projets" on public.projets;
create policy own_rows on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy own_rows on public.versements for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on public.soldes_bancaires for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on public.projets for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
do $$ declare t text; begin foreach t in array array['versements_mensuels','dettes','paiements_dettes','reglages_rappels'] loop execute format('create policy own_rows on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',t); end loop; end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id,email) values (new.id,new.email) on conflict (id) do update set email=excluded.email,updated_at=now(); return new; end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
notify pgrst, 'reload schema';

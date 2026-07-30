-- Knowledge Vault — initial schema
--
-- Identity model: there is no login UI. Each "Vault Key" the app generates
-- signs in via Supabase's normal email/password auth using a deterministic,
-- non-reversible synthetic email (see src/lib/vaultkey and
-- src/lib/supabase/vaultAuth.ts). That gives every vault a real
-- `auth.uid()`, so RLS below can scope everything to `vaults.owner_id`
-- without any custom Postgres session wiring.
--
-- IMPORTANT setup step (not covered by this file): in the Supabase
-- dashboard, go to Authentication -> Providers -> Email and turn OFF
-- "Confirm email". Without that, signUp() will not return a usable session
-- immediately, since there is no real inbox behind the synthetic address.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- vaults
-- ---------------------------------------------------------------------
create table if not exists public.vaults (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  vault_key_hash text not null unique,
  created_at timestamptz not null default now()
);

alter table public.vaults enable row level security;

create policy "vaults_select_own" on public.vaults
  for select using (owner_id = auth.uid());
create policy "vaults_insert_own" on public.vaults
  for insert with check (owner_id = auth.uid());
create policy "vaults_update_own" on public.vaults
  for update using (owner_id = auth.uid());
create policy "vaults_delete_own" on public.vaults
  for delete using (owner_id = auth.uid());

-- Helper used by every child-table policy below.
create or replace function public.owns_vault(v_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.vaults where id = v_id and owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- folders
-- ---------------------------------------------------------------------
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults (id) on delete cascade,
  name text not null,
  parent text,
  created_at timestamptz not null default now(),
  unique (vault_id, name)
);

alter table public.folders enable row level security;

create policy "folders_all_own" on public.folders
  for all using (public.owns_vault(vault_id)) with check (public.owns_vault(vault_id));

create index if not exists folders_vault_id_idx on public.folders (vault_id);

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (vault_id, name)
);

alter table public.categories enable row level security;

create policy "categories_all_own" on public.categories
  for all using (public.owns_vault(vault_id)) with check (public.owns_vault(vault_id));

create index if not exists categories_vault_id_idx on public.categories (vault_id);

-- ---------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------
create table if not exists public.notes (
  id text primary key,
  vault_id uuid not null references public.vaults (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  folder text not null default '',
  category text not null default '',
  tags jsonb not null default '[]'::jsonb,
  date text,
  daily boolean not null default false,
  created_at timestamptz not null default now(),
  modified timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.notes enable row level security;

create policy "notes_all_own" on public.notes
  for all using (public.owns_vault(vault_id)) with check (public.owns_vault(vault_id));

create index if not exists notes_vault_id_idx on public.notes (vault_id);
create index if not exists notes_vault_modified_idx on public.notes (vault_id, modified desc);

-- ---------------------------------------------------------------------
-- note_revisions — version history, written on every conflict/overwrite
-- ---------------------------------------------------------------------
create table if not exists public.note_revisions (
  id uuid primary key default gen_random_uuid(),
  note_id text not null references public.notes (id) on delete cascade,
  vault_id uuid not null references public.vaults (id) on delete cascade,
  content text not null,
  source text not null check (source in ('local', 'remote', 'conflict')),
  created_at timestamptz not null default now()
);

alter table public.note_revisions enable row level security;

create policy "note_revisions_all_own" on public.note_revisions
  for all using (public.owns_vault(vault_id)) with check (public.owns_vault(vault_id));

create index if not exists note_revisions_note_id_idx on public.note_revisions (note_id, created_at desc);

-- ---------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults (id) on delete cascade,
  note_id text not null references public.notes (id) on delete cascade,
  storage_path text not null,
  type text not null default '',
  filename text not null,
  created_at timestamptz not null default now(),
  unique (vault_id, note_id, storage_path)
);

alter table public.attachments enable row level security;

create policy "attachments_all_own" on public.attachments
  for all using (public.owns_vault(vault_id)) with check (public.owns_vault(vault_id));

create index if not exists attachments_vault_id_idx on public.attachments (vault_id);
create index if not exists attachments_note_id_idx on public.attachments (note_id);

-- ---------------------------------------------------------------------
-- vault_settings — one row per vault
-- ---------------------------------------------------------------------
create table if not exists public.vault_settings (
  vault_id uuid primary key references public.vaults (id) on delete cascade,
  theme text not null default 'Light Warm',
  accent_color text not null default '#b0623b',
  app_font text not null default 'Sans',
  note_font text not null default 'Serif',
  sort text not null default 'name-az',
  updated_at timestamptz not null default now()
);

alter table public.vault_settings enable row level security;

create policy "vault_settings_all_own" on public.vault_settings
  for all using (public.owns_vault(vault_id)) with check (public.owns_vault(vault_id));

-- ---------------------------------------------------------------------
-- Storage bucket for attachments
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Storage objects are keyed as `${vault_id}/${filename}` — policies check
-- that the leading path segment is a vault the caller owns.
create policy "attachments_storage_select_own" on storage.objects
  for select using (
    bucket_id = 'attachments'
    and public.owns_vault((storage.foldername(name))[1]::uuid)
  );
create policy "attachments_storage_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and public.owns_vault((storage.foldername(name))[1]::uuid)
  );
create policy "attachments_storage_delete_own" on storage.objects
  for delete using (
    bucket_id = 'attachments'
    and public.owns_vault((storage.foldername(name))[1]::uuid)
  );

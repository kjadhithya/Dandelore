alter table public.vault_settings
  add column if not exists pinned_categories text[] not null default '{}';

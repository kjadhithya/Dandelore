alter table public.vault_settings
  add column if not exists title_font text not null default 'Serif';

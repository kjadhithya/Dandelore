-- Graph view settings (filters, groups, display, forces) and saved graph
-- bookmarks, synced across devices with the rest of vault_settings.
-- Additive only: both columns are nullable with no default, so existing
-- rows are untouched and NULL simply means "never set on any device yet".
alter table public.vault_settings
  add column if not exists graph_settings jsonb,
  add column if not exists graph_bookmarks jsonb;

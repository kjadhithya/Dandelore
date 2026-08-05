-- Realtime — a fresh Supabase project's `supabase_realtime` publication is
-- empty by default, so postgres_changes subscriptions receive nothing until
-- a table is explicitly added to it. syncWorker.ts subscribes to `notes`
-- expecting live INSERT/UPDATE events from other devices; without this, the
-- app only ever picks up remote changes on a fresh load (pullAndMerge), not
-- live while both devices are open.
alter publication supabase_realtime add table public.notes;

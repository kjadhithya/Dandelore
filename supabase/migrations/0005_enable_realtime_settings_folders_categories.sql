-- 0003 only added `notes` to the realtime publication. vault_settings
-- (theme/accent/fonts/sort) and folders/categories all have app code that
-- expects live postgres_changes events — vault_settings already subscribes
-- in syncWorker.ts, folders/categories are being added alongside this
-- migration — but none of them were ever added to the publication, so
-- those changes only ever showed up on the next 45s poll or full reload,
-- never instantly while two devices had the vault open at once.
alter publication supabase_realtime add table public.vault_settings;
alter publication supabase_realtime add table public.folders;
alter publication supabase_realtime add table public.categories;

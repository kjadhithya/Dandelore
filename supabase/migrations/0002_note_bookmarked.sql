alter table public.notes
  add column if not exists bookmarked boolean not null default false;

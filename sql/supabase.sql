-- Run in your Supabase project's SQL Editor before enabling sign-in in the app.
create table if not exists public.ocg_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  store text not null check (store in ('decks','deckVersions','events','matches','games','tags','periods')),
  id uuid not null,
  body jsonb,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id,store,id),
  constraint record_or_tombstone check ((body is null) = (deleted_at is not null)),
  constraint consistent_record_id check (body is null or body->>'id' = id::text),
  constraint consistent_record_owner check (body is null or body->>'userId' = user_id::text)
);
alter table public.ocg_records enable row level security;
revoke all on public.ocg_records from anon;
revoke all on public.ocg_records from authenticated;
grant select, insert, update on public.ocg_records to authenticated;
create policy "Read own OCG records" on public.ocg_records for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own OCG records" on public.ocg_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own OCG records" on public.ocg_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

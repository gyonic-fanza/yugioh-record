-- Phase 4: execute after supabase.sql. Only explicitly submitted snapshots participate.
-- A user can read only their own snapshot. Everyone sees grouped RPC results with >=5 contributors per group.
create table if not exists public.ocg_public_snapshots (
 user_id uuid primary key references auth.users(id) on delete cascade,
 matches jsonb not null default '[]'::jsonb,
 cards jsonb not null default '[]'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.ocg_public_snapshots enable row level security;
revoke all on public.ocg_public_snapshots from anon, authenticated;
grant select on public.ocg_public_snapshots to authenticated;
drop policy if exists "Read own community snapshot" on public.ocg_public_snapshots;
create policy "Read own community snapshot" on public.ocg_public_snapshots for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.ocg_publish_snapshot(p_matches jsonb, p_cards jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid());
begin
 if caller is null then raise exception 'Login required'; end if;
 if jsonb_typeof(p_matches) <> 'array' or jsonb_typeof(p_cards) <> 'array'
    or jsonb_array_length(p_matches) > 1000 or jsonb_array_length(p_cards) > 500
    or length(p_matches::text) > 160000 or length(p_cards::text) > 80000 then
   raise exception 'Invalid contribution size';
 end if;
 if exists (select 1 from jsonb_array_elements(p_matches) x where
   jsonb_typeof(x) <> 'object' or coalesce(x->>'month','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
   or coalesce(length(x->>'deck'),0) not between 1 and 80 or coalesce(length(x->>'opponent'),0) not between 1 and 80
   or coalesce(x->>'result','') not in ('WIN','LOSS','DRAW') or not (x ?& array['month','deck','opponent','result'])
   or (select count(*) from jsonb_object_keys(x)) <> 4)
 or exists (select 1 from jsonb_array_elements(p_cards) x where
   jsonb_typeof(x) <> 'object' or coalesce(length(x->>'deck'),0) not between 1 and 80
   or coalesce(length(x->>'card'),0) not between 1 and 80 or coalesce(x->>'zone','') not in ('main','extra','side') or not (x ?& array['deck','card','zone'])
   or (select count(*) from jsonb_object_keys(x)) <> 3) then
   raise exception 'Invalid contribution content';
 end if;
 insert into public.ocg_public_snapshots(user_id,matches,cards,updated_at)
 values(caller,p_matches,p_cards,now())
 on conflict(user_id) do update set matches=excluded.matches,cards=excluded.cards,updated_at=excluded.updated_at;
end $$;
create or replace function public.ocg_withdraw_snapshot()
returns void language plpgsql security definer set search_path = '' as $$
begin
 if (select auth.uid()) is null then raise exception 'Login required'; end if;
 delete from public.ocg_public_snapshots where user_id=(select auth.uid());
end $$;

create or replace function public.ocg_community_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare output jsonb;
begin
 if (select auth.uid()) is null then raise exception 'Login required'; end if;
 with m as (
   select s.user_id, x.month, x.deck, x.opponent, x.result
   from public.ocg_public_snapshots s cross join lateral jsonb_to_recordset(s.matches)
   as x(month text,deck text,opponent text,result text)
 ), c as (
   select distinct s.user_id,x.deck,x.card,x.zone
   from public.ocg_public_snapshots s cross join lateral jsonb_to_recordset(s.cards)
   as x(deck text,card text,zone text)
 ), environment as (
   select opponent as name,count(*) as battles,count(distinct user_id) as contributors
   from m group by opponent having count(distinct user_id)>=5 order by battles desc limit 30
 ), trends as (
   select month,opponent as name,count(*) as battles,count(distinct user_id) as contributors
   from m group by month,opponent having count(distinct user_id)>=5 order by month desc,battles desc limit 100
 ), deck_trends as (
   select month,deck as name,count(*) as battles,count(distinct user_id) as contributors
   from m group by month,deck having count(distinct user_id)>=5 order by month desc,battles desc limit 100
 ), matchups as (
   select deck,opponent,count(*) as battles,count(distinct user_id) as contributors,
      count(*) filter(where result='WIN') as wins,count(*) filter(where result='LOSS') as losses,
      count(*) filter(where result='DRAW') as draws
   from m group by deck,opponent having count(distinct user_id)>=5 order by battles desc limit 80
 ), adoption as (
   select deck,card,zone,count(distinct user_id) as adopters,
     (select count(distinct base.user_id) from c base where base.deck=c.deck) as deck_users
   from c group by deck,card,zone having count(distinct user_id)>=5 order by adopters desc limit 100
 )
 select jsonb_build_object(
   'contributors',(select case when count(*)>=5 then count(*) else 0 end from public.ocg_public_snapshots),
   'environment',coalesce((select jsonb_agg(to_jsonb(t)) from environment t),'[]'::jsonb),
   'trends',coalesce((select jsonb_agg(to_jsonb(t)) from trends t),'[]'::jsonb),
   'deckTrends',coalesce((select jsonb_agg(to_jsonb(t)) from deck_trends t),'[]'::jsonb),
   'matchups',coalesce((select jsonb_agg(to_jsonb(t)) from matchups t),'[]'::jsonb),
   'adoption',coalesce((select jsonb_agg(to_jsonb(t)) from adoption t),'[]'::jsonb)
 ) into output;
 return output;
end $$;
revoke all on function public.ocg_publish_snapshot(jsonb,jsonb) from public,anon;
revoke all on function public.ocg_withdraw_snapshot() from public,anon;
revoke all on function public.ocg_community_overview() from public,anon;
grant execute on function public.ocg_publish_snapshot(jsonb,jsonb) to authenticated;
grant execute on function public.ocg_withdraw_snapshot() to authenticated;
grant execute on function public.ocg_community_overview() to authenticated;

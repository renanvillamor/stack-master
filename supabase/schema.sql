-- StackMaster Session Sync — run this in the Supabase SQL editor.
-- Idempotent: safe to re-run after applying it once.

create extension if not exists pgcrypto;

create table if not exists sessions (
  id text primary key,
  host_key uuid not null default gen_random_uuid(),
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table sessions enable row level security;

drop policy if exists "sessions_select_all" on sessions;
create policy "sessions_select_all" on sessions for select using (true);
-- No insert/update/delete policies for anon — all writes go through the
-- SECURITY DEFINER RPCs below, which check host_key themselves.

create or replace function create_session(p_id text, p_host_key uuid)
returns void language sql security definer as $$
  insert into sessions (id, host_key, state) values (p_id, p_host_key, '{}'::jsonb);
$$;

create or replace function update_session_state(p_id text, p_host_key uuid, p_state jsonb)
returns void language plpgsql security definer as $$
begin
  update sessions set state = p_state, updated_at = now()
   where id = p_id and host_key = p_host_key;
  if not found then raise exception 'unauthorized or session not found'; end if;
end;
$$;

create or replace function end_session(p_id text, p_host_key uuid)
returns void language sql security definer as $$
  delete from sessions where id = p_id and host_key = p_host_key;
$$;

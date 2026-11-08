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

-- host_key is the only thing that authorizes writes, so clients must never be
-- able to read it back (a readable key would also bypass the host-transfer
-- code below). Guests only ever select `state`.
revoke select on sessions from anon, authenticated;
grant select (id, state, updated_at) on sessions to anon, authenticated;

-- ─── Host transfer ──────────────────────────────────────────────────────────
-- The host offers the session to one watching guest and shows a 4-digit code
-- on their own screen; the guest takes over by entering it. The code only
-- ever lives here (never broadcast), and wrong guesses are capped.

create table if not exists host_transfers (
  session_id text primary key references sessions(id) on delete cascade,
  guest_id text not null,
  code text not null,
  attempts int not null default 0,
  expires_at timestamptz not null
);

alter table host_transfers enable row level security;
-- No policies at all — only the SECURITY DEFINER RPCs below touch this table.

create or replace function begin_host_transfer(p_id text, p_host_key uuid, p_guest_id text, p_code text)
returns void language plpgsql security definer as $$
begin
  if not exists (select 1 from sessions where id = p_id and host_key = p_host_key) then
    raise exception 'unauthorized or session not found';
  end if;
  insert into host_transfers (session_id, guest_id, code, attempts, expires_at)
  values (p_id, p_guest_id, p_code, 0, now() + interval '5 minutes')
  on conflict (session_id) do update
    set guest_id = excluded.guest_id,
        code = excluded.code,
        attempts = 0,
        expires_at = excluded.expires_at;
end;
$$;

create or replace function cancel_host_transfer(p_id text, p_host_key uuid)
returns void language sql security definer as $$
  delete from host_transfers t using sessions s
   where t.session_id = p_id and s.id = p_id and s.host_key = p_host_key;
$$;

-- Returns 'ok' | 'wrong_code' | 'locked' | 'expired'. On 'ok' the session's
-- host_key is swapped to p_new_host_key, so the old host's writes start failing.
create or replace function claim_host_transfer(p_id text, p_guest_id text, p_code text, p_new_host_key uuid)
returns text language plpgsql security definer as $$
declare
  t host_transfers%rowtype;
begin
  select * into t from host_transfers
   where session_id = p_id and guest_id = p_guest_id
   for update;
  if not found then return 'expired'; end if;
  if t.expires_at < now() then
    delete from host_transfers where session_id = p_id;
    return 'expired';
  end if;
  if t.code <> p_code then
    if t.attempts + 1 >= 5 then
      delete from host_transfers where session_id = p_id;
      return 'locked';
    end if;
    update host_transfers set attempts = attempts + 1 where session_id = p_id;
    return 'wrong_code';
  end if;
  update sessions set host_key = p_new_host_key, updated_at = now() where id = p_id;
  delete from host_transfers where session_id = p_id;
  return 'ok';
end;
$$;

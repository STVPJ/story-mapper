-- StoryMapper — Supabase schema for optional cloud mode
-- ---------------------------------------------------------------------------
-- Run this once in the Supabase SQL editor (or via `supabase db push`) on a
-- fresh project. It creates the five data tables that mirror the app's data
-- model plus the two tables used by the invite-only access model, and enables
-- Row-Level Security so every user can only ever see their own maps.
--
-- Local mode (the default) does NOT need any of this — it runs entirely in
-- the browser's IndexedDB with no server.
-- ---------------------------------------------------------------------------

-- Supabase provides gen_random_uuid() via the pgcrypto extension.
create extension if not exists "pgcrypto";

-- ===========================================================================
-- Data tables (StoryMap > Feature > Epic > Story, plus Release)
-- ===========================================================================

create table if not exists public.story_maps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null default 'Untitled Map',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.releases (
  id            uuid primary key default gen_random_uuid(),
  story_map_id  uuid not null references public.story_maps (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null default 'New Release',
  "order"       integer not null default 0,
  colour        text not null default '#6366F1'
                  check (colour ~ '^#[0-9a-fA-F]{6}$')
);

create table if not exists public.features (
  id                   uuid primary key default gen_random_uuid(),
  story_map_id         uuid not null references public.story_maps (id) on delete cascade,
  user_id              uuid not null references auth.users (id) on delete cascade,
  title                text not null default 'New Feature',
  description          text not null default '',
  acceptance_criteria  text not null default '',
  "order"              integer not null default 0
);

create table if not exists public.epics (
  id                   uuid primary key default gen_random_uuid(),
  feature_id           uuid not null references public.features (id) on delete cascade,
  user_id              uuid not null references auth.users (id) on delete cascade,
  title                text not null default 'New Epic',
  description          text not null default '',
  acceptance_criteria  text not null default '',
  "order"              integer not null default 0
);

create table if not exists public.stories (
  id                   uuid primary key default gen_random_uuid(),
  epic_id              uuid not null references public.epics (id) on delete cascade,
  release_id           uuid references public.releases (id) on delete set null,
  user_id              uuid not null references auth.users (id) on delete cascade,
  title                text not null default 'New Story',
  description          text not null default '',
  acceptance_criteria  text not null default '',
  "order"              integer not null default 0
);

create index if not exists features_story_map_id_idx on public.features (story_map_id);
create index if not exists epics_feature_id_idx       on public.epics (feature_id);
create index if not exists stories_epic_id_idx        on public.stories (epic_id);
create index if not exists releases_story_map_id_idx  on public.releases (story_map_id);

-- ===========================================================================
-- Row-Level Security: every row is owned by exactly one user.
-- The SupabaseAdapter always sets user_id on insert; these policies make the
-- isolation enforced at the database, not just trusted from the client.
-- ===========================================================================

do $$
declare
  t text;
begin
  foreach t in array array['story_maps', 'releases', 'features', 'epics', 'stories']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_owner" on public.%I;', t, t);
    execute format(
      'create policy "%s_owner" on public.%I
         for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id);',
      t, t
    );
  end loop;
end $$;

-- ===========================================================================
-- Invite-only access model
--
--   allowed_users    — the allowlist. If your email is here, you're in.
--   access_requests  — sign-in attempts from people not yet on the allowlist.
--
-- "Admins" are simply users whose email is already in allowed_users; they can
-- read/approve access requests and add others. Seed the first admin manually
-- (see the bottom of this file).
-- ===========================================================================

create table if not exists public.allowed_users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.access_requests (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  display_name  text,
  avatar_url    text,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'denied')),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- Helper: is the currently authenticated user on the allowlist?
create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_users
    where email = (auth.jwt() ->> 'email')
  );
$$;

alter table public.allowed_users enable row level security;
alter table public.access_requests enable row level security;

-- allowed_users: a user may check their own membership; admins manage all.
drop policy if exists "allowed_users_self_read" on public.allowed_users;
create policy "allowed_users_self_read" on public.allowed_users
  for select using (email = (auth.jwt() ->> 'email'));

drop policy if exists "allowed_users_admin_all" on public.allowed_users;
create policy "allowed_users_admin_all" on public.allowed_users
  for all using (public.is_allowed_user()) with check (public.is_allowed_user());

-- access_requests: anyone signed in may submit/read their own request;
-- admins may read and update (approve/deny) every request.
drop policy if exists "access_requests_self" on public.access_requests;
create policy "access_requests_self" on public.access_requests
  for select using (email = (auth.jwt() ->> 'email'));

drop policy if exists "access_requests_insert_self" on public.access_requests;
create policy "access_requests_insert_self" on public.access_requests
  for insert with check (email = (auth.jwt() ->> 'email'));

drop policy if exists "access_requests_admin_read" on public.access_requests;
create policy "access_requests_admin_read" on public.access_requests
  for select using (public.is_allowed_user());

drop policy if exists "access_requests_admin_update" on public.access_requests;
create policy "access_requests_admin_update" on public.access_requests
  for update using (public.is_allowed_user()) with check (public.is_allowed_user());

-- ===========================================================================
-- Seed the first admin
--
-- The allowlist is empty after running this script, so nobody can get in.
-- Add yourself once, by hand, replacing the email below:
--
--   insert into public.allowed_users (email) values ('you@example.com');
--
-- After that, sign in with GitHub and approve everyone else from the
-- "Manage Access" panel in the app.
-- ===========================================================================

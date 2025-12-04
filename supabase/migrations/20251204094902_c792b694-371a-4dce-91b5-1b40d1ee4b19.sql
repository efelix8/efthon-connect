-- Combined migration: profiles, users, rooms, messages

-- 1) PROFILES TABLE
create table public.profiles (
  id uuid primary key,                -- equals Cloud Auth user id
  display_name text,
  avatar_url   text,
  bio          text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_profiles_display_name
  on public.profiles (lower(display_name));


-- 2) USERS TABLE
create table public.users (
  id           uuid primary key default gen_random_uuid(),

  -- relation to Cloud Auth / profiles
  auth_user_id uuid,
  profile_id   uuid references public.profiles (id),

  nickname     text not null,
  ip_hash      text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- At most one users row per auth user (when auth_user_id is set)
create unique index if not exists users_auth_user_id_unique
  on public.users (auth_user_id)
  where auth_user_id is not null;

-- At most one users row per profile (when profile_id is set)
create unique index if not exists users_profile_id_unique
  on public.users (profile_id)
  where profile_id is not null;

create index if not exists idx_users_nickname_lower
  on public.users (lower(nickname));

create index if not exists idx_users_ip_hash
  on public.users (ip_hash);


-- 3) ROOMS TABLE
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_rooms_is_default
  on public.rooms (is_default);

-- Seed a default room
insert into public.rooms (slug, name, is_default)
values ('general', 'Genel Sohbet', true)
on conflict (slug) do nothing;


-- 4) MESSAGES TABLE
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  deleted_at timestamptz
);

create index if not exists idx_messages_room_created_at
  on public.messages (room_id, created_at desc);

create index if not exists idx_messages_user_id
  on public.messages (user_id);
-- Allowed users list for PIN login (UI gate).
-- Run in Supabase SQL editor.
-- NOTE: This is not Supabase Auth. It's an app-level login gate.

create table if not exists public.allowed_users (
  id text primary key,
  name text not null unique,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

-- Insert/Update an allowed user.
-- IMPORTANT: pin_hash should be SHA-256 hex of the PIN (digits).
-- You can generate it inside the app (Login page) or via any SHA-256 tool.
--
-- Example:
-- insert into public.allowed_users (id, name, pin_hash)
-- values ('user_jbh', 'JBH', '<sha256-hex-of-pin>')
-- on conflict (name) do update set pin_hash = excluded.pin_hash;


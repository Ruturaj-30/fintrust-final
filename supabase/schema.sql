-- =====================================================================
--  FinTrust Final · database tables for Supabase (PostgreSQL)
--  Only needed when you publish the app online.
--  HOW: Supabase → SQL Editor → New query → paste ALL of this → Run.
--  Expected result: "Success. No rows returned".
--  Running it again DELETES everything and starts fresh (the app then
--  re-creates the demo data on its next start).
-- =====================================================================

drop table if exists public.audit_anchors cascade;
drop table if exists public.audit_log cascade;
drop table if exists public.user_tokens cascade;
drop table if exists public.user_photos cascade;
drop table if exists public.access_grants cascade;
drop table if exists public.access_requests cascade;
drop table if exists public.users cascade;
drop table if exists public.applications cascade;
drop table if exists public.departments cascade;
drop table if exists public.branches cascade;
drop table if exists public.partner_banks cascade;
drop table if exists public.settings cascade;
drop function if exists public.audit_log_is_append_only() cascade;

-- Organisation profile and security policy (one row each)
create table public.settings (
  id          text primary key,
  value       jsonb not null,
  updated_at  timestamptz,
  updated_by  uuid
);

-- Real Indian banks, used only as settlement / correspondent partners
create table public.partner_banks (
  id            text primary key,
  name          text not null,
  ifsc_prefix   text not null check (ifsc_prefix ~ '^[A-Z]{4}$'),
  sector        text not null,
  headquarters  text not null,
  relationship  text not null
);

-- FinTrust Bank branches. id is the branch IFSC code (4 letters + 0 + 6 characters)
create table public.branches (
  id       text primary key check (id ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  name     text not null,
  city     text not null,
  state    text not null,
  type     text not null,
  pincode  text not null check (pincode ~ '^[1-9][0-9]{5}$')
);

create table public.departments (
  id    text primary key,
  name  text not null unique
);

-- Bank applications that staff can request access to
create table public.applications (
  id                text primary key,
  name              text not null,
  description       text not null,
  owner_department  text not null,
  risk              text not null check (risk in ('low', 'medium', 'high', 'critical')),
  levels            jsonb not null,
  active            boolean not null default true
);

-- Staff accounts (identity). Passwords are bcrypt hashes, never plain text.
create table public.users (
  id                   uuid primary key,
  employee_id          text not null unique,
  full_name            text not null,
  email                text not null unique,
  role                 text not null check (role in ('System Administrator', 'Access Manager', 'IT Helpdesk', 'Auditor', 'Employee')),
  status               text not null check (status in ('invited', 'active', 'suspended', 'disabled')),
  department           text not null references public.departments(name),
  branch_id            text not null references public.branches(id),
  designation          text not null,
  manager_id           uuid references public.users(id),
  phone                text,
  password_hash        text,
  failed_logins        integer not null default 0,
  locked_until         timestamptz,
  last_login_at        timestamptz,
  password_changed_at  timestamptz,
  activated_at         timestamptz,
  invited_by           uuid references public.users(id),
  created_at           timestamptz not null,
  updated_at           timestamptz not null
);

create table public.access_requests (
  id              uuid primary key,
  user_id         uuid not null references public.users(id),
  application_id  text not null references public.applications(id),
  access_level    text not null,
  justification   text not null,
  status          text not null check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at      timestamptz not null,
  reviewer_id     uuid references public.users(id),
  reviewed_at     timestamptz,
  review_comment  text,
  -- segregation of duties, enforced by the database too
  constraint no_self_review check (reviewer_id is null or reviewer_id <> user_id)
);

create table public.access_grants (
  id              uuid primary key,
  user_id         uuid not null references public.users(id),
  application_id  text not null references public.applications(id),
  access_level    text not null,
  status          text not null check (status in ('active', 'revoked')),
  request_id      uuid references public.access_requests(id),
  granted_by      uuid references public.users(id),
  granted_at      timestamptz not null,
  revoked_at      timestamptz,
  revoked_by      uuid references public.users(id),
  revoke_reason   text
);
-- a person can hold only ONE active level per application
create unique index one_active_grant on public.access_grants (user_id, application_id) where status = 'active';

-- Invitation and password-reset links (only the SHA-256 of the token is stored)
create table public.user_tokens (
  id          uuid primary key,
  user_id     uuid not null references public.users(id),
  type        text not null check (type in ('invite', 'reset')),
  token_hash  text not null unique,
  created_by  uuid references public.users(id),
  created_at  timestamptz not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  revoked_at  timestamptz
);

-- Profile photos (one row per person; id = the user's id). Kept apart from
-- users so staff lists never carry image data. Only JPEG, PNG or WebP.
create table public.user_photos (
  id          uuid primary key references public.users(id),
  mime        text check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  data        text,
  updated_at  timestamptz not null,
  updated_by  uuid references public.users(id),
  check ((mime is null) = (data is null)),
  check (data is null or length(data) <= 400000)
);

-- Audit trail: append-only and hash-chained
create table public.audit_log (
  id            bigint primary key,
  at            timestamptz not null,
  actor_id      uuid,
  actor_name    text not null,
  actor_role    text not null,
  action        text not null,
  category      text not null,
  outcome       text not null check (outcome in ('success', 'failure', 'denied')),
  target_type   text,
  target_id     text,
  target_label  text,
  details       jsonb not null default '{}'::jsonb,
  ip            text,
  prev_hash     text not null,
  hash          text not null unique
);

-- Nobody (not even the app) may change or delete audit entries.
create function public.audit_log_is_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'The audit log is append-only. % is not allowed.', tg_op;
end;
$$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_is_append_only();

create index on public.access_requests (status);
create index on public.access_grants (user_id);
create index on public.audit_log (at);

-- Security: Row Level Security ON with NO policies = the public API keys
-- (anon / publishable) can read or write NOTHING. Only the server, using the
-- secret key, can reach the data.
-- Blockchain anchors: the audit head hash published on a public test network
create table public.audit_anchors (
  id            uuid primary key,
  created_at    timestamptz not null,
  created_by    uuid references public.users(id),
  entry_id      bigint not null references public.audit_log(id),
  head_hash     text not null check (head_hash ~ '^[0-9a-f]{64}$'),
  network       text not null,
  tx_hash       text not null unique,
  status        text not null check (status in ('pending', 'confirmed', 'failed')),
  block_number  bigint,
  error         text
);

alter table public.settings        enable row level security;
alter table public.partner_banks   enable row level security;
alter table public.branches        enable row level security;
alter table public.departments     enable row level security;
alter table public.applications    enable row level security;
alter table public.users           enable row level security;
alter table public.access_requests enable row level security;
alter table public.access_grants   enable row level security;
alter table public.user_tokens     enable row level security;
alter table public.user_photos     enable row level security;
alter table public.audit_anchors   enable row level security;
alter table public.audit_log       enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- Make sure Supabase's REST API notices the new tables straight away
notify pgrst, 'reload schema';

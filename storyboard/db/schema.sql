-- Storyboard MVP schema (Supabase-ready, not wired yet)
-- UUID PKs, timestamps, minimal FKs

create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete set null,
  title text not null,
  topic text,
  style text,
  pages_count int not null,
  plan_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pages (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  page_number int not null,
  created_at timestamptz not null default now()
);

create table if not exists panels (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid not null references pages(id) on delete cascade,
  panel_index int not null,
  caption text,
  dialogue text,
  created_at timestamptz not null default now()
);

create table if not exists feedback (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  rating int check (rating between 1 and 5),
  comments text,
  created_at timestamptz not null default now()
);

-- TODO: Supabase RLS policies and storage buckets will be configured later.

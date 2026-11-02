-- ANIMA Studio - skema database Supabase.
-- Cara pakai: buka Supabase > SQL Editor > New query, tempel seluruh isi file ini, klik Run.
-- Aman dijalankan ulang.

create extension if not exists pgcrypto;

-- Project = satu video pendek.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  topic text not null default '',
  target_seconds int not null default 60 check (target_seconds between 15 and 180),
  style_preset text not null default 'cartoon-3d',
  composition text not null default 'Main',
  script text not null default '',
  status text not null default 'draft' check (status in ('draft', 'ready', 'rendering', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shot = satu potongan kamera di dalam video. 30 fps, jadi 150 frame = 5 detik.
create table if not exists public.shots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  idx int not null,
  duration_frames int not null default 150 check (duration_frames between 15 and 1800),
  camera text not null default '',
  characters jsonb not null default '[]'::jsonb,
  world jsonb not null default '{}'::jsonb,
  narration_text text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (project_id, idx)
);

create table if not exists public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  progress int not null default 0 check (progress between 0 and 100),
  output_path text,
  error text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists shots_project_idx on public.shots (project_id, idx);
create index if not exists render_jobs_project_idx on public.render_jobs (project_id, created_at desc);

-- updated_at otomatis.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
drop trigger if exists shots_touch on public.shots;
create trigger shots_touch before update on public.shots
  for each row execute function public.touch_updated_at();

-- Row Level Security: setiap akun hanya melihat datanya sendiri.
alter table public.projects enable row level security;
alter table public.shots enable row level security;
alter table public.render_jobs enable row level security;

drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own shots" on public.shots;
create policy "own shots" on public.shots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own render jobs" on public.render_jobs;
create policy "own render jobs" on public.render_jobs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 0.4: jenis konten, hook, sumber, pembicara (sama dengan migrations/002_content_types.sql).
alter table public.projects add column if not exists content_type text not null default 'karangan';
alter table public.projects add column if not exists hook text not null default '';
alter table public.projects add column if not exists sources jsonb not null default '[]'::jsonb;
alter table public.shots add column if not exists speaker text not null default '';
notify pgrst, 'reload schema';

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
  target_seconds int not null default 60,
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
-- 0.5: style visual, format, aset 2D, karakter (sama dengan migrations/003_styles_characters.sql).

alter table public.projects add column if not exists visual_style text not null default 'kartun-3d';
alter table public.projects add column if not exists format text not null default '9:16';
-- 0.18.1: durasi portrait sampai 5 menit, landscape 16:9 sampai 15 menit (sama dengan migrations/004_durasi_panjang.sql).
alter table public.projects drop constraint if exists projects_target_seconds_check;
alter table public.projects add constraint projects_target_seconds_check
  check (target_seconds between 15 and (case when format = '16:9' then 900 else 300 end));
-- { backgrounds: { <id>: { description, svg } }, references: [{ title, url, image, license }] }
alter table public.projects add column if not exists assets jsonb not null default '{}'::jsonb;

-- Karakter: 1 utama wajib (dicek aplikasi), maksimal 10 per akun.
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  name text not null,
  nickname text not null default '',
  is_main boolean not null default false,
  personality text not null default '',
  appearance text not null default '',
  visual_style text not null default 'komedi',
  svg text not null default '',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create unique index if not exists characters_one_main on public.characters (user_id) where is_main;

drop trigger if exists characters_touch on public.characters;
create trigger characters_touch before update on public.characters
  for each row execute function public.touch_updated_at();

alter table public.characters enable row level security;
drop policy if exists "own characters" on public.characters;
create policy "own characters" on public.characters
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Maksimal 10 karakter per akun.
create or replace function public.characters_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.characters where user_id = new.user_id) >= 10 then
    raise exception 'Maksimal 10 karakter per akun';
  end if;
  return new;
end $$;
drop trigger if exists characters_limit on public.characters;
create trigger characters_limit before insert on public.characters
  for each row execute function public.characters_limit();

notify pgrst, 'reload schema';

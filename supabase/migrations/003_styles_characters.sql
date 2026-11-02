-- HyperForge 0.5: style visual + format per project, aset 2D (latar), dan karakter milik akun.
-- Cara pakai: Supabase > SQL Editor > New query, tempel isi file ini, klik Run. Aman dijalankan ulang.

alter table public.projects add column if not exists visual_style text not null default 'kartun-3d';
alter table public.projects add column if not exists format text not null default '9:16';
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

-- HyperForge 0.4: jenis konten, hook, sumber, dan pembicara per shot (dialog/film).
-- Cara pakai: Supabase > SQL Editor > New query, tempel isi file ini, klik Run. Aman dijalankan ulang.

alter table public.projects add column if not exists content_type text not null default 'karangan';
alter table public.projects add column if not exists hook text not null default '';
alter table public.projects add column if not exists sources jsonb not null default '[]'::jsonb;

alter table public.shots add column if not exists speaker text not null default '';

-- Muat ulang cache skema supaya API langsung mengenali kolom baru.
notify pgrst, 'reload schema';

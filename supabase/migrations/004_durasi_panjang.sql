-- HyperForge 0.18.1: durasi project lebih panjang. Portrait 9:16 sampai 5 menit (300 detik), landscape 16:9 sampai
-- 15 menit (900 detik). Sebelumnya database membatasi 15-180 detik, jadi project > 3 menit ditolak
-- ("violates check constraint projects_target_seconds_check").
-- Cara pakai: Supabase > SQL Editor > New query, tempel isi file ini, klik Run. Aman dijalankan ulang.

alter table public.projects drop constraint if exists projects_target_seconds_check;
alter table public.projects add constraint projects_target_seconds_check
  check (target_seconds between 15 and (case when format = '16:9' then 900 else 300 end));

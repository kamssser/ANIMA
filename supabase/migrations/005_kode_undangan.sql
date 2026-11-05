-- HyperForge 0.20.0: kode undangan untuk pendaftaran akun (opsional).
-- URL + publishable key Supabase ikut installer dan repo publik, jadi siapa pun bisa mendaftar dan memakai kuota
-- project. Dengan file ini, pendaftaran baru WAJIB memakai kode undangan SETELAH kamu membuat minimal satu kode.
-- Selama tabel kode kosong, pendaftaran tetap terbuka seperti sebelumnya.
--
-- Cara pakai: Supabase > SQL Editor > New query, tempel isi file ini, klik Run. Aman dijalankan ulang.
-- Membuat kode (di SQL Editor):  insert into public.invite_codes (code, note, max_uses) values ('TEMAN-2026', 'grup teman', 10);
-- Melihat pemakaian:             select code, used, max_uses, note from public.invite_codes;
-- Menutup kode:                  update public.invite_codes set max_uses = used where code = 'TEMAN-2026';

create table if not exists public.invite_codes (
  code text primary key,
  note text not null default '',
  max_uses int not null default 1 check (max_uses >= 0),
  used int not null default 0,
  created_at timestamptz not null default now()
);

-- RLS aktif TANPA policy: aplikasi tidak bisa membaca atau mengubah kode; hanya pemilik lewat SQL Editor/dasbor.
alter table public.invite_codes enable row level security;

create or replace function public.check_invite_code() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c text := upper(trim(coalesce(new.raw_user_meta_data->>'invite_code', '')));
begin
  if not exists (select 1 from public.invite_codes) then
    return new; -- belum ada kode: pendaftaran terbuka
  end if;
  update public.invite_codes set used = used + 1 where upper(code) = c and used < max_uses;
  if not found then
    raise exception 'Kode undangan tidak valid atau sudah habis';
  end if;
  return new;
end $$;

drop trigger if exists check_invite_code on auth.users;
create trigger check_invite_code before insert on auth.users
  for each row execute function public.check_invite_code();

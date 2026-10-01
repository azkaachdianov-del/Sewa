-- Vilza VVIP Rental Transport - Sistem Akuntansi Persediaan (Supabase / Postgres)
-- Jalankan di Supabase: SQL Editor > New query > Run

-- ERD: pelanggan 1--N sewa N--1 kendaraan 1--N pemeliharaan
create table pelanggan (
  id bigint generated always as identity primary key,
  nama text not null,
  no_ktp text unique,
  no_hp text,
  alamat text
);

create table kendaraan (
  id bigint generated always as identity primary key,
  plat text not null unique,
  merek text not null,
  tahun int,
  tgl_perolehan date not null,
  harga_perolehan numeric(15,2) not null check (harga_perolehan > 0),
  nilai_residu numeric(15,2) not null default 0,
  umur_ekonomis int not null default 8 check (umur_ekonomis > 0),
  tarif_harian numeric(15,2) not null,
  status text not null default 'Tersedia' check (status in ('Tersedia','Disewa','Perawatan'))
);

create table sewa (
  id bigint generated always as identity primary key,
  pelanggan_id bigint not null references pelanggan(id),
  kendaraan_id bigint not null references kendaraan(id),
  tgl_mulai date not null,
  tgl_selesai date not null,
  tarif_harian numeric(15,2),
  total_sewa numeric(15,2) generated always as ((tgl_selesai - tgl_mulai + 1) * tarif_harian) stored,
  status text not null default 'Berjalan' check (status in ('Berjalan','Selesai','Batal')),
  check (tgl_selesai >= tgl_mulai)
);

create table pemeliharaan (
  id bigint generated always as identity primary key,
  kendaraan_id bigint not null references kendaraan(id),
  tanggal date not null default current_date,
  jenis text not null,
  biaya numeric(15,2) not null check (biaya >= 0),
  keterangan text
);

-- Tarif sewa otomatis diambil dari kendaraan bila kosong
create function fn_sewa_tarif() returns trigger language plpgsql as $$
begin
  if new.tarif_harian is null then
    select tarif_harian into new.tarif_harian from kendaraan where id = new.kendaraan_id;
  end if;
  return new;
end $$;
create trigger trg_sewa_tarif before insert on sewa for each row execute function fn_sewa_tarif();

-- Status kendaraan mengikuti status sewa
create function fn_sewa_status() returns trigger language plpgsql as $$
begin
  update kendaraan set status = case when new.status = 'Berjalan' then 'Disewa' else 'Tersedia' end
  where id = new.kendaraan_id;
  return new;
end $$;
create trigger trg_sewa_status after insert or update of status on sewa for each row execute function fn_sewa_status();

-- Laporan persediaan armada: penyusutan garis lurus, nilai buku, pendapatan, biaya
create view v_persediaan as
select k.id, k.plat, k.merek, k.status, k.harga_perolehan,
  round((k.harga_perolehan - k.nilai_residu) / k.umur_ekonomis, 2) as penyusutan_tahunan,
  round(least((k.harga_perolehan - k.nilai_residu),
    greatest(current_date - k.tgl_perolehan, 0) / 365.0 * (k.harga_perolehan - k.nilai_residu) / k.umur_ekonomis), 2) as akumulasi_penyusutan,
  k.harga_perolehan - round(least((k.harga_perolehan - k.nilai_residu),
    greatest(current_date - k.tgl_perolehan, 0) / 365.0 * (k.harga_perolehan - k.nilai_residu) / k.umur_ekonomis), 2) as nilai_buku,
  coalesce((select sum(total_sewa) from sewa s where s.kendaraan_id = k.id and s.status <> 'Batal'), 0) as pendapatan_sewa,
  coalesce((select sum(biaya) from pemeliharaan p where p.kendaraan_id = k.id), 0) as biaya_pemeliharaan
from kendaraan k;

-- Data contoh
insert into pelanggan (nama, no_ktp, no_hp, alamat) values
 ('PT Nusantara Jaya', '3374010000000001', '081234567890', 'Semarang'),
 ('Budi Santoso', '3374010000000002', '082198765432', 'Ungaran');
insert into kendaraan (plat, merek, tahun, tgl_perolehan, harga_perolehan, nilai_residu, umur_ekonomis, tarif_harian) values
 ('H 1001 VV', 'Toyota Alphard', 2023, '2023-01-10', 1100000000, 300000000, 8, 3500000),
 ('H 1002 VV', 'Toyota Innova Zenix', 2024, '2024-03-05', 520000000, 150000000, 8, 1200000);
insert into sewa (pelanggan_id, kendaraan_id, tgl_mulai, tgl_selesai, status) values (1, 1, '2026-09-20', '2026-09-22', 'Selesai');
insert into pemeliharaan (kendaraan_id, tanggal, jenis, biaya, keterangan) values (1, '2026-08-15', 'Servis berkala', 4500000, 'Ganti oli dan filter');

-- Catatan: setelah ini jalankan policy.sql agar frontend (publishable key) bisa mengakses tabel.
alter table pelanggan enable row level security;
alter table kendaraan enable row level security;
alter table sewa enable row level security;
alter table pemeliharaan enable row level security;

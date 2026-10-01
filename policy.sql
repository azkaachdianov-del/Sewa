-- Jalankan SETELAH schema.sql: Supabase > SQL Editor > New query > Run
-- Karena frontend memakai publishable key (role anon), RLS perlu policy agar data bisa dibaca/ditulis.
-- PERINGATAN: policy ini membuka akses penuh untuk siapa saja yang punya key. Cocok untuk tugas/demo.
-- Untuk dipakai sungguhan, tambahkan Supabase Auth (login) lalu ganti "anon" menjadi "authenticated".
create policy "akses pelanggan"    on pelanggan    for all to anon using (true) with check (true);
create policy "akses kendaraan"    on kendaraan    for all to anon using (true) with check (true);
create policy "akses sewa"         on sewa         for all to anon using (true) with check (true);
create policy "akses pemeliharaan" on pemeliharaan for all to anon using (true) with check (true);

grant select, insert, update, delete on pelanggan, kendaraan, sewa, pemeliharaan to anon;
grant select on v_persediaan to anon;

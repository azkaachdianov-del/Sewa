// Koneksi Vilza VVIP Rental Transport ke Supabase.
// Tanpa Node.js dan tanpa npm: file ini dimuat langsung oleh frontend/index.html dan berjalan di browser.
// Alur: halaman web -> backend/app.js -> Supabase (database di cloud)

// Isi dari Supabase: Project Settings > API
// Pakai PUBLISHABLE key (sb_publishable_...). JANGAN pakai secret key di file ini.
const SUPABASE_URL = 'https://qjnwpmzabwdojqobhxyu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OinbNXi6GRxzyjnX9S0Isg_mCOSoa3W';

// jalur: 'tabel', 'tabel/id', atau 'tabel?select=...&order=...'
async function dbRequest(metode, jalur, body) {
  if (!/^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL) || !SUPABASE_KEY || /XXXX|ISI_/.test(SUPABASE_KEY))
    throw new Error('SUPABASE_URL / SUPABASE_KEY di backend/app.js belum diisi dengan benar');
  const [lokasi, query = ''] = jalur.split('?');
  const [tabel, id] = lokasi.split('/');
  const q = new URLSearchParams(query);
  if (id) q.set('id', 'eq.' + id);
  return fetch(`${SUPABASE_URL}/rest/v1/${tabel}?${q}`, {
    method: metode,
    body: body ? JSON.stringify(body) : undefined,
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
  });
}

const $ = s => document.querySelector(s);
const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
async function api(m, p, b) {
  const r = await dbRequest(m, p, b); // dbRequest ada di backend/app.js
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error((d && d.message) || 'Permintaan gagal');
  return d;
}

// Field: [nama, label, tipe, tabelFK, kolomLabelFK]; tipe: text|number|date|rp|rpx(baca saja)|select|fk
const E = {
  kendaraan: { judul: 'Kendaraan', q: 'select=*&order=id', f: [
    ['plat','Plat'], ['merek','Merek'], ['tahun','Tahun','number'], ['tgl_perolehan','Tgl perolehan','date'],
    ['harga_perolehan','Harga perolehan','rp'], ['nilai_residu','Nilai residu','rp'], ['umur_ekonomis','Umur (tahun)','number'],
    ['tarif_harian','Tarif per hari','rp'], ['status','Status','select',['Tersedia','Disewa','Perawatan']]] },
  pelanggan: { judul: 'Pelanggan', q: 'select=*&order=id', f: [
    ['nama','Nama'], ['no_ktp','No. KTP'], ['no_hp','No. HP'], ['alamat','Alamat']] },
  sewa: { judul: 'Transaksi Sewa', q: 'select=*,pelanggan(nama),kendaraan(plat)&order=id.desc', f: [
    ['pelanggan_id','Pelanggan','fk','pelanggan','nama'], ['kendaraan_id','Kendaraan','fk','kendaraan','plat'],
    ['tgl_mulai','Tgl mulai','date'], ['tgl_selesai','Tgl selesai','date'], ['tarif_harian','Tarif per hari','rpx'],
    ['total_sewa','Total sewa','rpx'], ['status','Status','select',['Berjalan','Selesai','Batal']]] },
  pemeliharaan: { judul: 'Pemeliharaan', q: 'select=*,kendaraan(plat)&order=tanggal.desc', f: [
    ['kendaraan_id','Kendaraan','fk','kendaraan','plat'], ['tanggal','Tanggal','date'], ['jenis','Jenis'],
    ['biaya','Biaya','rp'], ['keterangan','Keterangan']] }
};

const nav = $('#nav');
['laporan', ...Object.keys(E)].forEach(k => {
  const b = document.createElement('button');
  b.textContent = k === 'laporan' ? 'Laporan Persediaan' : E[k].judul;
  b.onclick = () => buka(k);
  b.dataset.k = k;
  nav.appendChild(b);
});

async function buka(k) {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('aktif', b.dataset.k === k));
  $('#judul').textContent = k === 'laporan' ? 'Laporan Persediaan Armada' : E[k].judul;
  $('#app').innerHTML = 'Memuat...';
  try { await (k === 'laporan' ? laporan() : crud(k)); }
  catch (e) {
    const mati = e instanceof TypeError; // fetch gagal total = tidak ada koneksi
    $('#app').innerHTML = `<p>Gagal memuat: ${mati ? 'tidak dapat terhubung ke Supabase. Periksa koneksi internet, serta URL dan key di <code>backend/app.js</code>.' : e.message}</p>`;
  }
}

async function laporan() {
  const r = await api('GET', 'v_persediaan?order=id');
  const jml = k => r.reduce((a, x) => a + Number(x[k]), 0);
  const laba = jml('pendapatan_sewa') - jml('biaya_pemeliharaan');
  const kartu = [['Harga perolehan', jml('harga_perolehan')], ['Akumulasi penyusutan', jml('akumulasi_penyusutan')],
    ['Nilai buku persediaan', jml('nilai_buku')], ['Pendapatan sewa', jml('pendapatan_sewa')],
    ['Biaya pemeliharaan', jml('biaya_pemeliharaan')], ['Laba kontribusi', laba]];
  const kol = [['plat','Plat'],['merek','Merek'],['status','Status'],['harga_perolehan','Harga perolehan'],['penyusutan_tahunan','Penyusutan/tahun'],
    ['akumulasi_penyusutan','Akumulasi'],['nilai_buku','Nilai buku'],['pendapatan_sewa','Pendapatan'],['biaya_pemeliharaan','Biaya']];
  const teks = ['plat','merek','status'];
  $('#app').innerHTML = `<div class="kartu">${kartu.map(([l, v]) => `<div><small>${l}</small><b>${rp(v)}</b></div>`).join('')}</div>
    <div class="tabel"><table><thead><tr>${kol.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead>
    <tbody>${r.map(x => `<tr>${kol.map(([k]) => teks.includes(k) ? `<td>${x[k]}</td>` : `<td class="angka">${rp(x[k])}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="9">Belum ada kendaraan.</td></tr>'}</tbody>
    <tfoot><tr><td colspan="3">Total</td>${kol.slice(3).map(([k]) => `<td class="angka">${rp(jml(k))}</td>`).join('')}</tr></tfoot></table></div>`;
}

async function crud(k) {
  const c = E[k]; let editId = null; const opsi = {};
  for (const [n, , t, tb, lb] of c.f) if (t === 'fk') opsi[n] = await api('GET', `${tb}?select=id,${lb}&order=id`);
  const rows = await api('GET', `${k}?${c.q}`);
  const input = ([n, l, t = 'text', a, lb]) => t === 'rpx' ? '' : `<label>${l}${
    t === 'select' ? `<select name="${n}">${a.map(o => `<option>${o}</option>`).join('')}</select>`
    : t === 'fk' ? `<select name="${n}" required>${opsi[n].map(o => `<option value="${o.id}">${o[lb]}</option>`).join('')}</select>`
    : `<input name="${n}" type="${t === 'rp' ? 'number' : t}" step="any">`}</label>`;
  const sel = ([n, , t, tb, lb], r) => t === 'fk' ? (r[tb] ? r[tb][lb] : '') : (t === 'rp' || t === 'rpx') ? rp(r[n]) : (r[n] ?? '');
  $('#app').innerHTML = `<form id="f">${c.f.map(input).join('')}<button class="utama">Simpan</button></form>
    <div class="tabel"><table><thead><tr>${c.f.map(x => `<th>${x[1]}</th>`).join('')}<th></th></tr></thead>
    <tbody>${rows.map(r => `<tr>${c.f.map(x => `<td>${sel(x, r)}</td>`).join('')}<td><button class="kecil" data-e="${r.id}">Ubah</button> <button class="kecil" data-h="${r.id}">Hapus</button></td></tr>`).join('') || `<tr><td colspan="${c.f.length + 1}">Belum ada data. Isi formulir di atas lalu pilih Simpan.</td></tr>`}</tbody></table></div>`;
  const form = $('#f');
  form.onsubmit = async e => {
    e.preventDefault();
    const d = {};
    c.f.forEach(([n, , t]) => {
      if (t === 'rpx') return;
      const v = form.elements[n].value;
      d[n] = v === '' ? null : (['number', 'rp', 'fk'].includes(t) ? Number(v) : v);
    });
    try { await api(editId ? 'PATCH' : 'POST', k + (editId ? '/' + editId : ''), d); buka(k); }
    catch (er) { alert('Data belum tersimpan: ' + er.message); }
  };
  $('#app').onclick = async e => {
    const h = e.target.dataset.h, u = e.target.dataset.e;
    if (h && confirm('Hapus data ini?')) { try { await api('DELETE', `${k}/${h}`); buka(k); } catch (er) { alert('Gagal menghapus: ' + er.message); } }
    if (u) {
      const r = rows.find(x => x.id == u); editId = u;
      c.f.forEach(([n, , t]) => { if (t !== 'rpx') form.elements[n].value = r[n] ?? ''; });
      form.querySelector('button').textContent = 'Simpan perubahan'; form.scrollIntoView();
    }
  };
}

buka('laporan');

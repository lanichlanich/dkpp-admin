# Proyeksi pensiun pegawai

Menu: **Kepegawaian > Proyeksi Pensiun**, `/dashboard/proyeksi-pensiun`.
Izin menu: `proyeksi-pensiun`. Administrator mendapat akses; pengguna lain
diberi izin melalui Manajemen User, mengikuti mekanisme menu yang tersedia.
API unduhan memeriksa izin yang sama sebelum membaca data pegawai.

## Acuan kebutuhan

`src/data/retirement-position-map-2026.json` menyimpan salinan terstruktur dari
**PETA JABATAN DKPP 2026 (3).pdf**, Kep. Bupati Indramayu
100.3.3.2/Kep.197/Org/2026 tanggal 30 Maret 2026. SHA-256 sumber disertakan.
Ada **179 penempatan**, termasuk tiga baris tanpa nomor dan lima penempatan
dengan kebutuhan nol. Total kebutuhan 253: Fungsional 108, Pelaksana 97,
Struktural 48. Angka kebutuhan bukan jumlah pegawai aktual.

Ekstraksi dapat diulang dengan Python + pdfplumber:

```
python scripts/import-retirement-position-map.py "path/to/PETA JABATAN DKPP 2026 (3).pdf"
```

Hubungan unit mengikuti bagan dan urutan tabel. Kepala Subbag TU serta
pelaksana bawahannya ditempatkan pada Subbag TU UPTD masing-masing.
Nama yang melintasi batas sel (Lohbener/Krangkeng) diambil dari judul unit
lengkap di sumber; baris 71 dibaca dari lapisan teks halaman yang sama.
Nomor dan halaman asli dipertahankan. Acuan ini bersifat versi tetap,
tidak mengubah master jabatan, unit, atau data pegawai. Tidak ada tabel baru
atau perubahan skema database yang diperlukan.

## Perhitungan

- Pegawai berstatus **Aktif**. Unit memakai unit organisasi jabatan terhubung,
  dengan fallback ke unit jabatan atau data pegawai.
- Pencocokan harus tepat pada **nama jabatan + unit**, setelah normalisasi
  kapital, tanda baca, awalan JF, singkatan TU, urutan jenjang, dan alias
  administratif Sekretaris Dinas/Alsintan. Tidak ada pencocokan perkiraan
  antarunit atau penyamaan Penata/Pengelola/Operator Layanan Operasional.
- Jenis jabatan penempatan mengikuti peta. Jenis yang berbeda pada data
  pegawai diberi catatan verifikasi, tanpa mengubah data asal.
- BUP/TMT menggunakan helper `retirement-age.ts`. Tanggal lahir berasal dari
  NIP 18 digit yang valid. TMT: tanggal satu bulan setelah ulang tahun BUP.
  Eselon struktural mengikuti penempatan pada peta jabatan.
- Default lima tahun kalender berikutnya; tahun awal dapat dipilih 2000–2095.
  Jendela inklusif 1 Januari tahun awal sampai 31 Desember tahun kelima.
- Sisa akhir tahun = keterisian aktif terpetakan dikurangi pegawai dengan
  TMT sampai akhir tahun tersebut, termasuk TMT sebelum awal periode.
  TMT yang belum diketahui tetap termasuk sisa, disertai catatan verifikasi.
- Kekurangan = `max(0, kebutuhan - sisa)` untuk **setiap penempatan**, lalu
  dijumlahkan. Kelebihan pada penempatan lain tidak menghapus kekurangan.
- Pegawai belum terpetakan tetap masuk detail pensiun/verifikasi. Mereka
  tidak otomatis mengisi formasi suatu penempatan. Angka pensiun keseluruhan
  dapat lebih besar daripada total pensiun pada rekap yang terpetakan.
- PPPK/PPPK PW: hasil adalah proyeksi BUP jabatan, bukan akhir kontrak.
- Tidak mengasumsikan penerimaan, mutasi, atau kenaikan jenjang berikutnya.
- Pencarian nama/NIP menampilkan rekap penempatan beserta seluruh pengisinya;
  kebutuhan dan selisih saat filter aktif hanya menggambarkan cakupan itu.

## Unduhan dan pemeriksaan

Excel memiliki empat sheet: Ringkasan, Rekap Jabatan, Pegawai Pensiun,
Perlu Verifikasi. PDF berisi bagian yang sama dengan header tabel berulang
dan nomor halaman. NIP tetap teks di Excel. Kedua format memuat seluruh
hasil filter, tidak dibatasi halaman pagination. Data dibaca kembali di
server saat unduhan sehingga perubahan pegawai terbaru langsung berlaku.
Respons dokumen `private, no-store` dan `nosniff`.

```
npm run smoke:retirement-projection
npm run build -- --webpack
```

Smoke test mencakup rekonsiliasi sumber, batas periode, ulang tahun Desember,
pemisahan unit, BUP struktural, alias jenjang, pegawai tidak aktif, data tidak
valid, penempatan kosong/nol, kekurangan per penempatan, izin 401/403,
validasi filter 422, NIP teks, dan kedua format unduhan.

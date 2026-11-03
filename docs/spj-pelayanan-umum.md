# SPJ Pelayanan Umum Kantor

Menu **Umum → SPJ Pelayanan Umum Kantor** menghasilkan dua PDF A4 lanskap dari satu SPJ tersimpan: daftar hadir dan daftar penerimaan honor.

Format cetak mengikuti lampiran, tanpa subjudul jenis tenaga, legenda, nomor halaman, atau jabatan tambahan pada penandatangan. Penerimaan memakai lampiran revisi terakhir (SHA-256 `14ede9c779fec23d08e089f8bd0ffc56447bde671be05b674da525ed4a88ce3f`): nominal memakai posisi accounting dengan `Rp` di kiri dan angka di kanan area A8:B8; PA pada B:D, PPTK pada E:H, dan Bendahara pada I:K; nama digarisbawahi dan NIP berada pada baris berikutnya. Label PA adalah **Pengguna Anggaran**, sesuai revisi terakhir. Setiap lembar penerimaan yang memuat sebagian petugas memiliki nominal dan terbilang yang sama dengan jumlah baris pada lembar tersebut.

## Penggunaan

1. Atur jenis tenaga pada tab **Jenis tenaga**: kuota hari per bulan atau seluruh hari kerja, pilihan Senin–Jumat, serta honor per hari.
2. Tambah/edit/hapus petugas pada tab **Petugas**. Petugas nonaktif tidak dimasukkan ke SPJ baru. Nomor rekening disimpan sebagai teks agar nol di depan tetap utuh.
3. Pada **Buat SPJ**, pilih jenis tenaga, bulan, tanggal dokumen, dan tiga pegawai penandatangan. Nama dan NIP diambil kembali dari database pegawai aktif pada server.
4. Periksa pratinjau, gunakan **Acak ulang hari aktif** bila diperlukan, kemudian simpan dan unduh kedua PDF.
5. Unduh kembali melalui **Arsip SPJ**. Perubahan/hapus data petugas atau jenis tenaga tidak mengubah dokumen lama. Hapus arsip memerlukan konfirmasi.

Warna daftar hadir: putih untuk pengisian hari aktif, merah untuk Sabtu/Minggu atau libur nasional, abu gelap untuk hari nonaktif. Jadwal berlaku sama untuk petugas dalam jenis dan SPJ yang dipilih. Honor penerimaan = hari aktif × honor per hari; jumlah seluruh petugas dan terbilang dihitung pada server.

Default penandatangan: pemegang Plt. Kepala Dinas yang masih berlaku pada tanggal hari ini, atau pegawai aktif dengan jabatan Kepala Dinas; PPTK dari Sekretaris Dinas; Bendahara dari Ufi Najarudin Lutfi. Semua dapat diganti melalui pencarian pegawai. Status definitif/Plt. Pengguna Anggaran dipilih untuk dokumen tersebut.

## Kalender

Kalender nasional tersedia untuk **2026 dan 2027**, sesuai sumber resmi:

- [SKB/libur nasional 2026, Kemenko PMK](https://www.kemenkopmk.go.id/node/5862)
- [SKB/libur nasional 2027, Kemenko PMK](https://www.kemenkopmk.go.id/node/6444)

Cuti bersama tidak otomatis dikecualikan karena permintaan adalah libur nasional. Tahun yang belum memiliki kalender resmi dalam aplikasi ditolak; jangan menganggap tahun tersebut bebas libur. Tambahkan kalender pada `src/lib/spj-calendar.ts`, perluas rentang input bulan, dan uji sebelum menambah tahun baru. Jumlah tanggal mengikuti bulan termasuk tahun kabisat. Kuota yang melebihi jumlah hari yang memenuhi aturan ditolak dengan pesan jumlah hari tersedia.

## Penyimpanan dan akses

- Izin menu: `spj-pelayanan-umum`. Administrator memiliki akses; role/pengguna lain harus mendapat izin menu melalui manajemen pengguna. Semua page dan API dilindungi server.
- Tiga tabel: `spj_service_types`, `spj_service_workers`, `spj_service_reports`; SQLite lokal dan PostgreSQL produksi memakai skema yang sepadan.
- Migrasi `20261103033127_add_spj_pelayanan_umum.sql` memasang tabel di skema privat `adminflow`, RLS, pencabutan hak Data API, dan kebijakan penolakan eksplisit bagi `anon`/`authenticated`. Versi berkas disesuaikan dengan versi aktual yang dicatat Supabase setelah penerapan.
- Migrasi `20261103043537_index_spj_archive_pagination.sql` menambahkan indeks urutan arsip tanpa mengubah data SPJ.
- Data awal: Tenaga Penyemprot, 10 hari/bulan, Senin–Jumat, Rp125.000/hari, serta dua nama petugas pada contoh. Angka 10 mengikuti instruksi pengguna, menggantikan volume 12 hari pada contoh penerimaan.
- Rekening asli lampiran diimpor langsung ke database privat, bukan disertakan dalam kode/migrasi GitHub. Database lokal lama tetap menyimpan nilai yang telah diimpor; instalasi baru dapat mengisi melalui Edit petugas.
- Arsip menyimpan salinan identitas, rekening, aturan, jadwal, honor, dan penandatangan saat pembuatan. Kedua PDF dirender dari salinan ini, bukan data master terbaru. Unduhan memerlukan sesi dan izin menu serta memakai `private, no-store`.
- Versi data master diperiksa saat penyimpanan dan pada perintah INSERT arsip untuk mencegah pratinjau lama disimpan ketika master berubah. ID permintaan mencegah penyimpanan ganda ketika permintaan diulang.
- Tabel masuk log audit dan kategori **Umum** pada backup lokal/Google Drive. Arsip PDF dapat dirender kembali dari data JSON setelah pemulihan.
- Maksimal 500 petugas/SPJ; halaman PDF berulang memuat header dan penandatangan. Arsip memiliki kolom jenis tenaga tersendiri, pencarian seluruh riwayat berdasarkan jenis tenaga/bulan/tahun, dan pagination bernomor dengan 10/20/50/100 baris per halaman (default 20). Filter dan halaman disimpan pada URL; hasil diurutkan berdasarkan `created_at DESC, id DESC` agar tetap konsisten ketika waktu pembuatan sama. Halaman yang sudah tidak tersedia setelah penghapusan otomatis dibatasi ke halaman terakhir. Indeks `spj_service_reports_archive_idx` mendukung urutan tersebut; pagination bernomor memakai LIMIT/OFFSET untuk akses langsung ke halaman yang dipilih.

## Validasi

`npm.cmd run smoke:spj` memeriksa kalender, kuota, pengacakan, tanggal 28/29/30/31, sumber pegawai, CRUD dan konfirmasi, konflik perubahan, arsip setelah master dihapus, PDF beberapa halaman, dan akses API 401/403. Pengujian memakai database terpisah dan rekening sintetis. Validasi PDF visual menggunakan hasil render, termasuk warna sel, rekening, terbilang, dan penandatangan.

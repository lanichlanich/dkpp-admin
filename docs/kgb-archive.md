# Edit arsip dan SK KGB bertanda tangan

Pada **Daftar Dokumen SK KGB**, **Edit** membuka form yang sama dengan pembuatan SK, terisi dari data tersimpan. Nomor/tanggal surat, dasar KGB lama, masa kerja, TMT, dan penandatangan dapat diperbarui. Identitas pegawai mengikuti NIP arsip. Perhitungan gaji baru dan syarat PNS aktif tetap diperiksa pada server. Simpan membuat ulang Word menggunakan template KGB yang ada, memperbarui record arsip yang sama, lalu mengunduh hasilnya.

Untuk arsip sebelum fitur ini, data form dipulihkan dari label yang dikenali dalam Word asli. Nomor, tanggal surat dan NIP tetap mengikuti metadata arsip. Nilai yang tidak dapat dikenali dibiarkan kosong untuk dilengkapi; dokumen tidak diubah saat form dibuka. Rincian lengkap disimpan pada `kgb_documents.input_json` setelah dokumen dibuat atau diedit.

**Upload SK TTD** menerima PDF yang sudah ditandatangani, maksimal batas bersama `MAX_UPLOAD_SIZE_MB` (2 MB). Server memeriksa ekstensi, tipe, ukuran, signature PDF, keterbacaan, halaman, dan revisi dokumen. PDF disimpan dan diunduh kembali dengan byte asli. Sistem tidak melakukan penandatanganan maupun verifikasi kriptografi tanda tangan.

Unggahan bersifat tambahan. Setiap PDF terikat pada versi Word saat diunggah. Edit Word tidak menimpa atau menghapus PDF yang pernah diunggah. Arsip menandai PDF yang sesuai versi sekarang, atau **Versi lama** jika Word telah diedit. Nomor revisi diperiksa saat edit dan upload; perubahan yang kalah dalam penyimpanan bersamaan menghasilkan HTTP 409 dan berkas baru dibersihkan.

Penyimpanan metadata memakai SQLite lokal/Postgres produksi. Word memakai `data/kgb-documents`, PDF memakai `data/kgb-signed-documents`, atau bucket Supabase privat di produksi. Semua route edit/upload/download memerlukan sesi dan izin menu `kgb`. Unduhan memakai `private, no-store`; nama Storage berupa UUID. Berkas baru dibersihkan ketika penyimpanan database gagal. Word lama dibersihkan hanya setelah pembaruan arsip berhasil; kegagalan pembersihan tidak membatalkan pembaruan yang telah tersimpan.

Migrasi `add_kgb_edit_and_signed_documents` menambah input/revisi/informasi edit pada `kgb_documents` dan tabel `kgb_signed_documents`. Record lama tetap tersedia dengan revisi awal 1. Tabel PDF memakai RLS dan akses API publik dicabut, mengikuti sesi aplikasi serta koneksi server privat. Kedua arsip, metadata input, dan PDF terhubung ke audit serta backup lokal/Google Drive/ekspor-migrasi.

Verifikasi: `npm run smoke:kgb-archive`, `smoke:signatory`, `smoke:letter-classification`, `smoke:user-management`, `smoke:local-backup`, `smoke:google-drive-backup`, dan build Webpack. Pengujian arsip mencakup pemulihan Word lama, pembaruan seluruh form, regenerasi dan unduh Word identik, byte PDF asli dan versi lama, transaksi gagal/konflik, auth/izin, cakupan parent, file rusak/terlalu besar, serta isian tanggal/angka wajib.

## Dokumen pegawai dan pengingat berikutnya

Tombol **Unduh SK TTD** tersedia langsung pada daftar SK KGB setelah ada unggahan. Tombol memilih PDF terbaru untuk revisi Word sekarang, atau PDF versi lama terbaru jika belum ada PDF untuk revisi sekarang. Riwayat seluruh PDF tetap tersedia dalam dialog unggahan.

Setiap PDF otomatis ditampilkan sebagai **SK KGB Bertanda Tangan** pada dokumen pegawai sesuai NIP, termasuk unduhan ZIP **Download semua**. Tautan menggunakan objek PDF asli; tidak ada salinan file atau record manual di `employee_documents`. Metadata tautan tidak diedit/dihapus melalui form dokumen pegawai. Unduhan melalui dokumen pegawai memerlukan izin `pegawai`, sedangkan unduhan melalui arsip KGB memerlukan izin `kgb`; keduanya memeriksa cakupan NIP/parent dan tetap privat.

Nomor, tanggal surat, NIP, dan TMT disimpan sebagai metadata PDF saat diunggah. TMT mengikuti isian Word saat unggah dan diperiksa server. Pengeditan draft berikutnya tidak mengubah metadata PDF maupun jadwalnya. Migrasi `link_signed_kgb_to_employees_and_reminders` mengisi data arsip lama yang dapat dipastikan berasal dari revisi sama. PDF versi lama yang TMT-nya tidak dapat dipastikan menyediakan **Lengkapi TMT** satu kali; tanggal tidak ditebak dari draft baru.

Jadwal berikutnya adalah **TMT SK bertanda tangan + 2 tahun kalender** (29 Februari menjadi 28 Februari bila perlu). Untuk setiap PNS aktif dipilih TMT bertanda tangan paling baru, bukan waktu unggah paling baru. Dashboard menampilkan yang jatuh tempo dalam 90 hari atau sudah terlewat, sedangkan halaman KGB menampilkan seluruh jadwal beserta pencarian/pagination. Ringkasan TMT juga tampil di dokumen pegawai. Notifikasi aplikasi diselaraskan ketika halaman dashboard dibuka, bagi pengguna berizin `kgb` atau `pegawai`; tidak ada pengiriman email/background job. Notifikasi tidak digandakan dan status dibaca dipertahankan pada fase yang sama. Fase hari jatuh tempo/terlewat membuat pengingat baru; SK pengganti, pegawai tidak aktif, atau pencabutan izin membersihkan pengingat lama.

`npm run smoke:kgb-links` menguji byte PDF/ZIP, izin dan cakupan NIP, tautan hanya baca, pemilihan TMT SK, tanggal kabisat, batas 90 hari, serta deduplikasi/status dibaca/pergantian fase/penyelesaian notifikasi.

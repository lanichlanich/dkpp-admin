# Edit arsip dan SK KGB bertanda tangan

Pada **Daftar Dokumen SK KGB**, **Edit** membuka form yang sama dengan pembuatan SK, terisi dari data tersimpan. Nomor/tanggal surat, dasar KGB lama, masa kerja, TMT, dan penandatangan dapat diperbarui. Identitas pegawai mengikuti NIP arsip. Perhitungan gaji baru dan syarat PNS aktif tetap diperiksa pada server. Simpan membuat ulang Word menggunakan template KGB yang ada, memperbarui record arsip yang sama, lalu mengunduh hasilnya.

Untuk arsip sebelum fitur ini, data form dipulihkan dari label yang dikenali dalam Word asli. Nomor, tanggal surat dan NIP tetap mengikuti metadata arsip. Nilai yang tidak dapat dikenali dibiarkan kosong untuk dilengkapi; dokumen tidak diubah saat form dibuka. Rincian lengkap disimpan pada `kgb_documents.input_json` setelah dokumen dibuat atau diedit.

**Upload SK TTD** menerima PDF yang sudah ditandatangani, maksimal batas bersama `MAX_UPLOAD_SIZE_MB` (2 MB). Server memeriksa ekstensi, tipe, ukuran, signature PDF, keterbacaan, halaman, dan revisi dokumen. PDF disimpan dan diunduh kembali dengan byte asli. Sistem tidak melakukan penandatanganan maupun verifikasi kriptografi tanda tangan.

Unggahan bersifat tambahan. Setiap PDF terikat pada versi Word saat diunggah. Edit Word tidak menimpa atau menghapus PDF yang pernah diunggah. Arsip menandai PDF yang sesuai versi sekarang, atau **Versi lama** jika Word telah diedit. Nomor revisi diperiksa saat edit dan upload; perubahan yang kalah dalam penyimpanan bersamaan menghasilkan HTTP 409 dan berkas baru dibersihkan.

Penyimpanan metadata memakai SQLite lokal/Postgres produksi. Word memakai `data/kgb-documents`, PDF memakai `data/kgb-signed-documents`, atau bucket Supabase privat di produksi. Semua route edit/upload/download memerlukan sesi dan izin menu `kgb`. Unduhan memakai `private, no-store`; nama Storage berupa UUID. Berkas baru dibersihkan ketika penyimpanan database gagal. Word lama dibersihkan hanya setelah pembaruan arsip berhasil; kegagalan pembersihan tidak membatalkan pembaruan yang telah tersimpan.

Migrasi `add_kgb_edit_and_signed_documents` menambah input/revisi/informasi edit pada `kgb_documents` dan tabel `kgb_signed_documents`. Record lama tetap tersedia dengan revisi awal 1. Tabel PDF memakai RLS dan akses API publik dicabut, mengikuti sesi aplikasi serta koneksi server privat. Kedua arsip, metadata input, dan PDF terhubung ke audit serta backup lokal/Google Drive/ekspor-migrasi.

Verifikasi: `npm run smoke:kgb-archive`, `smoke:signatory`, `smoke:letter-classification`, `smoke:user-management`, `smoke:local-backup`, `smoke:google-drive-backup`, dan build Webpack. Pengujian arsip mencakup pemulihan Word lama, pembaruan seluruh form, regenerasi dan unduh Word identik, byte PDF asli dan versi lama, transaksi gagal/konflik, auth/izin, cakupan parent, file rusak/terlalu besar, serta isian tanggal/angka wajib.

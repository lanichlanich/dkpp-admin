# DKPP-Admin

Dashboard administrasi kepegawaian dengan pembuatan dokumen KGB/DPCP/WFH dan pembacaan dokumen menggunakan Google Gemini.

## Menjalankan aplikasi

```powershell
npm.cmd run dev
```

Buka http://localhost:3000. Launcher Windows tersedia di scripts/start-adminflow.ps1.

## Gemini

Simpan konfigurasi hanya di .env.local (diabaikan Git), lalu mulai ulang server bila diperlukan:

```dotenv
GEMINI_API_KEY=isi_kunci_anda
GEMINI_MODEL=gemini-3.1-flash-lite
```

Jangan gunakan awalan NEXT_PUBLIC untuk API key. Pemanggilan Gemini berlangsung di server.

Salin `.env.example` menjadi `.env.local`, lalu isi API key hanya di lingkungan lokal atau pengaturan Environment Variables Vercel.

Baca & isi form mengirim PDF, gambar, atau teks dan gambar dalam DOCX ke Google Gemini. Maksimal 5 file, 2 MB per file, dan total 2 MB. DOC lama perlu dikonversi ke DOCX/PDF. Hasil hanya mengisi draf kosong, wajib diperiksa sebelum simpan/generasi. Identitas yang tidak cocok mengosongkan hasil ekstraksi. Endpoint lama /api/local-ai/extract menjadi alias ke Gemini; Ollama tidak lagi diperlukan.

## Laporan WFH

Menu Laporan WFH memilih pegawai aktif, menampilkan jabatan/unit, meminta empat usulan tugas Gemini, dan memungkinkan penyuntingan. Realisasi dan persentase diisi pengguna. Setelah konfirmasi pemeriksaan, laporan DOCX dibuat dari template sumber, disimpan dalam arsip milik pengguna, dan dapat diunduh ulang dengan autentikasi. Tanpa Gemini, laporan tetap dapat diisi manual.

## Surat Perbantuan

Menu **Persuratan → Surat Perbantuan** menggunakan `src/templates/template-surat-perbantuan.docx`. Pilih pegawai aktif untuk mengisi nama, NIP, pangkat, golongan, jabatan, dan unit kerja dari database. Isi nomor urut surat, tanggal penetapan secara manual, jabatan perbantuan, serta unit kerja tujuan. Nomor mengikuti awalan dan akhiran pada template: `800.1.11.1 / nomor / Sekret.`

Dokumen DOCX tersimpan di arsip dan dapat diunduh ulang oleh pengguna dengan akses menu Surat Perbantuan. Identitas pegawai diperiksa ulang di server. Kop, isi tetap, serta penandatangan mengikuti template sumber; paragraf kosong di akhir dihapus dan bagian tembusan dijaga tetap bersama. Data dan file arsip ikut backup kategori Persuratan.

SQLite membuat tabel arsip secara otomatis. Untuk lingkungan PostgreSQL, terapkan migrasi `supabase/migrations/20261026021735_add_surat_perbantuan_documents.sql` sebelum menjalankan versi baru. Tabel arsip hanya diakses melalui server aplikasi, dengan RLS aktif dan akses Data API publik dicabut.

## Daftar Plt.

**Kepegawaian → Daftar Plt.** mencatat pegawai, jabatan/unit Plt., nomor SK atau surat tugas, tanggal mulai, dokumen SK, dan catatan. Unggah SK dalam format PDF, DOC, atau DOCX maksimal **2 MB**. Berkas tersimpan privat dan hanya dapat diunduh melalui aplikasi oleh pengguna yang memiliki akses Daftar Plt. Saat edit, file lama tetap dipakai jika tidak diganti; perpanjangan memerlukan unggahan SK baru. Data dan berkas SK ikut backup Kepegawaian.

Satu periode berlangsung tiga bulan kalender (tanggal mulai termasuk); tanggal akhir dihitung satu hari sebelum tanggal mulai tiga bulan berikutnya, dengan penyesuaian akhir bulan. Contoh: 27 Oktober 2026–26 Januari 2027.

Pengingat di daftar dan dashboard muncul mulai H-14, pada hari terakhir, dan sesudah habis berdasarkan WIB. Perpanjangan **+3 bulan** memerlukan nomor SK baru, dimulai sehari setelah periode sebelumnya, dan tidak menghapus riwayat. Periode yang sudah diperpanjang tidak dapat diedit/dihapus sebelum periode lanjutannya dihapus. Gunakan **Selesai** untuk menghentikan pengingat penugasan yang telah berakhir lebih awal.

Administrator memiliki akses otomatis. Izin **Daftar Plt.** untuk role/pengguna lain diatur melalui Manajemen User; halaman, API, serta data pengingat dashboard memeriksa izin yang sama. Data tidak mengubah jabatan utama pegawai, tercatat dalam audit, dan ikut backup Kepegawaian. Pengingat ditampilkan di dalam aplikasi; tidak mengirim email atau pesan eksternal.

SQLite membuat tabel dan memperbarui kolom otomatis. PostgreSQL menggunakan migrasi `supabase/migrations/20261027024952_add_plt_assignments.sql` dan migrasi tambahan `add_plt_assignment_documents`, dengan RLS aktif dan akses `anon`/`authenticated` dicabut. Uji fungsi terisolasi: `npm.cmd run smoke:plt`.

## Verifikasi

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run smoke:wfh-report
npm.cmd run smoke:gemini
npm.cmd run smoke:surat-perbantuan
```

smoke:gemini menggunakan layanan Gemini dan kuota proyek dengan dokumen uji sintetis.

## Data produksi

Database SQLite, arsip dokumen, backup, nilai `.env.local`, dan `src/data/pegawai.json` tidak disimpan di Git. Data pegawai produksi dipulihkan melalui proses migrasi database; repository publik tidak berisi seed pegawai nyata.

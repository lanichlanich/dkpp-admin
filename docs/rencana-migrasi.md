# Rencana migrasi AdminFlow ke GitHub, Vercel, dan Supabase

Tanggal audit: 23 September 2026. Status: rencana berdasarkan pemeriksaan kode dan database lokal secara baca-saja; belum melakukan backup, migrasi, push, atau deployment.

## 1. Hasil pemeriksaan saat ini

Next.js 16.3.4, React 19.2.8, database `better-sqlite3` di `data/admin.db`, mode WAL. Dokumen disimpan di disk lokal. Login menggunakan bcrypt dan sesi berbasis token acak yang hash-nya disimpan dalam database, bukan Supabase Auth.

| Tabel | Jumlah baris |
|---|---:|
| users | 2 |
| sessions | 1 |
| employees | 291 |
| notifications | 49 |
| employee_documents | 25 |
| dpcp_documents | 2 |
| pak_documents | 1 |
| official_statement_documents | 4 |
| surat_pengantar_documents | 1 |
| wfh_reports | 2 |
| kgb_documents | 0 |
| wfh_documents | 0 |
| hukdis_records | 0 |

Ada 35 berkas pada delapan direktori arsip, total 20.985.555 byte, sekitar 20 MiB. Semua 35 referensi berkas database ditemukan di disk. SQLite `integrity_check` menghasilkan `ok`; `foreign_key_check` tidak menemukan pelanggaran. Ini pemeriksaan awal keberadaan/integritas database, belum pembandingan hash berkas atau uji seluruh fitur. Jumlah final harus diambil ulang ketika input dihentikan saat perpindahan.

Temuan khusus:

- Banyak kode aplikasi masih untracked; jangan menganggap commit yang sekarang sudah berisi semua fitur.
- `.gitignore` belum menutup `data/official-statement-documents/` dan `.tmp/`. `src/data/pegawai.json` mengandung data pegawai dan diimpor otomatis oleh `db.ts` ketika tabel kosong. Pisahkan data nyata dari source sebelum push; audit template dan seluruh riwayat Git untuk data pribadi serta rahasia.
- Pembuatan tabel dan migrasi SQLite masih dijalankan saat modul diimpor; tabel `wfh_reports` dibuat terpisah di `wfh-report-store.ts`. Keduanya wajib masuk inventaris migrasi.
- Ekstraksi dokumen saat ini menggunakan Gemini. `local-document-ai.ts` hanya meneruskan panggilan ke Gemini; jangan merancang deployment dengan asumsi masih menggunakan Ollama.
- Upload dokumen dan total dokumen sumber untuk ekstraksi menerima hingga 2 MB. Alur request multipart tetap perlu diubah ketika Storage Supabase diterapkan.

## 2. Arsitektur tujuan

GitHub private menyimpan source, lockfile, template yang sudah diperiksa, migrasi schema, dan pengujian. Vercel menjalankan UI, Server Actions, Route Handlers, generator DOCX dan integrasi Gemini. Supabase Postgres menyimpan seluruh data terstruktur; Supabase Storage private menyimpan semua dokumen asli dan hasil generator.

Rekomendasi fase pertama: pertahankan login aplikasi yang ada dan pindahkan tabel users/sessions ke Postgres. Pertahankan ID pengguna dan password hash sehingga akun dan relasi arsip tetap sama. Pengguna login ulang di domain baru karena cookie localhost tidak berpindah domain. Simpan snapshot sessions untuk kelengkapan backup, tetapi jangan mengaktifkan kembali sesi lama di produksi. Perpindahan ke Supabase Auth adalah proyek lanjutan dengan mapping identitas dan pengujian tersendiri, bukan prasyarat penggunaan Database/Storage Supabase.

Gunakan koneksi Postgres server-side melalui transaction pooler untuk runtime Vercel; driver harus kompatibel dengan batas prepared statement pada pooler. Gunakan direct connection atau session pooler yang sesuai untuk migrasi/backup. Jangan menggunakan akun database pemilik proyek untuk query aplikasi sehari-hari.

Dengan login custom, cookie aplikasi tidak otomatis menjadi identitas `auth.uid()` Supabase. Gunakan schema aplikasi yang tidak diekspos Data API, role database khusus dengan hak minimum, serta pemeriksaan akses di server. Audit dan pertahankan perbedaan arsip yang dapat dibaca bersama dengan arsip milik pengguna tertentu. Jika ada tabel pada schema exposed, aktifkan RLS dan grant/policy yang sesuai; jangan memberi akses publik agar query berhasil.

Storage diakses server dengan secret server-only; karena akses istimewa dapat melewati RLS, setiap penerbitan URL upload/download harus memeriksa sesi, izin dokumen, dan object key. Tidak ada secret key dalam variabel `NEXT_PUBLIC_*`.

## 3. Urutan pekerjaan

### Tahap A — Backup yang bisa dipulihkan

1. Buat snapshot kode lengkap termasuk perubahan belum di-commit, delapan template DOCX, referensi gaji, dan konfigurasi yang disimpan terpisah secara aman.
2. Hentikan input dan tunggu request tulis selesai untuk snapshot konsisten antara database dan berkas. Backup SQLite memakai SQLite backup API. Jangan hanya menyalin `admin.db` ketika transaksi WAL masih aktif.
3. Salin seluruh `data/` beserta arsip, lalu buat manifest tiap berkas: lokasi relatif, tabel/ID pemilik, nama asli, MIME, ukuran, SHA-256. Identifikasi juga berkas tanpa referensi; jangan otomatis membuangnya.
4. Simpan minimal dua salinan backup terpisah, salah satunya di luar komputer kerja dengan akses terbatas. Backup tidak masuk repository.
5. Pulihkan salinan ke direktori uji, jalankan integrity check, hitung semua tabel, dan buka berkas hasil restore. Tahap ini selesai hanya setelah restore terbukti berhasil.

### Tahap B — Persiapan GitHub

1. Buat branch migrasi dan baseline commit yang dapat dijalankan kembali. Sebelum menulis kode Next.js, baca panduan versi terpasang di `node_modules/next/dist/docs/` sesuai AGENTS.md.
2. Lengkapi ignore untuk semua database, direktori arsip, backup, hasil ekspor, `.tmp/`, konfigurasi rahasia, dan data pegawai nyata. `.gitignore` tidak menghapus file yang sudah pernah dilacak; periksa index dan history.
3. Lepas import otomatis dataset pegawai nyata; sediakan fixture sintetis untuk tes dan import produksi yang eksplisit. Pertahankan referensi gaji yang diperlukan kalkulasi.
4. Periksa isi template: struktur, kop dan aset yang diperlukan dipertahankan; data pribadi contoh diganti placeholder hanya setelah uji fidelity. Backup template asli disimpan aman.
5. Tambahkan `.env.example` berisi nama variabel tanpa nilai rahasia, dengan pengecualian ignore khusus. Commit lockfile, scripts dan semua source fitur. Jalankan secret scan pada staged files serta history sebelum push repository private.

### Tahap C — Konversi schema dan akses database

1. Buat lingkungan Supabase uji dan produksi terpisah. Tentukan region dan kapasitas berdasarkan lokasi pengguna, pertumbuhan berkas, egress dan kebutuhan backup. Preview Vercel tidak boleh terhubung ke database produksi.
2. Buat migrasi schema eksplisit untuk seluruh 13 tabel, index, unique/check constraint dan foreign key. Tidak ada DDL atau seed otomatis saat cold start/build.
3. Pertahankan ID, NIP dan nomor surat sebagai teks; jangan mengonversi NIP menjadi angka. Pertahankan seluruh status pegawai, bukan hanya Aktif.
4. Konversi `COLLATE NOCASE`, placeholder `?`, `INSERT OR IGNORE`, transaksi SQLite dan query lain ke Postgres dengan perilaku yang setara. Uji keunikan username/email tanpa membedakan huruf besar-kecil. Pertahankan tanggal kalender tanpa pergeseran zona waktu; timestamp gunakan format/zona yang konsisten.
5. PAK: gunakan tipe decimal yang sesuai kebutuhan dan cocokkan pembulatan tiga desimal dengan hasil lama. `input_json` dan `payload` dapat menjadi JSONB setelah validasi; nilai sumber tetap tersedia dalam backup.
6. Refactor `src/lib/db.ts`, semua modul yang mengakses `db`, Server Actions, halaman, sesi, dan route menjadi akses async. Pemisahan repository database dan adapter storage memudahkan audit agar tidak ada jalur SQLite tertinggal.
7. Import data dari snapshot aktual sesuai urutan dependensi dengan transaksi per batch dan laporan. Buat proses dapat diulang berdasarkan primary key, mendeteksi konflik isi, dan tidak menggandakan notifikasi/arsip. Jangan menimpa konflik diam-diam.

### Tahap D — Migrasi dokumen dan semua alur berkas

Gunakan satu bucket private, misalnya `adminflow-documents`, dengan prefix terpisah:

| Sumber lokal | Prefix tujuan |
|---|---|
| data/employee-documents | employee-documents/ |
| data/kgb-documents | kgb-documents/ |
| data/dpcp-documents | dpcp-documents/ |
| data/pak-documents | pak-documents/ |
| data/wfh-documents | wfh-documents/ |
| data/wfh-reports | wfh-reports/ |
| data/surat-pengantar-documents | surat-pengantar-documents/ |
| data/official-statement-documents | official-statement-documents/ |

Pertahankan storage_name/UUID; laporan WFH menggunakan ID ditambah `.docx`. Simpan bucket dan object key stabil dalam metadata, bukan path Windows atau URL bertanda tangan yang akan kedaluwarsa.

1. Upload bytes asli, jangan membuat ulang arsip lama dari template baru. Bandingkan ukuran dan SHA-256 dengan hasil download Storage untuk seluruh berkas.
2. Refactor simpan, lihat, download, penggantian dan penghapusan pada semua modul arsip. Generator membentuk Buffer di memori, menyimpan ke Storage lalu mengaktifkan metadata.
3. Upload browser langsung ke Storage melalui URL/token upload terbatas yang diterbitkan server setelah otorisasi. Finalisasi server memeriksa keberadaan, ukuran, MIME/signature dan kepemilikan; jangan percaya metadata dari browser.
4. Download memeriksa akses lalu mengarahkan ke signed URL berumur pendek, dengan nama file unduhan sesuai arsip. Jangan mengirim dokumen besar melalui response buffer Vercel.
5. Ekstraksi Gemini memakai object key dari upload sementara yang sudah diverifikasi, bukan multipart besar ke Vercel. Server membaca berkas untuk Gemini; batasi ukuran, waktu, retry dan bersihkan objek sementara setelah selesai/kedaluwarsa. Hasil tetap draft yang ditinjau pengguna.
6. Postgres dan Storage tidak memiliki satu transaksi bersama. Gunakan status pending/ready, retry idempoten, dan cleanup terjadwal untuk kegagalan parsial. Saat mengganti file, verifikasi file baru sebelum beralih; hapus versi lama hanya setelah metadata berhasil. Jangan menghapus arsip asli selama masa validasi migrasi.
7. Pastikan template DOCX ikut bundle runtime Vercel. Direktori kerja Vercel tidak menjadi penyimpanan permanen; file sementara bila diperlukan tidak boleh menjadi sumber arsip.

### Tahap E — Pengujian staging

- Rekonsiliasi setiap tabel: jumlah baris, himpunan primary key, nilai kolom setelah normalisasi tipe, relasi, status pegawai, timestamp, dan hash password tanpa menampilkannya di log.
- Rekonsiliasi semua 35 dokumen awal (atau jumlah snapshot final): hash, ukuran, metadata, object key, download resmi; laporkan file yatim atau hilang.
- Login/logout, akun lama, profil, register sesuai kebijakan akses, sesi kedaluwarsa, notifikasi, dashboard, pencarian/filter/paginasi pegawai, status mutasi/pensiun, timeline dan perhitungan BUP.
- KGB, DPCP, PAK, WFH, laporan WFH, surat pengantar, Hukdis/Hukda: isi form, validasi, kalkulasi, generate, arsip, download ulang, edit/hapus yang tersedia. Tabel kosong tetap harus dites dengan fixture staging.
- Dokumen pegawai: semua jenis SK/SKP, batas upload 2 MB, ganti/hapus, aturan jenis ASN, metadata serta keterkaitan dengan pegawai yang benar.
- AI: input PDF/gambar/DOCX, batas 2 MB per file dan total, identitas tidak cocok, timeout/error Gemini, draft dan pengisian manual. Uji URL lama `/api/local-ai/extract` serta alur baru bila masih dipakai.
- Uji tanpa login dan akses pengguna lain untuk operasi baca/tulis/upload/download sesuai matriks izin. Storage private, secret tidak masuk bundle, tidak ada data sensitif pada log.
- Jalankan lint, build, seluruh smoke relevan pada database uji; adaptasi tes yang masih bergantung SQLite. Tambahkan tes KGB dan perpindahan data/storage bila belum tercakup.
- Render contoh hasil DOCX setiap jenis dan periksa setiap halaman, kop, tanda tangan, tabel, tag tersisa, dan part ZIP yang harus tetap identik. Catatan lama menyebut masalah fidelity PAK; itu belum diverifikasi ulang pada audit ini. Jalankan kembali `smoke:pak` dan QA visual sebelum menyatakan lolos.
- Uji deployment aktual untuk cold start, bundle template, waktu generator/AI, limit request, koneksi database, upload berulang dan kegagalan parsial. Build lokal saja tidak cukup.

### Tahap F — Perpindahan produksi dan pemulihan

1. Lulus staging dan latihan restore terlebih dahulu. Catat versi kode, schema, manifest, serta pemilik keputusan cutover.
2. Aktifkan maintenance pada aplikasi lokal, tutup semua jalur tulis termasuk endpoint langsung, tunggu request selesai. Ambil snapshot final baru.
3. Import snapshot final ke produksi yang belum menerima input. Jika memakai sinkronisasi perubahan dari rehearsal, tangani insert/update/delete; jangan hanya menyalin baris baru. Rehearsal tidak menjadi sumber produksi.
4. Ulangi rekonsiliasi seluruh data dan berkas. Target cutover: nol transaksi yang hilang dari snapshot final dan nol dokumen hilang. Jika ada selisih, jangan buka produksi.
5. Jalankan verifikasi baca dan uji tulis terkendali, lalu arahkan pengguna ke domain Vercel. Lokal tetap read-only agar tidak terbentuk dua sumber data yang berbeda.
6. Pantau error login, query, upload, download, generator, AI, koneksi, kapasitas dan backup selama masa awal. Simpan backup lokal sampai masa retensi disepakati dan restore cloud terbukti.

Rollback sebelum ada input produksi: arahkan pengguna kembali ke snapshot lokal yang terverifikasi. Setelah ada input produksi: hentikan tulis cloud, backup Postgres DAN Storage terbaru, rekonsiliasi semua perubahan kembali ke lokal atau lakukan perbaikan maju. Mengaktifkan database lokal lama secara langsung akan menghilangkan transaksi baru. Rollback deployment kode Vercel tidak otomatis melakukan rollback database/storage; siapkan kompatibilitas schema antarversi.

## 4. Backup setelah aktif

Backup database dan objek Storage harus dijalankan terpisah. Simpan salinan di luar proyek Supabase, manifest SHA-256, retensi, dan hasil latihan restore berkala. Sesuaikan frekuensi dengan kehilangan data maksimum yang dapat diterima; backup harian saja tidak menjamin nol kehilangan setelah aplikasi digunakan. Pantau kegagalan backup, kapasitas, dan hasil verifikasi. Detail interval, retensi, RPO/RTO dan paket layanan ditetapkan sebelum produksi dibuka.

## 5. Kriteria selesai

- Semua data bisnis snapshot final identik secara semantik, semua primary key/relasi utuh; sesi aktif lama sengaja tidak diaktifkan kembali dan pengguna login ulang.
- Seluruh bytes arsip lama cocok SHA-256, tersedia dalam daftar dan dapat diunduh oleh pengguna berhak.
- Seluruh fitur lolos matriks regresi dan hasil DOCX lolos QA visual; kegagalan lama tidak dianggap lulus hanya karena bukan akibat migrasi.
- Source lengkap tersedia di GitHub private, tanpa data pribadi produksi atau rahasia; deployment produksi memakai env terpisah dari preview.
- Backup database dan storage serta latihan rollback/restore berhasil. Ada laporan rekonsiliasi final, daftar pengujian dan catatan cutover.

## Referensi resmi

- Koneksi database dan transaction pooler: https://supabase.com/docs/guides/database/connecting-to-postgres
- Kontrol akses Storage: https://supabase.com/docs/guides/storage/security/access-control
- Backup database tidak mencakup objek Storage: https://supabase.com/docs/guides/platform/backups
- Batas request/response Vercel Function 4,5 MB: https://vercel.com/docs/functions/limitations
- Perubahan Supabase yang perlu diperiksa kembali ketika implementasi: https://supabase.com/changelog

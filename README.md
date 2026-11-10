# DKPP-Admin

Dashboard administrasi kepegawaian dengan pembuatan dokumen KGB/DPCP/WFH dan pembacaan dokumen menggunakan OpenAI.

## Menjalankan aplikasi

```powershell
npm.cmd run dev
```

Buka http://localhost:3000. Launcher Windows tersedia di scripts/start-adminflow.ps1.

## OpenAI

Simpan konfigurasi hanya di .env.local (diabaikan Git), lalu mulai ulang server bila diperlukan:

```dotenv
OPENAI_API_KEY=isi_kunci_anda
OPENAI_MODEL=gpt-5.4-mini
```

Simpan API key hanya di server tanpa awalan `NEXT_PUBLIC_`. `OPENAI_MODEL` opsional dan menggunakan `gpt-5.4-mini` bila kosong. Requests menggunakan OpenAI Responses API dengan `store: false`.

Untuk Vercel, tambahkan `OPENAI_API_KEY` sebagai Environment Variable sensitif pada lingkungan Production, lalu deploy ulang. Gunakan key proyek OpenAI API yang memiliki kuota aktif.

Baca & isi form mengirim PDF, gambar, atau teks dan gambar dalam DOCX ke OpenAI. Maksimal 5 file, 2 MB per file, dan total 2 MB; khusus Arsip Dinas mendukung PDF hingga 10 MB. DOC lama perlu dikonversi ke DOCX/PDF. Hasil hanya mengisi draf kosong, wajib diperiksa sebelum simpan/generasi. Identitas yang tidak cocok mengosongkan hasil ekstraksi. Endpoint lama /api/local-ai/extract menjadi alias ke OpenAI; Ollama tidak lagi diperlukan.

**Persuratan → Arsip Dinas** menerima PDF maksimal **10 MB (10 × 1024 × 1024 byte)**, termasuk untuk pembacaan OpenAI. Dalam konfigurasi Supabase, browser mengunggah langsung memakai URL unggah privat tanpa menimpa berkas yang sudah ada. Server memverifikasi pemilik unggahan, masa berlaku, ukuran aktual, dan signature PDF sebelum menyimpan arsip. Unggahan yang gagal disimpan dapat dicoba kembali tanpa menduplikasi arsip; unggahan terbengkalai dibersihkan saat unggahan berikutnya disiapkan setelah token kedaluwarsa. Unduhan memerlukan sesi aplikasi dan diarahkan ke URL privat yang berlaku 60 detik. Mode SQLite tanpa Supabase tetap memakai unggahan multipart dan penyimpanan lokal. Terapkan migrasi `increase_service_archive_upload_limit` untuk batas database dan tabel unggahan sementara.

Pada daftar Arsip Dinas, tombol **Hapus** membuka konfirmasi berisi nama, nomor, dan tanggal dokumen. **Batal** menutup konfirmasi tanpa perubahan; **Ya, hapus arsip** menghapus arsip dan PDF secara permanen. Server memerlukan konfirmasi eksplisit serta versi data yang masih sama. Jika penyimpanan PDF sedang bermasalah, referensi pembersihan tetap tersimpan untuk dicoba ulang otomatis.

Pembacaan tanggal Arsip Dinas memakai tanggal penerbitan/penetapan surat utama, termasuk bagian tanda tangan di halaman akhir. Tanggal kegiatan, TMT, surat rujukan, pengundangan, dan stempel penerimaan tidak dipakai sebagai tanggal penetapan. Format bulan Indonesia dan angka hari/bulan/tahun dinormalisasi menjadi `YYYY-MM-DD`. Tanggal kosong, tidak valid, atau berkeyakinan rendah disertai peringatan dan harus diisi manual; form tidak menggantinya dengan tanggal hari ini. Tanggal yang diketik pengguna tetap dipertahankan, termasuk perubahan saat OpenAI sedang membaca.

Validasi yang sama berlaku pada seluruh tanggal hasil OpenAI: tanggal surat dan TMT Dokumen Pegawai, TMT PNS serta tanggal lahir pasangan/anak dan tanggal nikah pada DPCP, dan TMT Plt. Tanggal penetapan, TMT CPNS/PNS, tanggal lahir, tanggal nikah, dan tanggal pensiun dibedakan sesuai sumber dan identitas. Isian manual/tersimpan tetap dipertahankan. Form Plt. baru dimulai dengan TMT kosong; saran tanggal perpanjangan tetap tersedia, tetapi hasil pembacaan tanpa TMT yang jelas mengosongkan saran yang belum diubah agar dilengkapi manual. Pada PO/KAK, jadwal tetap mengikuti rentang/bulan/triwulan RKA tanpa mengarang tanggal lengkap; tanggal pembuatan PO/KAK dan tanggal WFH tetap pilihan pengguna. Jalankan `npm.cmd run smoke:document-ai-dates` untuk regresi seluruh kolom tanggal.

## Laporan WFH

Menu Laporan WFH memilih pegawai aktif, menampilkan jabatan/unit, meminta empat usulan tugas OpenAI, dan memungkinkan penyuntingan. Realisasi dan persentase diisi pengguna. Setelah konfirmasi pemeriksaan, laporan DOCX dibuat dari template sumber, disimpan dalam arsip milik pengguna, dan dapat diunduh ulang dengan autentikasi. Tanpa OpenAI, laporan tetap dapat diisi manual.

## Surat Perbantuan

Menu **Persuratan → Surat Perbantuan** menggunakan `src/templates/template-surat-perbantuan.docx`. Pilih pegawai aktif untuk mengisi nama, NIP, pangkat, golongan, jabatan, dan unit kerja dari database. Isi nomor urut surat, tanggal penetapan secara manual, jabatan perbantuan, serta unit kerja tujuan. Nomor mengikuti awalan dan akhiran pada template: `800.1.11.1 / nomor / Sekret.`

Dokumen DOCX tersimpan di arsip dan dapat diunduh ulang oleh pengguna dengan akses menu Surat Perbantuan. Identitas pegawai diperiksa ulang di server. Kop, isi tetap, serta penandatangan mengikuti template sumber; paragraf kosong di akhir dihapus dan bagian tembusan dijaga tetap bersama. Data dan file arsip ikut backup kategori Persuratan.

SQLite membuat tabel arsip secara otomatis. Untuk lingkungan PostgreSQL, terapkan migrasi `supabase/migrations/20261026021735_add_surat_perbantuan_documents.sql` sebelum menjalankan versi baru. Tabel arsip hanya diakses melalui server aplikasi, dengan RLS aktif dan akses Data API publik dicabut.

## Daftar Plt.

**Kepegawaian → Daftar Plt.** mencatat pegawai, jabatan/unit Plt., nomor SK atau surat tugas, tanggal mulai, dokumen SK, dan catatan. Unggah SK dalam format PDF, DOC, atau DOCX maksimal **2 MB**. Berkas tersimpan privat dan hanya dapat diunduh melalui aplikasi oleh pengguna yang memiliki akses Daftar Plt. Saat edit, file lama tetap dipakai jika tidak diganti; perpanjangan memerlukan unggahan SK baru. Data dan berkas SK ikut backup Kepegawaian.

Satu periode berlangsung tiga bulan kalender (tanggal mulai termasuk); tanggal akhir dihitung satu hari sebelum tanggal mulai tiga bulan berikutnya, dengan penyesuaian akhir bulan. Contoh: 27 Oktober 2026–26 Januari 2027.

Nama SK yang tersimpan dan diunduh otomatis mengikuti **nama pegawai_jabatan Plt._TMT.ext**, misalnya `Pegawai Contoh_Kepala Bidang Contoh_2026-10-27.pdf`. TMT menggunakan format `YYYY-MM-DD`. Nama diperbarui saat data penugasan diedit, termasuk jika file tidak diganti. Form menampilkan pratinjau nama sebelum disimpan; karakter yang tidak sesuai untuk nama file diamankan.

Pengingat di daftar dan dashboard muncul mulai H-14, pada hari terakhir, dan sesudah habis berdasarkan WIB. Pada perpanjangan **+3 bulan**, tanggal mulai disarankan sehari setelah periode lama dan **dapat diubah manual sesuai SK baru**; tanggal akhir dihitung tiga bulan dari tanggal yang dipilih. Tanggal mulai baru harus sesudah tanggal mulai lama. Bila SK baru berlaku lebih awal, pengingat periode lama berhenti saat penggantinya mulai; jika ada jeda, masa tugas lama tetap ditandai habis sampai periode baru dimulai. Penugasan lain yang bertumpang tindih tetap ditolak.

Tombol **Baca dengan OpenAI** membaca SK PDF/DOCX yang dipilih atau SK tersimpan saat edit. Hasilnya mengisi nomor SK, jabatan Plt., unit tujuan, dan tanggal mulai/TMT (bukan tanggal penerbitan). Identitas dicocokkan dengan pegawai dari database; hasil yang meragukan atau berbeda identitas tidak mengisi form. Perubahan manual tidak ditimpa, sedangkan tanggal awal yang masih berupa saran dapat mengikuti TMT dari SK. Jabatan dan unit pada perpanjangan mengikuti riwayat asal. Hasil pembacaan tetap perlu diperiksa sebelum disimpan. DOC lama perlu dikonversi menjadi PDF/DOCX untuk pembacaan otomatis, atau tetap diisi manual.

Perpanjangan memerlukan nomor SK dan unggahan SK baru, serta tidak menghapus riwayat. Periode yang sudah diperpanjang tidak dapat diedit/dihapus sebelum periode lanjutannya dihapus. Gunakan **Selesai** untuk menghentikan pengingat penugasan yang telah berakhir lebih awal.

Administrator memiliki akses otomatis. Izin **Daftar Plt.** untuk role/pengguna lain diatur melalui Manajemen User; halaman, API, serta data pengingat dashboard memeriksa izin yang sama. Data tidak mengubah jabatan utama pegawai, tercatat dalam audit, dan ikut backup Kepegawaian. Pengingat ditampilkan di dalam aplikasi; tidak mengirim email atau pesan eksternal.

SQLite membuat tabel dan memperbarui kolom otomatis. PostgreSQL menggunakan migrasi `supabase/migrations/20261027024952_add_plt_assignments.sql` dan migrasi tambahan `add_plt_assignment_documents`, dengan RLS aktif dan akses `anon`/`authenticated` dicabut. Uji fungsi terisolasi: `npm.cmd run smoke:plt`.

## Perpustakaan DKPP

**Perpustakaan → Dashboard Statistik** (`/dashboard/perpustakaan/statistik`) hanya dapat dibuka administrator (`is_administrator`) dan pengguna dengan nama role **Perpustakaan** pada data role server. Aturan ini berlaku pada sidebar, halaman, layanan data, dan `/api/library/statistics`; izin menu tambahan pada role lain tidak dapat membuka statistik. Role Perpustakaan mendapatkan akses statistik otomatis. Katalog publik tetap dapat dibuka tanpa login.

Dashboard menampilkan kondisi koleksi/stok saat ini, pengunjung terdaftar, eksemplar yang belum kembali, dan jumlah transaksi terlambat berdasarkan WIB. Filter bulan mengatur jumlah kunjungan, pengunjung unik, transaksi dan eksemplar peminjaman/pengembalian, buku paling banyak dipinjam, serta tren 12 bulan yang berakhir pada periode terpilih. Eksemplar tersedia hanya berasal dari koleksi aktif. Pengembalian dihitung pada tanggal kembali, termasuk pinjaman dari bulan sebelumnya; jatuh tempo hari ini belum dianggap terlambat. Statistik hanya mengirim ringkasan, kategori, dan judul buku, tanpa nama/kontak/NIP pengunjung. Gunakan `npm.cmd run smoke:library-statistics` untuk uji hitungan dan pembatasan role.

Katalog publik tersedia di **`/perpustakaan`**, tanpa login. Katalog memuat pencarian judul/pengarang, kode inventaris, ISBN, penerbit, filter kategori, stok tersedia, serta detail lokasi rak. Tautan tersedia pada halaman login dan menu admin. Data kontak pengunjung, NIP, catatan internal, serta identitas peminjam tidak ditampilkan di halaman publik.

Menu **Perpustakaan** pada sidebar admin mempunyai tiga submenu, masing-masing dengan izin terpisah pada Manajemen User:

- **Daftar Buku**: tambah/edit inventaris, jumlah eksemplar, rak, dan status aktif. Data awal dari `DAFTAR INVENTARIS BUKU.xlsx`, Sheet1 A4:I157: **154 entri, 251 eksemplar**. Kolom judul/pengarang tetap digabung seperti sumber, kode inventaris tetap berupa teks, dan tanda `-` tetap menandai data yang belum diketahui. Kolom Keterangan menjadi kategori; variasi huruf besar/kecil dikelompokkan hanya pada filter publik. Buku dengan riwayat peminjaman tidak dapat dihapus; nonaktifkan melalui Edit untuk menyimpan riwayat.
- **Daftar Pengunjung**: pendaftaran umum/manual atau pemilihan pegawai aktif dari database, edit kontak/status, pencatatan kunjungan dengan tanggal dan keperluan, serta unduh kartu PDF ukuran 85,6 × 54 mm. Nama/unit pegawai ditentukan server berdasarkan NIP. Kartu memiliki nomor tetap dan hanya memuat nama, instansi, dan nomor kartu. Kartu hanya dapat diunduh pengguna dengan izin Pengunjung.
- **Daftar Peminjaman**: pilih buku dan pengunjung terdaftar, jumlah, tanggal pinjam, serta jatuh tempo. Saran jatuh tempo tujuh hari dapat diubah. Catat pengembalian seluruh eksemplar dalam satu transaksi dengan tanggal manual. Status Dipinjam/Terlambat/Dikembalikan berdasarkan tanggal WIB. Tidak ada denda otomatis. Stok dihitung dari transaksi yang belum kembali; penyimpanan serentak diserialkan agar stok tidak negatif. Eksemplar total tidak dapat dikurangi di bawah jumlah yang sedang dipinjam.

Untuk mencetak beberapa kartu, tandai pengunjung lalu pilih **Cetak kartu terpilih**. Kotak di kepala tabel memilih halaman saat ini; **Pilih semua hasil pencarian** memilih seluruh hasil, termasuk halaman berikutnya. Pilihan tetap tersimpan saat mencari atau berpindah halaman, dan dapat dikosongkan dengan **Batal pilih**. PDF A4 memuat **6 kartu per halaman (2 kolom × 3 baris)** dengan ukuran kartu 85,6 × 54 mm dan garis potong. Cetak pada ukuran asli **100%**. Lebih dari enam kartu otomatis berlanjut ke halaman berikutnya; halaman terakhir hanya berisi sisa kartu yang dipilih. Maksimal 1.000 kartu per unduhan. Identitas kartu selalu dibaca dari database dan unduhan memerlukan izin Pengunjung.

Semua perubahan dicatat pada audit dan keempat tabel ikut backup lokal/Google Drive dalam kategori **Perpustakaan**. SQLite membuat tabel dan memuat inventaris hanya saat tabel pertama dibuat. Produksi PostgreSQL memakai `supabase/migrations/20261029075725_add_library.sql`; migrasi menambahkan tabel dan inventaris tanpa mengubah data fitur lain. RLS aktif, Data API `PUBLIC`/`anon`/`authenticated` dicabut. Katalog publik membaca hanya kolom buku melalui server aplikasi, bukan akses langsung Data API.

Uji: `npm.cmd run smoke:library`, `npm.cmd run smoke:google-drive-backup`, dan `npm.cmd run smoke:local-backup`.

## Verifikasi

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run smoke:wfh-report
npm.cmd run smoke:openai-client
npm.cmd run smoke:surat-perbantuan
```

`npm.cmd run smoke:openai` menguji server lokal dengan layanan OpenAI dan kuota proyek menggunakan dokumen sintetis.

## Data produksi

Database SQLite, arsip dokumen, backup, nilai `.env.local`, dan `src/data/pegawai.json` tidak disimpan di Git. Data pegawai produksi dipulihkan melalui proses migrasi database; repository publik tidak berisi seed pegawai nyata.

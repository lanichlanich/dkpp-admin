# AdminFlow

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

## Verifikasi

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run smoke:wfh-report
npm.cmd run smoke:gemini
```

smoke:gemini menggunakan layanan Gemini dan kuota proyek dengan dokumen uji sintetis.

## Data produksi

Database SQLite, arsip dokumen, backup, nilai `.env.local`, dan `src/data/pegawai.json` tidak disimpan di Git. Data pegawai produksi dipulihkan melalui proses migrasi database; repository publik tidak berisi seed pegawai nyata.

# Pengembangan DKPP-Admin melalui Hermes

Gunakan Git, Node.js 24 LTS, dan Hermes Agent di VPS. Checkout pengembangan menyimpan database SQLite dan unggahan uji di `data/`. Gunakan data sintetis dan biarkan konfigurasi database serta penyimpanan produksi kosong.

## Siapkan checkout

```bash
mkdir -p ~/projects
git clone https://github.com/lanichlanich/dkpp-admin.git ~/projects/dkpp-admin
cd ~/projects/dkpp-admin
git switch -c codex/hermes-dev
npm ci --include=dev
```

Jika checkout sudah tersedia, masuk ke direktorinya dan periksa `git status`. Jalankan `hermes chat` dari sana agar Hermes memuat `AGENTS.md` dan menggunakan repo sebagai direktori kerja CLI. Kunci untuk kloning bersifat opsional karena repositori ini publik. Untuk push, gunakan identitas GitHub yang diberi izin pada repo.

## Pratinjau aplikasi

Jalankan server di VPS pada terminal tersendiri.

```bash
npm run dev -- --hostname 127.0.0.1 --webpack
```

Buka tunnel dari komputer Anda, lalu akses [http://localhost:3000](http://localhost:3000).

```bash
ssh -N -L 3000:127.0.0.1:3000 user@vps
```

## Verifikasi perubahan

Jalankan smoke test fitur yang diubah dan `npm run build -- --webpack`. Pada VPS dengan RAM terbatas, set `DKPP_LOW_MEMORY_BUILD=1` untuk kompilasi Webpack berurutan tanpa cache dan gunakan batas cgroup yang menyisakan ruang untuk layanan produksi. Periksa diff sebelum push dan sertakan migrasi yang diperlukan jika skema ikut berubah. Untuk menguji ekstraksi dokumen, simpan API key khusus pengembangan di `.env.local` dan gunakan dokumen uji sintetis.

## Storage rilis produksi VPS

Setelah mengekstrak checkout ke direktori rilis baru, sebelum mengganti `WorkingDirectory` layanan, jalankan:

```bash
bash scripts/smoke-release-storage.sh
bash scripts/link-release-storage.sh "$release" /var/lib/dkpp-admin/data
(cd "$release" && runuser -u dkpp-admin -- bash -c '[[ -L data && data -ef /var/lib/dkpp-admin/data ]]')
```

Jangan memakai `ln -s TARGET RILIS/data` tanpa `-T`: `data/.gitkeep` dari arsip Git membuat direktori `data` sudah ada, sehingga tautan akan bersarang di `data/data`. Skrip menolak menimpa direktori yang berisi data runtime atau tautan ke lokasi lain. Pertahankan pemeriksaan `ExecStartPre` untuk tautan langsung ke storage VPS saat mengganti konfigurasi rilis. Setelah aktivasi, uji minimal satu URL cover publik yang benar-benar dirujuk katalog dan periksa status serta tipe gambarnya; untuk dokumen privat, pertahankan pemeriksaan otorisasi.

### Tools PDF (produksi VPS)

Dependensi host: `apt-get install --no-install-recommends ghostscript qpdf poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-ind` (Node/npm tidak berubah). Pertahankan AppArmor dan `PrivateTmp=true` milik `dkpp-admin`. Jangan arahkan `TMPDIR` layanan ke direktori tersembunyi Hermes: profil bawaan Ubuntu membatasi akses QPDF dan Ghostscript. Unggahan hanya berada di direktori temporer privat per permintaan; pemrosesan tidak memakai database, Drive, atau API eksternal. Hasil dikirim kembali ke browser dan disimpan privat di `data/pdf-tools-documents/`; direktori kerja dan PDF sumber dihapus. Arsip diisolasi per akun, termasuk untuk administrator. Direktori arsip tidak ikut ekspor Backup Lokal atau Google Drive dari dashboard. Cadangkan direktori persisten tersebut secara terpisah bersama database pengguna ke penyimpanan VPS terenkripsi/terbatas; pertahankan ID akun dan izin direktori saat pemulihan.

Uji engine dengan `systemd-run --wait --pipe --collect -p PrivateTmp=yes --working-directory=/root/develop/dkpp-admin /root/.local/share/dkpp-admin/node/bin/node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/smoke-pdf-tools.mjs`. Verifikasi setiap menu dan API memakai izin `compress-pdf`, `merge-pdf`, atau `split-pdf`; administrator memiliki akses, role lain memerlukan izin fitur dan `pdf-tools-documents` untuk daftar/unduh ulang/ubah nama/hapus. PDF dengan tanda tangan digital/kolom TTE, PDF terenkripsi, formulir XFA, atau aksi aktif tertentu ditolak. Simpan salinan asli dokumen.

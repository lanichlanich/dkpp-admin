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

Jalankan smoke test fitur yang diubah dan `npm run build -- --webpack`. Periksa diff sebelum push dan sertakan migrasi yang diperlukan jika skema ikut berubah. Untuk menguji ekstraksi dokumen, simpan API key khusus pengembangan di `.env.local` dan gunakan dokumen uji sintetis.

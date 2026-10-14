# Backup ke Lokal

Menu **Backup ke Lokal** mengunduh satu arsip `backup-dkpp-admin-YYYY-MM-DD_HH-mm-ss.tar.gz` (waktu WIB). Arsip berisi snapshot konsisten seluruh tabel aplikasi selain sesi login, berkas asli yang terhubung ke fitur, dan objek Storage tanpa metadata fitur. Folder Kepegawaian, Persuratan, Umum, Perencanaan, dan Sistem mengikuti pembagian fitur. PO, KAK dan RKA sumber semuanya disertakan.

Akses diatur melalui **Manajemen User**. Administrator dapat menjalankan backup, dan role lain harus diberi izin menu **Backup ke Lokal**. Tidak membutuhkan kredensial OAuth Google. Route download memeriksa sesi aktif dan izin dari database kembali, menolak origin lain, serta mencegah backup bersamaan oleh akun yang sama pada instance server.

Arsip dikirim sebagai streaming response tanpa Content-Length untuk mendukung backup besar di Vercel, mengikuti [panduan streaming Vercel](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions). Browser memeriksa jumlah byte dan SHA-256 sebelum memulai penyimpanan file. Pengumpulan data dibatasi durasi fungsi 300 detik; ukuran yang dapat diproses juga bergantung pada memori server dan browser. Arsip tidak ditulis ke bucket dan tidak mengubah data sumber.

Ekstrak dengan 7-Zip, WinRAR, atau `tar -xzf <nama-arsip>`. `manifest.json` memuat daftar path, ukuran, hash, serta `storageFiles` yang memetakan setiap berkas ke nama asli objek bucket. `PEMULIHAN.txt` memuat petunjuk pemulihan. Siapkan database dengan migrasi skema repository, impor JSON sesuai foreign key, lalu unggah berkas sesuai manifest. Verifikasi jumlah baris dan hash serta uji download aplikasi sebelum cutover. Konfigurasi environment disiapkan terpisah; pengguna login kembali karena sesi tidak dipulihkan.

Jalankan `npm.cmd run smoke:local-backup` untuk memverifikasi ekstraksi arsip besar, pemetaan pemulihan dan proteksi akses; `npm.cmd run smoke:google-drive-backup` memastikan backup Drive tetap berjalan setelah refactor pembuat arsip bersama.

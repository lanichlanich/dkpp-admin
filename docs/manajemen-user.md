# Manajemen pengguna dan role

Menu **Manajemen User** hanya tersedia bagi administrator. Administrator dapat membuat pengguna, membuat dan mengubah role, memilih menu role, mengganti role pengguna, menonaktifkan akun, dan mengganti akses role dengan menu khusus pengguna.

Role **Perencana** awalnya hanya memiliki akses **Perencanaan → Pembuatan PO dan KAK**. Administrator dapat mengubah daftar tersebut. Pilihan menu khusus menggantikan seluruh daftar menu role untuk pengguna tersebut; kosong berarti hanya profil pribadi. Hilangkan pilihan menu khusus untuk kembali mengikuti role.

Role **Administrator** memiliki semua menu dan manajemen pengguna. Akun **admin1@dkpp.com** merupakan administrator utama yang dilindungi dari demosi, penonaktifan, dan perubahan email. Administrator lain juga tidak dapat menonaktifkan atau menurunkan role akun mereka sendiri.

Akun lama selain administrator utama serta pendaftaran mandiri mendapatkan role **Belum ditetapkan**. Administrator harus menetapkan role atau menu khusus sebelum fitur administrasi dapat dipakai. Profil pribadi tetap tersedia. Akun nonaktif tidak dapat masuk dan sesi lamanya dicabut.

Hak akses diperiksa kembali dari database pada setiap permintaan. Perubahan role/menu berlaku tanpa login ulang. Sidebar desktop, ringkas, dan mobile hanya menunjukkan menu yang diizinkan. Halaman, API, dan Server Actions memeriksa izin sendiri; permintaan API yang tidak diizinkan mengembalikan HTTP 403.

Backup ke Lokal dan Google Drive tetap memerlukan allowlist administrator pada environment yang sudah ada, selain izin menu. Backup mengekspor semua data aplikasi sehingga pemberian akses ini perlu dilakukan dengan hati-hati. Tabel `app_roles` dan kolom akses pengguna ikut tercakup dalam backup, sementara sesi login tetap dikecualikan.

Migrasi Supabase: `supabase/migrations/20261014055846_add_user_role_management.sql`. SQLite menerapkan perubahan saat database diinisialisasi. Kata sandi, nama, email, dan data administrasi lama tidak ditimpa migrasi.

Validasi: `npm run smoke:user-management`, `npm run lint`, dan `npm run build`.

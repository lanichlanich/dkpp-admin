# Manajemen pengguna dan role

Menu **Manajemen User** hanya tersedia bagi administrator. Administrator dapat membuat pengguna, membuat dan mengubah role, memilih menu role, mengganti role pengguna, menonaktifkan akun, dan mengganti akses role dengan menu khusus pengguna.

Tombol **Edit user** mengubah nama, username, dan email, serta menyediakan password baru dan konfirmasinya. Kosongkan kedua kolom password untuk mempertahankan password lama. Password baru minimal 8 karakter dengan huruf dan angka; maksimal 72 byte UTF-8 agar tidak terpotong oleh bcrypt. Password tersimpan sebagai hash bcrypt. Penggantian password dan pencabutan seluruh sesi pengguna dilakukan dalam satu transaksi. Jika administrator mengganti password akun sendiri, ia diarahkan ke login. Password maupun hash tidak dikirim ke tampilan atau dicatat sebagai isi log audit.

Email dan username harus unik tanpa membedakan huruf besar/kecil. Email administrator utama tetap terkunci. Role, status akun, izin menu, dan hubungan dokumen tetap dipertahankan. Perubahan dicatat di log audit; role dan menu tetap dikelola melalui **Atur akses**.

Role **Perencana** awalnya hanya memiliki akses **Perencanaan → Pembuatan PO dan KAK**. Administrator dapat mengubah daftar tersebut. Pilihan menu khusus menggantikan seluruh daftar menu role untuk pengguna tersebut; kosong berarti hanya profil pribadi. Hilangkan pilihan menu khusus untuk kembali mengikuti role.

Role **Administrator** memiliki semua menu dan manajemen pengguna. Akun **admin1@dkpp.com** merupakan administrator utama yang dilindungi dari demosi, penonaktifan, dan perubahan email. Administrator lain juga tidak dapat menonaktifkan atau menurunkan role akun mereka sendiri.

Akun lama selain administrator utama serta pendaftaran mandiri mendapatkan role **Belum ditetapkan**. Administrator harus menetapkan role atau menu khusus sebelum fitur administrasi dapat dipakai. Profil pribadi tetap tersedia. Akun nonaktif tidak dapat masuk dan sesi lamanya dicabut.

Hak akses diperiksa kembali dari database pada setiap permintaan. Perubahan role/menu berlaku tanpa login ulang. Sidebar desktop, ringkas, dan mobile hanya menunjukkan menu yang diizinkan. Halaman, API, dan Server Actions memeriksa izin sendiri; permintaan API yang tidak diizinkan mengembalikan HTTP 403.

Backup ke Lokal dan Google Drive mengikuti izin menu pada role atau pengaturan khusus pengguna. Daftar username backup pada environment tidak lagi menentukan akses; administrator memiliki izin backup, sementara role lain harus mendapat menu backup secara eksplisit. Backup mengekspor semua data aplikasi. Tabel `app_roles` dan kolom akses pengguna ikut tercakup dalam backup, sementara sesi login tetap dikecualikan.

Migrasi Supabase: `supabase/migrations/20261014055846_add_user_role_management.sql`. SQLite menerapkan perubahan saat database diinisialisasi. Kata sandi, nama, email, dan data administrasi lama tidak ditimpa migrasi.

Validasi: `npm run smoke:user-management`, `npm run lint`, dan `npm run build`.

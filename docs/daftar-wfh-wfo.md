# Kelola pegawai dalam jadwal WFH/WFO

Pada **Kepegawaian → Daftar Pegawai WFH/WFO**, pilih bulan yang sudah memiliki jadwal, lalu gunakan **Tambah pegawai**. Dialog menampilkan pegawai aktif yang belum masuk pada bulan tersebut, dengan pencarian nama, NIP, jabatan, atau unit. Pilih pegawai dan status awal **WFO** (default) atau **WFH**, lalu tekan **Tambah ke jadwal**. Status awal disimpan untuk seluruh Jumat pada bulan itu dan tetap dapat diubah per tanggal.

Tombol **Hapus** pada baris pegawai meminta konfirmasi nama, NIP, dan bulan. Penghapusan menghapus seluruh entri Jumat milik pegawai tersebut pada bulan yang dipilih. Data induk pegawai, jadwal bulan lain, dan arsip surat tugas tidak dihapus. Pegawai aktif yang dihapus dapat ditambahkan kembali. Daftar boleh kosong tanpa menghapus bulan; lanjutkan/generate bulan berikutnya menolak sumber kosong agar bulan lain tidak tertimpa.

Penambahan menolak pegawai nonaktif, NIP/bulan/status tidak valid, dan duplikat yang sudah lengkap. Status manual pada entri yang sudah ada tidak ditimpa. Penghapusan wajib menyertakan konfirmasi di server dan dibatasi oleh kombinasi bulan dan NIP. Kedua tindakan memerlukan izin menu `daftar-wfh` serta memperbarui daftar dan laporan setelah berhasil. Rekap serta unduhan mengambil data jadwal terbaru.

Tabel menyediakan penggeser kolom yang tetap terlihat saat menggulir, sehingga kolom Aksi dapat dijangkau pada layar sempit. Perubahan memakai tabel jadwal yang sudah ada dan tidak memerlukan migrasi skema.

Validasi: `npm.cmd run smoke:wfh-schedule`, pemeriksaan izin menu, build, serta uji browser tambah/pencarian/status/hapus/konfirmasi/batal/tambah ulang dan laporan. Smoke jadwal memakai database memori terpisah.

## Format Excel bulanan

Unduhan **Excel bulanan** mengikuti format `Daftar-WFH-WFO-2026-11.xlsx` yang diberikan pengguna: header abu-abu, baris header 24,95 pt, baris isi 15 pt, serta lebar kolom identitas dan tanggal sesuai lampiran. Font, perataan dan garis tabel mengikuti contoh; NIP tetap berupa teks 18 digit. Sel bertanda ✓ berwarna hijau dan ✖ merah melalui conditional formatting, sehingga warnanya ikut berubah jika simbol diedit di Excel.

Profil `src/data/wfh-monthly-format.json` hanya menyimpan ukuran dan gaya dari lampiran. Nama, NIP, jabatan, unit, status, dan jumlah WFH/WFO tetap diambil dari jadwal bulan yang diunduh. Bulan dengan lima Jumat menambah satu kolom tanggal dengan lebar yang sama serta menggeser legenda secara otomatis. Perubahan format tidak memerlukan migrasi database.

Validasi format: `npm.cmd run smoke:wfh-schedule-export` memeriksa ukuran, warna, font, NIP, tanggal, rekap, bulan dengan empat/lima Jumat dan daftar kosong. Hasil unduhan juga dibandingkan dengan lampiran menggunakan render Microsoft Excel.

## Surat tugas bertanda tangan dan lampiran

Pada **Laporan Pegawai WFH/WFO**, pilih bulan lalu gunakan bagian **Surat tugas WFH/WFO** untuk mengunggah PDF yang sudah ditandatangani (maksimal 2 MB). Setiap unggahan dicatat pada bulan tersebut; unggahan berikutnya tetap mempertahankan surat sebelumnya. PDF harus dapat dibaca dan tidak dilindungi kata sandi.

**Unduh surat asli** mengembalikan berkas persis seperti yang diunggah. **Unduh surat + daftar pegawai** membuat satu PDF berisi seluruh halaman surat, diikuti PDF daftar pegawai bulan yang sama. Ukuran dan orientasi halaman surat dipertahankan. Lampiran menggunakan jadwal terbaru saat diunduh, termasuk perubahan pegawai dan status WFH/WFO. Gunakan surat asli untuk verifikasi TTE; PDF gabungan merupakan salinan dan tidak mempertahankan validitas kriptografis tanda tangan surat asli.

Unggah dan kedua unduhan memerlukan akses menu `laporan-pegawai-wfh-wfo`. ID surat dibatasi oleh bulan pada URL, nama objek Storage tidak diterima dari klien, dan unduhan memakai `private, no-store`. Surat disimpan dalam Storage privat atau direktori lokal yang diabaikan Git. Kegagalan penyimpanan metadata membersihkan objek unggahan. Metadata dan berkas tercakup dalam backup lokal/Google Drive dan utilitas migrasi Storage.

Migrasi `20261104031850_add_wfh_schedule_letters.sql` menambahkan tabel surat, foreign key dan indeks tanpa mengubah jadwal yang ada. RLS diaktifkan dan akses Data API dicabut sesuai pola sesi aplikasi. Validasi: `npm.cmd run smoke:wfh-schedule-letters`, uji browser unggah/riwayat/unduh/pergantian bulan, serta pemeriksaan halaman PDF hasil gabungan.

# Kelola pegawai dalam jadwal WFH/WFO

Pada **Kepegawaian → Daftar Pegawai WFH/WFO**, pilih bulan yang sudah memiliki jadwal, lalu gunakan **Tambah pegawai**. Dialog menampilkan pegawai aktif yang belum masuk pada bulan tersebut, dengan pencarian nama, NIP, jabatan, atau unit. Pilih pegawai dan status awal **WFO** (default) atau **WFH**, lalu tekan **Tambah ke jadwal**. Status awal disimpan untuk seluruh Jumat pada bulan itu dan tetap dapat diubah per tanggal.

Tombol **Hapus** pada baris pegawai meminta konfirmasi nama, NIP, dan bulan. Penghapusan menghapus seluruh entri Jumat milik pegawai tersebut pada bulan yang dipilih. Data induk pegawai, jadwal bulan lain, dan arsip surat tugas tidak dihapus. Pegawai aktif yang dihapus dapat ditambahkan kembali. Daftar boleh kosong tanpa menghapus bulan; lanjutkan/generate bulan berikutnya menolak sumber kosong agar bulan lain tidak tertimpa.

Penambahan menolak pegawai nonaktif, NIP/bulan/status tidak valid, dan duplikat yang sudah lengkap. Status manual pada entri yang sudah ada tidak ditimpa. Penghapusan wajib menyertakan konfirmasi di server dan dibatasi oleh kombinasi bulan dan NIP. Kedua tindakan memerlukan izin menu `daftar-wfh` serta memperbarui daftar dan laporan setelah berhasil. Rekap serta unduhan mengambil data jadwal terbaru.

Tabel menyediakan penggeser kolom yang tetap terlihat saat menggulir, sehingga kolom Aksi dapat dijangkau pada layar sempit. Perubahan memakai tabel jadwal yang sudah ada dan tidak memerlukan migrasi skema.

Validasi: `npm.cmd run smoke:wfh-schedule`, pemeriksaan izin menu, build, serta uji browser tambah/pencarian/status/hapus/konfirmasi/batal/tambah ulang dan laporan. Smoke jadwal memakai database memori terpisah.

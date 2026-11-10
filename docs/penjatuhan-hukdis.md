# Administrasi penjatuhan hukuman disiplin PNS

Menu **Kepegawaian → Penjatuhan Hukuman Disiplin** menyimpan perkara ketidakhadiran dan menyiapkan draf Word. Masukkan jumlah hari kerja tanpa alasan yang sah secara kumulatif dalam satu tahun berjalan. Jika ada rangkaian sedikitnya 10 hari kerja berturut-turut, centang pilihan yang muncul. Tingkat dan dasar pasal dihitung dari data tersebut. Pada langkah berikutnya, cari PNS aktif yang diperiksa, atasan, tim, dan pejabat berdasarkan nama, NIP, atau jabatan. Data pejabat di luar daftar bisa diisi manual.

## Dasar dan alur

- **Dugaan dan bukti.** Gunakan Pasal 4 huruf f dan ambang Pasal 9–11. Jumlah 1–2 hari kerja berada di bawah ambang hukuman.
- **Panggilan.** Menurut Pasal 26 PP 94/2021 dan Pasal 34 Peraturan BKN 6/2022, ketidakhadiran pada jadwal pertama diikuti panggilan kedua paling lambat tujuh hari kerja sejak jadwal pertama. Di aplikasi, jadwal Panggilan II juga dapat digunakan untuk pemeriksaan lanjutan ketika PNS hadir pada Panggilan I. Jika kedua panggilan tidak dihadiri, catat alat bukti dan keterangan yang menjadi dasar telaah.
- **Pemeriksaan.** Pemeriksaan tertutup dapat dilakukan tatap muka atau virtual. Untuk dugaan hukuman berat, bentuk tim dengan unsur atasan langsung, pengawasan, dan kepegawaian. Tim untuk dugaan hukuman sedang bersifat pilihan. Isi tanggal, tempat, tanya jawab, dan status penandatanganan BAP untuk masing-masing panggilan. Tanggal dan tempat awal diambil dari jadwal masing-masing.
- **Laporan hasil.** Lengkapi kesimpulan, uraian hasil, dan pejabat tujuan. Alur DKPP selesai setelah BAP dan laporan hasil disiapkan untuk diteruskan melalui jalur hierarki.

[PP 94 Tahun 2021](https://peraturan.bpk.go.id/Details/177031/pp-no-94-tahun-2021) · [Peraturan BKN 6 Tahun 2022](https://peraturan.bpk.go.id/Details/225406/peraturan-bkn-no-6-tahun-2022)

## Format Word

Surat Panggilan I dan II, pembentukan tim, BAP per panggilan, serta laporan hasil pemeriksaan memakai format dari `format2 hukdis.docx` dengan kop dan logo `kop surat dkpp.docx`. Berkas memakai awalan **Draf**.

## Akses dan verifikasi

Akses diberikan lewat izin **Penjatuhan Hukuman Disiplin**. Perkara termasuk backup kategori Kepegawaian dan mutasi tercatat dalam audit. Unduhan draf memakai sesi aplikasi. Perubahan menggunakan versi perkara untuk mencegah penimpaan. BAP lama dibaca dari catatan pemeriksaan yang tersimpan dan ditampilkan pada panggilan terkait.

Migrasi PostgreSQL ada di `supabase/migrations/20261110075939_add_discipline_cases.sql`. Tabel privat memakai RLS dan menolak peran Data API publik. SQLite membuat tabel yang setara saat inisialisasi.

`npm.cmd run smoke:discipline-cases` memeriksa izin, validasi dan semua unduhan. Tambahkan `-- --render-fixtures` untuk menghasilkan draf sintetis di direktori sementara untuk pemeriksaan Word.

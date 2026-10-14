# Simulasi Gaji PNS

Menu **Keuangan → Simulasi Gaji PNS** berada di `/dashboard/simulasi-gaji-pns`.
Administrator dapat mengatur akses menu melalui Manajemen User. Perhitungan
berjalan di browser; tidak mengubah data pegawai, slip, atau transaksi keuangan.

## Perhitungan bulanan

- Gaji pokok: golongan dan MKG tahun pada `src/data/pns-salary-2024.json`, sesuai
  Lampiran I Peraturan BKN No. 1 Tahun 2024 / PP No. 5 Tahun 2024. Bulan MKG
  yang belum genap satu tahun tidak menaikkan gaji. Kombinasi di luar tabel ditolak.
- Keluarga: pasangan yang berhak 10% dan maksimal dua anak yang berhak masing-masing
  2% gaji pokok. Hak keluarga tidak diberikan ganda pada pasangan sesama ASN.
- Beras tunai: Rp72.420 per jiwa (10 kg × Rp7.242) untuk pegawai, pasangan yang
  ditanggung, dan anak yang mendapat tunjangan. Natura tidak menambah uang diterima.
- Tunjangan jabatan: pilih satu dari umum, struktural, fungsional, atau tanpa
  tunjangan. Umum golongan I/II/III/IV: Rp175.000/180.000/185.000/190.000
  (Perpres No. 12 Tahun 2006). Struktural berdasarkan eselon (Perpres No. 26 Tahun
  2007). Fungsional dan profesi diisi sesuai SK/aturan jenis dan jenjang jabatan.
- Uang makan: hari yang berhak × tarif instansi. Tidak diasumsikan otomatis
  berlaku bagi pegawai daerah. Tunjangan lain dapat ditambah dan dihapus; TPP/tukin
  tidak termasuk penghasilan simulasi.
- Pensiun 4,75% dan THT 3,25% memakai dasar gaji pokok + tunjangan keluarga.
  Total IWP 8% dibulatkan ke rupiah, lalu dibagi antara pensiun dan THT agar
  penjumlahan tidak berselisih akibat pembulatan terpisah.
- BPJS Kesehatan bagian pegawai 1%, dasar maksimal Rp12 juta. Dasar otomatis:
  gaji pokok + keluarga + jabatan/umum + profesi + tunjangan tambahan yang ditandai.
  Beras dan uang makan tidak masuk dasar otomatis. Anggota keluarga lain yang
  dikenai iuran tambahan dihitung 1% per orang dari dasar yang sama.
- **Dasar BPJS sesuai slip** dapat diisi bila basis aktual juga mencakup TPP/tukin.
  Ini hanya mengubah iuran, tidak menambahkan TPP/tukin ke penghasilan.
- PPh 21 gaji/tunjangan tetap dan teratur PNS yang menjadi beban APBN/APBD
  ditanggung pemerintah (PP No. 80 Tahun 2010), sehingga tidak otomatis mengurangi
  hasil bersih. Pajak yang benar-benar dibebankan pegawai diisi sesuai slip.
  TER, tunjangan pajak, gross-up, dan rekonsiliasi tahunan tidak dihitung.
- Tapera diisi nominal sesuai kepesertaan/slip, bukan dipaksakan pada semua
  pegawai. Pengaturan Tapera sedang dalam penataan ulang setelah Putusan MK
  No. 96/PUU-XXII/2024; jangan menganggap ketentuan pemotongan identik di setiap
  instansi tanpa bukti slip.
- KORPRI Rp100.000 bersifat opsional dan awalnya tidak aktif. Cicilan koperasi,
  bank, sewa rumah dinas, pengembalian kelebihan bayar, dan potongan lain dapat
  ditambahkan sesuai kondisi pegawai. Iuran pemberi kerja tidak dibebankan ulang.

Hasil = penghasilan − seluruh potongan pegawai. Hasil negatif tetap ditampilkan
dengan penjelasan agar potongan berlebih tidak tersembunyi. Nominal input harus
bilangan bulat rupiah, tidak negatif. Isian kosong/tidak valid pada nominal wajib
menghilangkan hasil sampai diperbaiki. Pembulatan slip dapat diisi secara manual.
Simulasi ini bukan slip resmi dan tidak mencakup THR/gaji ke-13, CPNS, pensiunan,
atau kondisi khusus pemberhentian/hukuman disiplin.

## Sumber dan validasi

Lampiran pengguna: **Peraturan-BKN-1-Tahun-2024-PENYESUAIAN-GAJI-POKOK-PNS.pdf**,
halaman PDF 9–25. Seluruh 527 nilai tabel: 494 dicocokkan dari teks dan 33 nilai
golongan IV/e pada halaman hasil pindai diperiksa visual. Empat entri MKG 33 tahun
golongan II/a–II/d dilengkapi sesuai lampiran; nilai lain dipertahankan.

- [BKN — Peraturan BKN No. 1 Tahun 2024](https://www.bkn.go.id/storage/2024/02/Peraturan-BKN-1-Tahun-2024-PENYESUAIAN-GAJI-POKOK-PNS.pdf)
- [Ketentuan keluarga](https://lldikti5.kemdiktisaintek.go.id/home/detailpost/ketentuan-tunjangan-istrisuami-dan-anak)
- [Tunjangan umum](https://jdih.kemenkeu.go.id/api/download/fulltext/2006/12tahun2006perpres.htm)
- [Tunjangan struktural](https://peraturan.go.id/files/ps26-2007.pdf)
- [Tarif beras](https://www.kemhan.go.id/itjen/2015/02/12/tunjangan-beras-pns-tni-dan-polri-naik-38-persen.html)
- [Dasar iuran pensiun dan THT](https://fiskal.kemenkeu.go.id/files/kemppkf/file/kem_ppkf_2018.pdf)
- [Iuran pensiun dan THT, konfirmasi TASPEN/BPK](https://sumsel.bpk.go.id/2024/11/06/pt-taspen-tawarkan-asuransi-kepada-pppk-bpk/)
- [BPJS — Perpres No. 59 Tahun 2024, perubahan Perpres No. 82 Tahun 2018](https://peraturan.bpk.go.id/details/285181/perpres-no-59-tahun-2024)
- [BPJS keluarga tambahan](https://djpb.kemenkeu.go.id/kppn/jakarta1/id/data-publikasi/artikel/2869-pemotongan-iuran-jaminan-kesehatan-bagi-anggota-keluarga-yang-lain.html)
- [PPh 21 — PP No. 80 Tahun 2010](https://jdih.kemenkeu.go.id/dok/pp-80-tahun-2010/view)
- [Putusan MK tentang Tapera](https://www.mkri.id/berita/uu-tapera-inkonstitusional-jika-tidak-ditata-ulang-dalam-2-tahun-23845)

Uji kalkulasi: `npm.cmd run smoke:pns-payroll`. Uji hak akses:
`npm.cmd run smoke:user-management`. Pemeriksaan build: `npm.cmd run build`.

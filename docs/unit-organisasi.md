# Jumlah pegawai pada unit organisasi

Kolom **Pegawai aktif** hanya menghitung pegawai dengan status `Aktif`, untuk seluruh jenis ASN. Penempatan mengikuti `employees.job_position_id` dan `job_positions.organization_unit_id`.

Setiap unit menampilkan jumlah pegawai aktif yang ditempatkan langsung di unit tersebut ditambah pegawai aktif pada seluruh unit bawahannya. Contohnya, pegawai Subbag masuk ke jumlah Sekretariat dan Dinas; pegawai Sub TU masuk ke jumlah UPTD dan Dinas. Satu pegawai dihitung satu kali pada setiap unit induk yang menaunginya. Jumlah tidak dipengaruhi pencarian atau kondisi buka/tutup baris pada tampilan.

Struktur mengikuti `organization_units.parent_id` yang tersimpan. Unit tanpa induk dihitung sebagai akar tersendiri. Pegawai tanpa penempatan unit tidak dimasukkan ke unit lain secara otomatis. Status Mutasi dan Pensiun tidak dihitung. Jumlah jabatan tetap menunjukkan jabatan yang terhubung langsung, termasuk untuk pemeriksaan sebelum penghapusan unit.

Perhitungan dilakukan saat pembacaan data di server dan tidak mengubah data pegawai maupun struktur unit. Tidak diperlukan migrasi skema database. Setelah perubahan status, penempatan pegawai, atau induk unit, pemuatan data berikutnya menggunakan jumlah terbaru.

Jalankan `npm.cmd run smoke:organization-units` untuk memeriksa akumulasi empat tingkat, unit terpisah, status dan penempatan, perpindahan cabang, jumlah jabatan, serta akses terautentikasi dengan database pengujian terpisah.

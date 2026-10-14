# 🛒 Kasir Dogotal - Digital Point of Sale (POS) for Traditional Retailers

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-222222?style=for-the-badge&logo=github&logoColor=white)

**KasirKu** adalah aplikasi web Kasir Digital (Point of Sale / POS) sederhana, modern, dan responsif yang dirancang khusus untuk membantu pedagang konvensional (UMKM, toko kelontong, kios pakan, dll) dalam beralih ke pengelolaan toko secara digital tanpa ribet.

---

## ✨ Fitur Utama

- **📦 Katalog Produk Interaktif:** Tampilan berbasis *grid visual* yang intuitif dengan fitur Pencarian Cepat (*Live Search*) dan Filter Kategori.
- **🛒 Manajemen Keranjang Belanja:** Menambah/mengurangi *quantity* atau menghapus produk dari keranjang secara *real-time*.
- **💵 Kalkulator Kembalian & Pecahan Cepat:** Perhitungan total dan uang kembalian otomatis dengan tombol nominal cepat (Rp 10k, 20k, 50k, 100k).
- **🧾 Modal Struk & Cetak Nota:** Cetak langsung atau simpan nota belanja sebagai PDF menggunakan `window.print()`.
- **💾 Penyimpanan Lokal (LocalStorage):** Data katalog produk dan status transaksi tersimpan aman di browser tanpa butuh *database server*.
- **📱 Responsif & Accessible:** Layout modern 2-kolom di desktop dan tetap nyaman diakses lewat tablet maupun *smartphone*.

---

## 📁 Struktur Proyek

Aplikasi ini dibangun menggunakan arsitektur modular multi-file untuk menjaga kerapian dan keterbacaan kode:

```text
minggu-1-pos-app/
├── 📄 index.html      # Struktur kerangka UI & Layout utama
├── 🎨 style.css       # Kustomisasi CSS, animasi, & scrollbar
├── 🗃️ data.js        # Data awal/dummy produk & kategori
└── ⚙️ app.js         # Logika utama (DOM manipulation, kalkulasi, & LocalStorage)


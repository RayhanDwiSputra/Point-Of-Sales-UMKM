/* ==========================================================
   data.js — Data awal (dummy) untuk Kasir Digital
   Dimuat SEBELUM app.js, sehingga konstanta di bawah ini
   tersedia secara global bagi app.js.
   ========================================================== */

// Informasi toko (tampil di header & struk). Silakan ubah sesuai toko Anda.
const STORE_INFO = {
  nama: 'Toko Sembako Ojang',
  alamat: ' Desa Sukamaju, Kec. Sukamulya, Kab. Sukabumi, Jawa Barat',
  telepon: '0882-2937-1540',
  ucapan: 'Terima kasih sudah berbelanja!',
  catatan: 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.',
  pajakPersen: 0,        // PPN default (%). Isi 11 jika ingin PPN otomatis.
  batasStokMenipis: 5    // Stok <= angka ini ditandai kuning ("menipis").
};

// Nilai cepat untuk tombol pecahan uang tunai.
const QUICK_CASH = [10000, 20000, 50000, 100000];

// Integrasi n8n (otomatisasi). Setiap transaksi dikirim ke Webhook n8n.
// Biarkan webhookUrl kosong ('') untuk menonaktifkan integrasi.
const N8N_CONFIG = {
  aktif: true,
  webhookUrl: '',     // contoh: 'https://n8n.domainanda.com/webhook/kasir-pos'
  secret: '',         // dikirim sebagai header X-Kasir-Secret; samakan dengan nilai di workflow n8n
  timeoutMs: 8000,    // batas waktu satu kali pengiriman
  retryDetik: 30,     // jeda kirim ulang otomatis untuk data yang tertunda
  maksAntrean: 200    // batas jumlah data tertunda yang disimpan di browser
};

// Data produk awal. Disimpan ke LocalStorage saat aplikasi pertama kali dibuka.
// ikon  : nama ikon Phosphor Icons (https://phosphoricons.com)
// warna : kelas Tailwind untuk latar & warna ikon kartu
const DEFAULT_PRODUCTS = [
  {
    id: 1,
    nama: 'Beras Premium 5kg',
    kategori: 'Kebutuhan Pokok',
    harga: 75000,
    stok: 20,
    ikon: 'grains',
    warna: 'bg-amber-100 text-amber-600'
  },
  {
    id: 2,
    nama: 'Minyak Goreng 2L',
    kategori: 'Kebutuhan Pokok',
    harga: 34000,
    stok: 30,
    ikon: 'drop',
    warna: 'bg-yellow-100 text-yellow-600'
  },
  {
    id: 3,
    nama: 'Gula Pasir 1kg',
    kategori: 'Kebutuhan Pokok',
    harga: 17500,
    stok: 40,
    ikon: 'cube',
    warna: 'bg-sky-100 text-sky-600'
  },
  {
    id: 4,
    nama: 'Telur Ayam 1kg',
    kategori: 'Kebutuhan Pokok',
    harga: 28000,
    stok: 25,
    ikon: 'egg',
    warna: 'bg-orange-100 text-orange-600'
  },
  {
    id: 5,
    nama: 'Kopi Instan Pack',
    kategori: 'Minuman',
    harga: 15000,
    stok: 50,
    ikon: 'coffee',
    warna: 'bg-stone-200 text-stone-700'
  },
  {
    id: 6,
    nama: 'Mie Instan Dus',
    kategori: 'Makanan',
    harga: 110000,
    stok: 15,
    ikon: 'bowl-food',
    warna: 'bg-red-100 text-red-600'
  },
  {
    id: 7,
    nama: 'Teh Celup Kotak',
    kategori: 'Minuman',
    harga: 12000,
    stok: 35,
    ikon: 'coffee',
    warna: 'bg-emerald-100 text-emerald-600'
  },
  {
    id: 8,
    nama: 'Biskuit Kaleng',
    kategori: 'Makanan',
    harga: 45000,
    stok: 4, // sengaja sedikit, untuk melihat penanda "stok menipis"
    ikon: 'cookie',
    warna: 'bg-pink-100 text-pink-600'
  }
];
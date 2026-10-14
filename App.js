/* ==========================================================
   app.js — Logika utama Kasir Digital
   Bergantung pada data.js (STORE_INFO, QUICK_CASH, DEFAULT_PRODUCTS)
   ========================================================== */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     1. Konstanta & helper
     --------------------------------------------------------- */
  const KEY_PRODUCTS = 'kasir_products_v1';
  const KEY_HISTORY = 'kasir_history_v1';
  const KEY_QUEUE = 'kasir_n8n_queue_v1';
  const MAX_HISTORY = 500;

  const $ = (sel) => document.querySelector(sel);
  const num = (n) => Math.round(n).toLocaleString('id-ID');
  const rupiah = (n) => 'Rp ' + num(n);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      toast('Gagal menyimpan ke penyimpanan lokal', 'error');
      return false;
    }
  }

  /* ---------------------------------------------------------
     2. State aplikasi
     --------------------------------------------------------- */
  const storedProducts = load(KEY_PRODUCTS, null);
  const storedHistory = load(KEY_HISTORY, []);
  const storedQueue = load(KEY_QUEUE, []);

  const state = {
    products: Array.isArray(storedProducts) && storedProducts.length ? storedProducts : clone(DEFAULT_PRODUCTS),
    history: Array.isArray(storedHistory) ? storedHistory : [],
    cart: [],                       // [{ id, qty }]
    category: 'Semua',
    search: '',
    method: 'tunai',                // 'tunai' | 'qris'
    cash: 0,
    discount: 0,                    // persen
    tax: STORE_INFO.pajakPersen || 0, // persen
    queue: Array.isArray(storedQueue) ? storedQueue : [], // data n8n yang belum terkirim
    syncing: false,
    syncError: '',
    lastSync: null
  };

  if (!storedProducts) save(KEY_PRODUCTS, state.products);

  const getProduct = (id) => state.products.find((p) => p.id === id);
  const cartQty = (id) => {
    const it = state.cart.find((i) => i.id === id);
    return it ? it.qty : 0;
  };

  /* ---------------------------------------------------------
     3. Kalkulasi
     --------------------------------------------------------- */
  function totals() {
    const subtotal = state.cart.reduce((sum, i) => {
      const p = getProduct(i.id);
      return sum + (p ? p.harga * i.qty : 0);
    }, 0);
    const discAmt = Math.round((subtotal * state.discount) / 100);
    const taxable = subtotal - discAmt;
    const taxAmt = Math.round((taxable * state.tax) / 100);
    return { subtotal, discAmt, taxAmt, total: taxable + taxAmt };
  }

  /* ---------------------------------------------------------
     4. Render: kategori & produk
     --------------------------------------------------------- */
  function renderCategories() {
    const cats = ['Semua', ...new Set(state.products.map((p) => p.kategori))];
    $('#categories').innerHTML = cats
      .map((c) => {
        const active = c === state.category;
        const cls = active
          ? 'bg-brand-600 text-white shadow'
          : 'bg-white text-slate-600 border border-slate-200 hover:bg-brand-50';
        return `<button type="button" role="tab" aria-selected="${active}" data-cat="${esc(c)}"
          class="btn-press shrink-0 min-h-[44px] px-5 rounded-full font-semibold text-sm ${cls}">${esc(c)}</button>`;
      })
      .join('');
  }

  function renderProducts() {
    const q = state.search.trim().toLowerCase();
    const list = state.products.filter(
      (p) =>
        (state.category === 'Semua' || p.kategori === state.category) &&
        (!q || p.nama.toLowerCase().includes(q) || p.kategori.toLowerCase().includes(q))
    );

    $('#product-count').textContent = `${list.length} produk`;
    const grid = $('#products-grid');

    if (!list.length) {
      grid.innerHTML = `
        <div class="col-span-full bg-white rounded-2xl border border-dashed border-slate-300 py-14 text-center text-slate-500">
          <i class="ph ph-package text-5xl text-slate-300"></i>
          <p class="mt-2 font-semibold">Produk tidak ditemukan</p>
          <p class="text-sm">Coba kata kunci atau kategori lain.</p>
        </div>`;
      return;
    }

    grid.innerHTML = list
      .map((p) => {
        const inCart = cartQty(p.id);
        const sisa = p.stok - inCart;
        const habis = sisa <= 0;
        const menipis = !habis && sisa <= STORE_INFO.batasStokMenipis;
        const badge = habis
          ? 'bg-red-100 text-red-700'
          : menipis
          ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-100 text-slate-600';
        const badgeText = habis ? 'Habis' : `Stok ${sisa}`;

        return `
        <article class="product-card bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3 ${habis ? 'opacity-60' : ''}">
          <div class="flex items-start justify-between gap-2">
            <div class="w-14 h-14 rounded-xl flex items-center justify-center text-3xl ${esc(p.warna || 'bg-slate-100 text-slate-600')}">
              <i class="ph ph-${esc(p.ikon || 'package')}"></i>
            </div>
            <span class="text-xs font-semibold px-2 py-1 rounded-full ${badge}">${badgeText}</span>
          </div>
          <div class="flex-1">
            <p class="text-xs text-slate-500">${esc(p.kategori)}</p>
            <h3 class="font-semibold leading-snug">${esc(p.nama)}</h3>
            <p class="text-brand-700 font-extrabold text-lg mt-1">${rupiah(p.harga)}</p>
            ${inCart ? `<p class="text-xs text-brand-600 font-semibold mt-0.5">${inCart} di keranjang</p>` : ''}
          </div>
          <button type="button" data-add="${p.id}" ${habis ? 'disabled' : ''}
            class="btn-press w-full min-h-[48px] rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:text-slate-500">
            <i class="ph ph-plus"></i> ${habis ? 'Stok Habis' : 'Tambah'}
          </button>
        </article>`;
      })
      .join('');
  }

  /* ---------------------------------------------------------
     5. Keranjang
     --------------------------------------------------------- */
  function addToCart(id) {
    const p = getProduct(id);
    if (!p) return;
    const item = state.cart.find((i) => i.id === id);
    const current = item ? item.qty : 0;
    if (current >= p.stok) {
      toast(`Stok ${p.nama} tidak mencukupi`, 'error');
      return;
    }
    if (item) item.qty += 1;
    else state.cart.push({ id, qty: 1 });
    refresh();
  }

  function changeQty(id, delta) {
    if (delta > 0) return addToCart(id);
    const item = state.cart.find((i) => i.id === id);
    if (!item) return;
    item.qty -= 1;
    if (item.qty <= 0) state.cart = state.cart.filter((i) => i.id !== id);
    refresh();
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter((i) => i.id !== id);
    refresh();
  }

  function clearCart() {
    if (!state.cart.length) return;
    if (!confirm('Kosongkan semua barang di keranjang?')) return;
    state.cart = [];
    refresh();
  }

  function renderCart() {
    const box = $('#cart-items');
    const count = state.cart.reduce((s, i) => s + i.qty, 0);
    $('#cart-badge').textContent = count;
    $('#btn-clear').disabled = !state.cart.length;

    if (!state.cart.length) {
      box.innerHTML = `
        <div class="py-10 text-center text-slate-400">
          <i class="ph ph-shopping-cart-simple text-5xl"></i>
          <p class="mt-2 font-semibold text-slate-500">Keranjang masih kosong</p>
          <p class="text-sm">Ketuk tombol “Tambah” pada produk.</p>
        </div>`;
      return;
    }

    box.innerHTML = state.cart
      .map((i) => {
        const p = getProduct(i.id);
        if (!p) return '';
        return `
        <div class="cart-row flex gap-3 py-3 border-b border-slate-100 last:border-0">
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm truncate">${esc(p.nama)}</p>
            <p class="text-xs text-slate-500">${rupiah(p.harga)} / item</p>
            <div class="flex items-center gap-2 mt-2">
              <button type="button" data-dec="${p.id}" aria-label="Kurangi ${esc(p.nama)}"
                class="btn-press w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-lg flex items-center justify-center"><i class="ph ph-minus"></i></button>
              <span class="w-10 text-center font-bold text-base tabular-nums">${i.qty}</span>
              <button type="button" data-inc="${p.id}" aria-label="Tambah ${esc(p.nama)}"
                class="btn-press w-10 h-10 rounded-lg bg-brand-100 hover:bg-brand-200 text-brand-700 text-lg flex items-center justify-center"><i class="ph ph-plus"></i></button>
            </div>
          </div>
          <div class="flex flex-col items-end justify-between">
            <button type="button" data-del="${p.id}" aria-label="Hapus ${esc(p.nama)}"
              class="btn-press w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center"><i class="ph ph-trash text-lg"></i></button>
            <p class="font-bold text-sm tabular-nums">${rupiah(p.harga * i.qty)}</p>
          </div>
        </div>`;
      })
      .join('');
  }

  /* ---------------------------------------------------------
     6. Pembayaran
     --------------------------------------------------------- */
  function renderQuickCash() {
    // Tombol "Uang Pas" memenuhi satu baris penuh, pecahan lain di bawahnya
    const pas = `<button type="button" data-cash="pas"
      class="btn-press col-span-2 sm:col-span-4 min-h-[48px] rounded-xl border-2 border-brand-600 text-brand-700 font-bold text-sm hover:bg-brand-50 disabled:opacity-40">Uang Pas</button>`;
    const pecahan = QUICK_CASH.map(
      (n) => `<button type="button" data-cash="${n}"
        class="btn-press min-h-[48px] rounded-xl border border-slate-200 bg-white font-semibold text-sm hover:bg-slate-50 disabled:opacity-40">${num(n)}</button>`
    ).join('');
    $('#quick-cash').className = 'grid grid-cols-2 sm:grid-cols-4 gap-2';
    $('#quick-cash').innerHTML = pas + pecahan;
  }

  function updatePayment() {
    const t = totals();
    const empty = !state.cart.length;

    $('#sum-subtotal').textContent = rupiah(t.subtotal);
    $('#sum-discount').textContent = (t.discAmt ? '- ' : '') + rupiah(t.discAmt);
    $('#sum-tax').textContent = rupiah(t.taxAmt);
    $('#sum-total').textContent = rupiah(t.total);

    // Tombol metode pembayaran
    document.querySelectorAll('#method-buttons [data-method]').forEach((b) => {
      const active = b.dataset.method === state.method;
      b.className =
        'btn-press min-h-[52px] rounded-xl border-2 font-semibold flex items-center justify-center gap-2 ' +
        (active ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50');
      b.setAttribute('aria-pressed', active);
    });

    const isCash = state.method === 'tunai';
    $('#cash-section').classList.toggle('hidden', !isCash);
    $('#qris-section').classList.toggle('hidden', isCash);
    document.querySelectorAll('#quick-cash button').forEach((b) => (b.disabled = empty));

    // Kotak kembalian
    const box = $('#change-box');
    let canPay;
    if (isCash) {
      if (empty) {
        box.className = 'rounded-xl p-3 text-center bg-slate-100 text-slate-500';
        box.innerHTML = 'Tambahkan barang untuk mulai bertransaksi';
        canPay = false;
      } else if (state.cash === 0 && t.total > 0) {
        box.className = 'rounded-xl p-3 text-center bg-slate-100 text-slate-600';
        box.innerHTML = 'Masukkan nominal uang diterima';
        canPay = false;
      } else if (state.cash < t.total) {
        box.className = 'rounded-xl p-3 text-center bg-red-50 border border-red-200 text-red-700';
        box.innerHTML = `<i class="ph ph-warning"></i> Uang kurang <b class="text-lg">${rupiah(t.total - state.cash)}</b>`;
        canPay = false;
      } else {
        box.className = 'rounded-xl p-3 text-center bg-brand-50 border border-brand-200 text-brand-800';
        box.innerHTML = `Kembalian <b class="text-2xl block">${rupiah(state.cash - t.total)}</b>`;
        canPay = true;
      }
    } else {
      canPay = !empty;
    }
    $('#btn-process').disabled = !canPay;

    // Tombol keranjang mengambang (mobile)
    const count = state.cart.reduce((s, i) => s + i.qty, 0);
    const fab = $('#fab-cart');
    fab.classList.toggle('hidden', empty);
    fab.classList.toggle('flex', !empty);
    $('#fab-count').textContent = `${count} item`;
    $('#fab-total').textContent = rupiah(t.total);
  }

  function setCash(value) {
    state.cash = value;
    $('#cash-input').value = value ? num(value) : '';
    updatePayment();
  }

  /* ---------------------------------------------------------
     7. Proses transaksi & struk
     --------------------------------------------------------- */
  function pad(n, len = 2) {
    return String(n).padStart(len, '0');
  }

  function processTransaction() {
    if (!state.cart.length) return toast('Keranjang masih kosong', 'error');

    const t = totals();
    const received = state.method === 'qris' ? t.total : state.cash;
    if (received < t.total) return toast('Nominal pembayaran kurang', 'error');

    // Validasi stok terakhir sebelum dikurangi
    for (const i of state.cart) {
      const p = getProduct(i.id);
      if (!p || p.stok < i.qty) return toast(`Stok ${p ? p.nama : 'produk'} tidak mencukupi`, 'error');
    }

    const now = new Date();
    const todayKey = now.toDateString();
    const seq = state.history.filter((h) => new Date(h.waktu).toDateString() === todayKey).length + 1;

    const items = state.cart.map((i) => {
      const p = getProduct(i.id);
      p.stok -= i.qty;
      return { nama: p.nama, harga: p.harga, qty: i.qty };
    });

    const trx = {
      id: `TRX-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(seq, 3)}`,
      waktu: now.toISOString(),
      items,
      subtotal: t.subtotal,
      diskonPersen: state.discount,
      diskon: t.discAmt,
      pajakPersen: state.tax,
      pajak: t.taxAmt,
      total: t.total,
      metode: state.method,
      bayar: received,
      kembali: received - t.total
    };

    state.history.unshift(trx);
    if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
    save(KEY_PRODUCTS, state.products);
    save(KEY_HISTORY, state.history);

    // Kirim ke n8n (masuk antrean dulu agar aman bila koneksi putus)
    enqueueEvent(buildTransaksiEvent(trx, state.cart.map((i) => i.id)));

    resetTransaction();
    refresh();
    showReceipt(trx);
    flushQueue();
  }

  function resetTransaction() {
    state.cart = [];
    state.cash = 0;
    state.discount = 0;
    state.tax = STORE_INFO.pajakPersen || 0;
    state.method = 'tunai';
    $('#cash-input').value = '';
    $('#discount-input').value = '';
    $('#tax-input').value = state.tax ? state.tax : '';
  }

  function receiptLine(label, value, bold = false) {
    return `<div class="flex justify-between gap-2 ${bold ? 'font-bold' : ''}"><span>${label}</span><span>${value}</span></div>`;
  }

  function renderReceipt(trx) {
    const d = new Date(trx.waktu);
    const tgl = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const items = trx.items
      .map(
        (i) => `
        <div class="mb-1">
          <div>${esc(i.nama)}</div>
          ${receiptLine(`${i.qty} x ${num(i.harga)}`, num(i.harga * i.qty))}
        </div>`
      )
      .join('');

    $('#receipt-print').innerHTML = `
      <div class="text-center">
        <div class="font-bold text-base">${esc(STORE_INFO.nama)}</div>
        <div>${esc(STORE_INFO.alamat)}</div>
        <div>Telp: ${esc(STORE_INFO.telepon)}</div>
      </div>
      <div class="receipt-divider"></div>
      ${receiptLine('No', esc(trx.id))}
      ${receiptLine('Tanggal', tgl)}
      ${receiptLine('Waktu', jam)}
      <div class="receipt-divider"></div>
      ${items}
      <div class="receipt-divider"></div>
      ${receiptLine('Subtotal', num(trx.subtotal))}
      ${trx.diskon ? receiptLine(`Diskon (${trx.diskonPersen}%)`, '-' + num(trx.diskon)) : ''}
      ${trx.pajak ? receiptLine(`Pajak (${trx.pajakPersen}%)`, num(trx.pajak)) : ''}
      <div class="receipt-divider"></div>
      ${receiptLine('TOTAL', num(trx.total), true)}
      ${receiptLine(`Bayar (${trx.metode === 'qris' ? 'QRIS' : 'Tunai'})`, num(trx.bayar))}
      ${receiptLine('Kembali', num(trx.kembali))}
      <div class="receipt-divider"></div>
      <div class="text-center">
        <div class="font-bold">${esc(STORE_INFO.ucapan)}</div>
        <div class="text-xs mt-1">${esc(STORE_INFO.catatan)}</div>
      </div>`;
  }

  function showReceipt(trx) {
    renderReceipt(trx);
    openModal('receipt-modal');
  }

  /* ---------------------------------------------------------
     8. Riwayat transaksi
     --------------------------------------------------------- */
  function renderHistory() {
    const today = new Date().toDateString();
    const todays = state.history.filter((h) => new Date(h.waktu).toDateString() === today);
    const revenue = todays.reduce((s, h) => s + h.total, 0);

    $('#history-summary').innerHTML = `
      <div class="rounded-xl bg-brand-50 p-3">
        <p class="text-xs text-brand-700">Transaksi hari ini</p>
        <p class="font-extrabold text-xl text-brand-800">${todays.length}</p>
      </div>
      <div class="rounded-xl bg-brand-50 p-3">
        <p class="text-xs text-brand-700">Omzet hari ini</p>
        <p class="font-extrabold text-xl text-brand-800">${rupiah(revenue)}</p>
      </div>`;

    const list = $('#history-list');
    if (!state.history.length) {
      list.innerHTML = `
        <div class="py-10 text-center text-slate-400">
          <i class="ph ph-receipt text-5xl"></i>
          <p class="mt-2 font-semibold text-slate-500">Belum ada transaksi</p>
        </div>`;
      return;
    }

    list.innerHTML = state.history
      .map((h) => {
        const d = new Date(h.waktu);
        const qty = h.items.reduce((s, i) => s + i.qty, 0);
        return `
        <button type="button" data-trx="${esc(h.id)}"
          class="btn-press w-full text-left rounded-xl border border-slate-200 p-3 hover:bg-slate-50 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-semibold text-sm truncate">${esc(h.id)}</p>
            <p class="text-xs text-slate-500">
              ${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · ${qty} item · ${h.metode === 'qris' ? 'QRIS' : 'Tunai'}
            </p>
          </div>
          <span class="font-bold text-brand-700 whitespace-nowrap">${rupiah(h.total)}</span>
        </button>`;
      })
      .join('');
  }

  function clearHistory() {
    if (!state.history.length) return;
    if (!confirm('Hapus seluruh riwayat transaksi? Stok produk tidak berubah.')) return;
    state.history = [];
    save(KEY_HISTORY, state.history);
    renderHistory();
    toast('Riwayat transaksi dihapus');
  }

  function resetAllData() {
    if (!confirm('Kembalikan stok & produk ke data awal, dan hapus seluruh riwayat?')) return;
    state.products = clone(DEFAULT_PRODUCTS);
    state.history = [];
    save(KEY_PRODUCTS, state.products);
    save(KEY_HISTORY, state.history);
    state.queue = [];
    queueSave();
    renderSync();
    state.category = 'Semua';
    state.search = '';
    $('#search-input').value = '';
    resetTransaction();
    refresh();
    renderHistory();
    toast('Data dikembalikan ke kondisi awal');
  }

  /* ---------------------------------------------------------
     9. Modal & toast
     --------------------------------------------------------- */
  function openModal(id) {
    const m = document.getElementById(id);
    m.classList.remove('hidden');
    m.classList.add('flex');
    document.body.classList.add('overflow-hidden');
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    m.classList.add('hidden');
    m.classList.remove('flex');
    if (!document.querySelector('#receipt-modal.flex, #history-modal.flex')) {
      document.body.classList.remove('overflow-hidden');
    }
  }

  function toast(msg, type = 'ok') {
    const wrap = $('#toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    const color = type === 'error' ? 'bg-red-600' : 'bg-slate-800';
    const icon = type === 'error' ? 'ph-warning-circle' : 'ph-check-circle';
    el.className = `toast ${color} text-white text-sm font-semibold rounded-xl shadow-lg px-4 py-3 flex items-center gap-2`;
    el.innerHTML = `<i class="ph ${icon} text-lg"></i><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 260);
    }, 2400);
  }

  /* ---------------------------------------------------------
     9b. Integrasi n8n (webhook + antrean kirim ulang)
     --------------------------------------------------------- */
  const n8nEnabled = () =>
    typeof N8N_CONFIG !== 'undefined' && !!N8N_CONFIG.aktif && /^https?:\/\//i.test(N8N_CONFIG.webhookUrl || '');

  const errText = (err) => (err && err.name === 'AbortError' ? 'waktu habis' : (err && err.message) || 'gagal terhubung');

  function queueSave() {
    save(KEY_QUEUE, state.queue);
  }

  // Muatan yang dikirim ke n8n untuk satu transaksi.
  // stokMenipis hanya berisi produk di transaksi ini yang stoknya sudah di bawah batas.
  function buildTransaksiEvent(trx, touchedIds) {
    const stokMenipis = state.products
      .filter((p) => touchedIds.includes(p.id) && p.stok <= STORE_INFO.batasStokMenipis)
      .map((p) => ({ id: p.id, nama: p.nama, kategori: p.kategori, stok: p.stok }));
    return {
      type: 'transaksi',
      sentAt: new Date().toISOString(),
      toko: { nama: STORE_INFO.nama },
      transaksi: trx,
      stokMenipis
    };
  }

  function enqueueEvent(evt) {
    if (!n8nEnabled()) return;
    state.queue.push(evt);
    const max = N8N_CONFIG.maksAntrean || 200;
    if (state.queue.length > max) state.queue.splice(0, state.queue.length - max);
    queueSave();
    renderSync();
  }

  async function postToN8n(payload) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), N8N_CONFIG.timeoutMs || 8000);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (N8N_CONFIG.secret) headers['X-Kasir-Secret'] = N8N_CONFIG.secret;
      const res = await fetch(N8N_CONFIG.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  // Kirim antrean satu per satu, berurutan. Berhenti di kegagalan pertama
  // dan mencoba lagi nanti (timer, koneksi kembali online, atau ketukan tombol status).
  async function flushQueue() {
    if (!n8nEnabled() || state.syncing || !state.queue.length) return true;
    state.syncing = true;
    renderSync();
    let ok = true;
    try {
      while (state.queue.length) {
        await postToN8n(state.queue[0]);
        state.queue.shift();
        queueSave();
      }
      state.lastSync = new Date();
      state.syncError = '';
    } catch (err) {
      ok = false;
      state.syncError = errText(err);
    } finally {
      state.syncing = false;
      renderSync();
    }
    return ok;
  }

  async function onSyncClick() {
    if (state.syncing) return;
    if (state.queue.length) {
      const ok = await flushQueue();
      toast(ok ? 'Data tertunda berhasil dikirim ke n8n' : `Gagal kirim ke n8n: ${state.syncError}`, ok ? 'ok' : 'error');
      return;
    }
    // Antrean kosong: ketukan berfungsi sebagai tes koneksi
    try {
      await postToN8n({ type: 'ping', sentAt: new Date().toISOString(), toko: { nama: STORE_INFO.nama } });
      state.syncError = '';
      state.lastSync = new Date();
      toast('Koneksi ke n8n berhasil');
    } catch (err) {
      state.syncError = errText(err);
      toast(`Koneksi ke n8n gagal: ${state.syncError}`, 'error');
    }
    renderSync();
  }

  function renderSync() {
    const btn = $('#btn-sync');
    if (!btn) return;
    if (!n8nEnabled()) {
      btn.className = 'hidden';
      return;
    }
    const pending = state.queue.length;
    let icon, label, tone, title, labelCls;
    if (state.syncing) {
      icon = 'ph-arrows-clockwise animate-spin';
      label = 'Mengirim…';
      tone = 'bg-slate-100 text-slate-600';
      title = 'Sedang mengirim data ke n8n';
      labelCls = 'hidden sm:inline';
    } else if (pending) {
      icon = 'ph-cloud-slash';
      label = `${pending} menunggu`;
      tone = 'bg-amber-100 text-amber-700';
      title = `${pending} data belum terkirim${state.syncError ? ' (' + state.syncError + ')' : ''}. Ketuk untuk kirim ulang.`;
      labelCls = '';
    } else {
      icon = 'ph-cloud-check';
      label = 'n8n tersambung';
      tone = 'bg-brand-100 text-brand-700';
      title = 'Semua data sudah terkirim. Ketuk untuk tes koneksi.';
      labelCls = 'hidden sm:inline';
    }
    btn.className = `btn-press min-h-[44px] px-3 rounded-xl text-sm font-semibold flex items-center gap-2 ${tone}`;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.innerHTML = `<i class="ph ${icon} text-xl"></i><span class="${labelCls}">${esc(label)}</span>`;
  }

  /* ---------------------------------------------------------
     10. Refresh gabungan & jam
     --------------------------------------------------------- */
  function refresh() {
    renderCategories();
    renderProducts();
    renderCart();
    updatePayment();
  }

  function tickClock() {
    const d = new Date();
    $('#clock-time').textContent = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    $('#clock-date').textContent = d.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  /* ---------------------------------------------------------
     11. Event listener
     --------------------------------------------------------- */
  function bindEvents() {
    // Produk & kategori
    $('#products-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-add]');
      if (btn) addToCart(Number(btn.dataset.add));
    });

    $('#categories').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      state.category = btn.dataset.cat;
      renderCategories();
      renderProducts();
    });

    $('#search-input').addEventListener('input', (e) => {
      state.search = e.target.value;
      renderProducts();
    });

    // Keranjang
    $('#cart-items').addEventListener('click', (e) => {
      const inc = e.target.closest('[data-inc]');
      const dec = e.target.closest('[data-dec]');
      const del = e.target.closest('[data-del]');
      if (inc) changeQty(Number(inc.dataset.inc), 1);
      else if (dec) changeQty(Number(dec.dataset.dec), -1);
      else if (del) removeFromCart(Number(del.dataset.del));
    });
    $('#btn-clear').addEventListener('click', clearCart);

    // Diskon & pajak
    $('#discount-input').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      state.discount = isNaN(v) ? 0 : clamp(v, 0, 100);
      updatePayment();
    });
    $('#tax-input').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      state.tax = isNaN(v) ? 0 : clamp(v, 0, 100);
      updatePayment();
    });
    ['#discount-input', '#tax-input'].forEach((sel) =>
      $(sel).addEventListener('blur', (e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) e.target.value = clamp(v, 0, 100);
      })
    );

    // Metode pembayaran
    $('#method-buttons').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-method]');
      if (!btn) return;
      state.method = btn.dataset.method;
      updatePayment();
    });

    // Pecahan cepat
    $('#quick-cash').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cash]');
      if (!btn || btn.disabled) return;
      const v = btn.dataset.cash === 'pas' ? totals().total : Number(btn.dataset.cash);
      setCash(v);
    });

    // Input uang manual (diformat otomatis)
    $('#cash-input').addEventListener('input', (e) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
      state.cash = digits ? Number(digits) : 0;
      e.target.value = digits ? num(state.cash) : '';
      updatePayment();
    });

    // Proses transaksi
    $('#btn-process').addEventListener('click', processTransaction);

    // Struk
    $('#btn-print').addEventListener('click', () => window.print());
    $('#btn-new').addEventListener('click', () => {
      closeModal('receipt-modal');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Riwayat
    $('#btn-history').addEventListener('click', () => {
      renderHistory();
      openModal('history-modal');
    });
    $('#history-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-trx]');
      if (!btn) return;
      const trx = state.history.find((h) => h.id === btn.dataset.trx);
      if (trx) {
        closeModal('history-modal');
        showReceipt(trx);
      }
    });
    $('#btn-clear-history').addEventListener('click', clearHistory);
    $('#btn-reset-data').addEventListener('click', resetAllData);

    // Tutup modal: tombol X, klik latar, tombol Esc
    document.addEventListener('click', (e) => {
      const closer = e.target.closest('[data-close]');
      if (closer) closeModal(closer.dataset.close);
      if (e.target.id === 'receipt-modal' || e.target.id === 'history-modal') closeModal(e.target.id);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal('receipt-modal');
        closeModal('history-modal');
      }
    });

    // Tombol keranjang mengambang (mobile)
    $('#fab-cart').addEventListener('click', () => {
      $('#cart-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------------------------------------------------------
     12. Inisialisasi
     --------------------------------------------------------- */
  function init() {
    $('#store-name').textContent = STORE_INFO.nama;
    document.title = `Kasir Digital — ${STORE_INFO.nama}`;
    $('#tax-input').value = state.tax ? state.tax : '';
    renderQuickCash();
    bindEvents();
    $('#btn-sync').addEventListener('click', onSyncClick);
    refresh();
    renderSync();
    tickClock();
    setInterval(tickClock, 1000);

    // n8n: kirim ulang data tertunda secara berkala dan saat koneksi kembali
    if (n8nEnabled()) {
      setInterval(flushQueue, (N8N_CONFIG.retryDetik || 30) * 1000);
      window.addEventListener('online', flushQueue);
      flushQueue();
    }
  }

  init();
})();
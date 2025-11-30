// bagfr.js - cart renderer + likes + checkout (Firestore-enabled, cleaned + Guest Checkout)
// Pastikan dipanggil di HTML dengan: <script type="module" src="./bagfr.js"></script>

import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

(() => {
  'use strict';

  /* ------------------------
     Helpers / Storage utils
     ------------------------ */
  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));

  const formatRupiah = (num) => {
    num = Math.round(Number(num) || 0);
    return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const escapeHtml = (s) =>
    String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function loadCart() { try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) { return []; } }
  function saveCart(cart) { localStorage.setItem('cart', JSON.stringify(cart || [])); }

  function loadOrders() { try { return JSON.parse(localStorage.getItem('orders') || '[]'); } catch (e) { return []; } }
  function saveOrders(arr) { localStorage.setItem('orders', JSON.stringify(arr || [])); }

  /* ------------------------
     Render cart & likes
     ------------------------ */
  function renderCart() {
    const items = loadCart();
    const container = document.getElementById('bag-items') ||
                      document.querySelector('.cart-list') ||
                      document.querySelector('.bag-items');
    if (!container) return;

    container.innerHTML = '';
    if (!items.length) {
      container.innerHTML = `<div class="empty-bag"><img src="acs/bag1.png" alt="Keranjang kosong"></div>`;
      updateSummaryTotal();
      return;
    }

    let total = 0;
    items.forEach((it, idx) => {
      const unit = Number(it.unitPrice || it.price || 0);
      const qty = Number(it.qty || 1);
      const subtotal = Number(it.subtotal || (unit * qty) || 0);
      total += subtotal;

      const addonsHtml = (it.addons && it.addons.length)
        ? it.addons.map(a => {
            const rawLabel = String(a.label || '').trim();
            const hasPriceToken = /\(\s*\+\s*\d+|Rp\b|K\)/i.test(rawLabel);
            const labelEscaped = escapeHtml(rawLabel);
            if (hasPriceToken) return `<div class="addon">${labelEscaped}</div>`;
            return `<div class="addon">${labelEscaped}${a.price ? ` (+${formatRupiah(a.price)})` : ''}</div>`;
          }).join('')
        : '';

      const imgSrc = escapeHtml(it.image || (it.images && it.images[0]) || 'assets/placeholder.png');

      const html = `
        <article class="cart-item" data-idx="${idx}" data-price="${unit}">
          <div class="thumb">
            <img src="${imgSrc}" alt="${escapeHtml(it.title||'Product')}" onerror="this.onerror=null;this.src='assets/placeholder.png'">
          </div>
          <div class="item-body">
            <div class="item-head">
              <div>
                <div class="item-title">${escapeHtml(it.title||'Untitled')}</div>
                <div class="item-meta">${addonsHtml}</div>
              </div>
              <button class="remove" title="Hapus item" aria-label="Hapus item" data-idx="${idx}">
                <img src="acs/smph.png" alt="Hapus">
              </button>
            </div>
            <div class="item-controls">
              <div class="qty-control">
                <button class="qty-btn qty-decr" aria-label="Kurangi">-</button>
                <span class="qty">${qty}</span>
                <button class="qty-btn qty-incr" aria-label="Tambah">+</button>
              </div>
              <div class="right-col">
                <div class="item-sub-value">${formatRupiah(subtotal)}</div>
              </div>
            </div>
          </div>
        </article>
      `;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html.trim();
      container.appendChild(wrapper.firstElementChild);
    });

    updateSummaryTotal(total);
  }

  function updateSummaryTotal(precalculated) {
    let total = Number(precalculated || 0);
    if (!precalculated) {
      const items = loadCart();
      total = items.reduce((s, it) =>
        s + (Number(it.subtotal) || (Number(it.unitPrice || it.price || 0) * Number(it.qty || 1))), 0);
    }
    const summaryEl = document.querySelector('.summary-value') ||
                      document.getElementById('bag-total') ||
                      document.querySelector('.bag-total');
    if (summaryEl) summaryEl.textContent = formatRupiah(total);
  }

  /* Likes */
  function loadLikes() { try { return JSON.parse(localStorage.getItem('likes') || '[]'); } catch (e) { return []; } }
  function saveLikes(arr) { localStorage.setItem('likes', JSON.stringify(arr || [])); }

  function renderLikedCards() {
    const likes = loadLikes();
    const container = document.querySelector('.liked-row') || document.getElementById('liked-row');
    if (!container) return;
    container.innerHTML = '';

    if (!likes.length) {
      container.innerHTML = '<div style="color:#888;padding:12px">You have no liked items yet.</div>';
      return;
    }

    likes.forEach(it => {
      const id = String(it.id || '');
      const title = String(it.title || '');
      const image = String(it.image || 'assets/placeholder.png');
      const price = Number(it.price || 0);
      const priceText = price ? ('Rp ' + new Intl.NumberFormat('id-ID').format(price)) : '';

      const article = document.createElement('article');
      article.className = 'like-card';
      article.setAttribute('role', 'listitem');
      article.setAttribute('data-id', id);
      article.setAttribute('data-source', it.source || (id.includes('dsri-') ? 'dsri' : (id.includes('drsi-') ? 'drsi' : '')));
      article.innerHTML = `
        <div class="like-thumb">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" onerror="this.onerror=null;this.src='assets/placeholder.png'">
        </div>
        <div class="like-body">
          <div class="like-title">${escapeHtml(title)}</div>
        </div>
        <div class="like-footer">
          ${priceText ? `<div class="like-price footer-price">${escapeHtml(priceText)}</div>` : ''}
          <button class="like-heart" aria-label="Unlike" title="Unlike" data-id="${escapeHtml(id)}" aria-pressed="false">❤</button>
        </div>
      `;
      container.appendChild(article);
    });
  }

  /* ------------------------
     Event delegation: cart + likes
     ------------------------ */
  document.addEventListener('click', function (e) {
    // cart item handlers
    const itemEl = e.target.closest('.cart-item');
    if (itemEl) {
      const idx = Number(itemEl.dataset.idx);
      let cart = loadCart();

      if (e.target.closest('.qty-incr')) {
        cart[idx].qty = (Number(cart[idx].qty || 1) + 1);
        cart[idx].subtotal = Number(cart[idx].unitPrice || cart[idx].price || 0) * cart[idx].qty;
        saveCart(cart); renderCart(); return;
      }
      if (e.target.closest('.qty-decr')) {
        cart[idx].qty = Math.max(1, Number(cart[idx].qty || 1) - 1);
        cart[idx].subtotal = Number(cart[idx].unitPrice || cart[idx].price || 0) * cart[idx].qty;
        saveCart(cart); renderCart(); return;
      }
      if (e.target.closest('.remove')) {
        cart.splice(idx, 1); saveCart(cart); renderCart(); return;
      }
    }

    // like heart
    const heart = e.target.closest('.like-heart');
    if (heart) {
      heart.setAttribute('aria-pressed', 'true');
      heart.classList.add('like-heart-pressed');
      const id = heart.dataset.id;
      setTimeout(() => {
        let likes = loadLikes();
        likes = likes.filter(x => String(x.id) !== String(id));
        saveLikes(likes);
        renderLikedCards();
        window.dispatchEvent(new CustomEvent('likes:updated', { detail: { likes } }));
      }, 180);
      e.stopPropagation();
      return;
    }

    // like card click -> navigate product
    const card = e.target.closest('.like-card');
    if (card) {
      let id = card.getAttribute('data-id') || card.dataset.id || null;
      const source = (card.getAttribute('data-source') || card.dataset.source || '').toLowerCase() || null;
      if (!id) {
        try {
          const likes = loadLikes();
          const title = card.querySelector('.like-title')?.textContent?.trim();
          const img = card.querySelector('.like-thumb img')?.src;
          const found = likes.find(x => (x.title && x.title === title) || (x.image && x.image === img));
          if (found && found.id) id = found.id;
        } catch (err) { /* ignore */ }
      }
      if (!id) { alert('Tidak dapat menemukan id produk untuk kartu ini.'); return; }

      let page = './drsi.html';
      if (source === 'dsri') page = './dsri.html';
      else if (source === 'bsri') page = './bsri.html';
      else if (id.startsWith('dsri-')) page = './dsri.html';
      else if (id.startsWith('drsi-')) page = './drsi.html';

      window.location.assign(`${page}?id=${encodeURIComponent(String(id))}`);
      return;
    }
  });

  /* render on DOM ready */
  document.addEventListener('DOMContentLoaded', () => {
    renderCart();
    renderLikedCards();
  });
  window.addEventListener('likes:updated', renderLikedCards);

  /* ------------------------
     GIFT toggle (restore feature)
     ------------------------ */
  document.addEventListener('click', function (e) {
    const tg = e.target.closest && e.target.closest('.gift-toggle');
    if (!tg) return;

    const cart = (function(){ try { return JSON.parse(localStorage.getItem('cart')||'[]'); } catch(e){ return []; } })();
    if (!cart || cart.length === 0) {
      try { tg.animate([{ transform:'scale(1)' }, { transform:'scale(1.04)' }, { transform:'scale(1)' }], { duration: 180 }); } catch (err) {}
      alert('Tambahkan dulu minimal 1 item ke Bag sebelum menjadikan pesanan sebagai hadiah 💝');
      return;
    }

    const pressed = tg.getAttribute('aria-pressed') === 'true';
    tg.setAttribute('aria-pressed', pressed ? 'false' : 'true');
    try { tg.animate([{ transform:'scale(1)' }, { transform:'scale(1.06)' }, { transform:'scale(1)' }], { duration: 180 }); } catch (err) {}

    const giftConfig = { type: 'gift', createdAt: Date.now() };
    try { localStorage.setItem('giftConfig_v1', JSON.stringify(giftConfig)); } catch (e) {}
    window.location.href = 'gif.html';
  });

  /* ------------------------
     Checkout / Orders (Firestore-enabled + Guest option)
     ------------------------ */
  function genOrderId() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let part1 = '';
    for (let i = 0; i < 5; i++) part1 += letters[Math.floor(Math.random() * letters.length)];
    let part2 = '';
    for (let i = 0; i < 4; i++) part2 += Math.floor(Math.random() * 10);
    return part1 + part2;
  }

  function loadCartSafe() { try { return JSON.parse(localStorage.getItem('cart')||'[]'); } catch(e){ return []; } }

  // local queue helpers (same strategy as cekout.js)
  function enqueueLocalOrder(order) {
    try {
      const qKey = 'order_sync_queue';
      const raw = localStorage.getItem(qKey) || '[]';
      const arr = JSON.parse(raw);
      arr.push(order);
      localStorage.setItem(qKey, JSON.stringify(arr));
      console.log('Bagfr: Order queued locally for sync (queue length):', arr.length);
    } catch (e) {
      console.error('Bagfr: enqueueLocalOrder failed', e);
    }
  }

  async function flushOrderQueue() {
    try {
      const qKey = 'order_sync_queue';
      const raw = localStorage.getItem(qKey) || '[]';
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) return;

      const user = auth.currentUser;
      if (!user) { console.warn('Bagfr flush: no authenticated user — skip flush until login.'); return; }

      console.log('Bagfr flush: Flushing order sync queue, items:', arr.length);
      for (let i = 0; i < arr.length; i++) {
        const o = arr[i];
        try {
          const firestoreOrder = {
            userId: user.uid,
            userEmail: user.email || (localStorage.getItem('maziEmail') || ''),
            userName: localStorage.getItem('maziName') || '',
            id: o.id,
            createdAt: serverTimestamp(),
            status: o.status || 'active',
            paymentStatus: o.paymentStatus || 'pending',
            total: o.total,
            items: o.items || [],
            meta: o.meta || {},
            isGift: o.isGift || false,
            gift: o.gift || null
          };

          const docRef = await addDoc(collection(db, "orders"), firestoreOrder);
          console.log('Bagfr flush: Flushed order -> firestore id:', docRef.id, 'local order id:', o.id);

          arr.splice(i, 1);
          i--;
        } catch (err) {
          console.warn('Bagfr flush: failed to push one order, will retry later', err);
          break;
        }
      }
      localStorage.setItem(qKey, JSON.stringify(arr));
    } catch (e) {
      console.error('Bagfr flushOrderQueue failed', e);
    }
  }

  // expose flush for console / signin page
  window.flushOrderQueue = flushOrderQueue;

  // register auth listener to flush when user logs in
  try {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        flushOrderQueue().catch(err => console.warn('Bagfr flush error', err));
      }
    });
  } catch (e) {
    console.warn('Bagfr: onAuthStateChanged not registered', e);
  }

  // build order object
  function buildOrderFromCart() {
    const cart = loadCartSafe();
    if (!cart.length) return null;

    let total = 0;
    const items = cart.map(it => {
      const unit = Number(it.unitPrice || it.price || 0);
      const qty = Number(it.qty || 1);
      const subtotal = Number(it.subtotal || (unit * qty) || (unit * qty));
      total += subtotal;
      return { id: it.id, title: it.title, qty, unitPrice: unit, subtotal, addons: it.addons || [], image: it.image || (it.images && it.images[0]) || '' };
    });

    const order = {
      id: genOrderId(),
      createdAt: Date.now(),
      status: 'active',
      paymentStatus: 'pending',
      total,
      items
    };

    // attach gift config if present
    try {
      const giftConfig = JSON.parse(localStorage.getItem('giftConfig_v1') || 'null');
      if (giftConfig && giftConfig.type === 'gift') {
        order.isGift = true;
        order.gift = giftConfig;
      }
    } catch (e) { /* ignore */ }

    return order;
  }

  // Checkout click handler (supports Guest Checkout)
  document.addEventListener('click', async function (e) {
    const btn = e.target.closest && e.target.closest('.checkout');
    if (!btn) return;
    e.preventDefault();

    // if not signed-in, offer Guest Checkout or redirect to sign-in
    if (!auth.currentUser) {
      const proceedAsGuest = confirm("Kamu belum sign in. Mau checkout sebagai tamu? (Pesanan tetap akan tersimpan di server.) Tekan Cancel untuk Sign In.");
      if (!proceedAsGuest) {
        try { localStorage.setItem('checkoutDraft_cart', JSON.stringify(loadCartSafe())); } catch (e) {}
        const params = new URLSearchParams({ from: 'bag', returnTo: 'bagfr.html' });
        window.location.href = 'singin.html?' + params.toString();
        return;
      }

      // Guest: try anonymous sign-in
      try {
        await signInAnonymously(auth);
        // small pause to ensure auth state settled
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error('Anonymous sign-in failed', err);
        alert('Tidak dapat melanjutkan sebagai tamu. Silakan sign in terlebih dahulu.');
        return;
      }
    }

    const order = buildOrderFromCart();
    if (!order) { alert('Keranjang kosong. Tambahkan item dulu sebelum checkout.'); return; }

    (async () => {
      const user = auth.currentUser;
      const useUid = user?.uid || localStorage.getItem('maziUID') || null;

      const firestoreOrder = {
        userId: useUid || null,
        userEmail: localStorage.getItem('maziEmail') || '',
        userName: localStorage.getItem('maziName') || '',
        id: order.id,
        createdAt: serverTimestamp(),
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        items: order.items,
        meta: order.meta || {},
        isGift: order.isGift || false,
        gift: order.gift || null
      };

      let wroteToFirestore = false;
      if (useUid) {
        try {
          const docRef = await addDoc(collection(db, "orders"), firestoreOrder);
          console.log("Bagfr: Order tersimpan di Firestore dengan id:", docRef.id);
          order.firestoreId = docRef.id;
          wroteToFirestore = true;
        } catch (err) {
          console.error("Bagfr: Gagal menyimpan order ke Firestore:", err);
        }
      } else {
        console.warn('Bagfr: no uid available, will enqueue order locally for later sync.');
      }

      if (!wroteToFirestore) {
        const queued = Object.assign({}, order, {
          userId: useUid || null,
          userEmail: localStorage.getItem('maziEmail') || '',
          userName: localStorage.getItem('maziName') || '',
          queuedAt: Date.now()
        });
        enqueueLocalOrder(queued);
        alert("Peringatan: koneksi ke server bermasalah atau belum login. Pesanan disimpan sementara dan akan dikirim ke server saat koneksi pulih / setelah login.");
      }

      // save to local orders & clear cart
      const orders = loadOrders();
      orders.unshift(order);
      saveOrders(orders);
      localStorage.removeItem('cart');
      try { localStorage.removeItem('giftConfig_v1'); } catch(e) {}
      if (typeof window.renderCart === 'function') window.renderCart();

      // WhatsApp + redirect
      const waNumber = '628118281416';
      const waText = `Halo mimin Mazi, tolong cek ongkir untuk pesanan ku dengan ID ${order.id}.`;
      const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;
      try { window.open(waUrl, '_blank'); } catch (e) {}
      window.location.href = './order.html?order=' + encodeURIComponent(order.id);
    })();
  });

})(); // end module

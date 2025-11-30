// order.js — Orders page (Firestore-aware, per-user)
// Panggil sebagai module: <script type="module" src="./order.js"></script>

import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getDocs,
  collection,
  query,
  where,
  // orderBy   // sudah tidak dipakai, jadi boleh dihapus
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

(function () {
  'use strict';

  // ===== helpers =====
  function fmt(n) {
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n || 0));
  }
  function safeParse(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      return [];
    }
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function toJsDate(value, fallbackNow = true) {
    try {
      if (!value && fallbackNow) return new Date();
      if (!value) return null;
      if (value && typeof value.toDate === 'function') {
        return value.toDate(); // Firestore Timestamp
      }
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
      return fallbackNow ? new Date() : null;
    } catch (e) {
      return fallbackNow ? new Date() : null;
    }
  }

  // ===== storage helpers =====
  function loadOrdersLocal() {
    return safeParse('orders');
  }
  function saveOrdersLocal(list) {
    try {
      localStorage.setItem('orders', JSON.stringify(list || []));
    } catch (e) {
      console.error('Failed to save orders', e);
    }
  }

  // BAG helpers (keperluan reorder)
  function loadBag() {
    try {
      return JSON.parse(localStorage.getItem('cart') || '[]');
    } catch (e) {
      return [];
    }
  }
  function saveBag(list) {
    try {
      localStorage.setItem('cart', JSON.stringify(list || []));
    } catch (e) {
      console.error('Failed to save bag items', e);
    }
  }

  // ===== small utils =====
  function guessBrand(item) {
    const idLower = String(item?.id || '').toLowerCase();
    const titleLower = String(item?.title || '').toLowerCase();
    if (idLower.startsWith('dsri') || idLower.startsWith('dessert') || titleLower.includes('dessert')) return 'Desserts';
    if (idLower.startsWith('drsi') || idLower.startsWith('drink') || titleLower.includes('latte') || titleLower.includes('drink')) return 'Drinks';
    return 'Products';
  }

  // ===== PER-USER FILTER (local + safety) =====
  function getAuthUserSnapshot() {
    if (auth && auth.currentUser) {
      return {
        uid: String(auth.currentUser.uid || '').trim(),
        email: String(auth.currentUser.email || '').trim().toLowerCase()
      };
    }
    const uidLS = (localStorage.getItem('maziUID') || '').trim();
    const emailLS = (localStorage.getItem('maziEmail') || '').trim().toLowerCase();
    return { uid: uidLS, email: emailLS };
  }

  function filterOrdersForCurrentUser(allOrders) {
    const arr = Array.isArray(allOrders) ? allOrders : [];
    const { uid, email } = getAuthUserSnapshot();

    if (!uid && !email) {
      // guest view: cuma order yang tidak punya userId & userEmail
      return arr.filter(o => !o || (!o.userId && !o.userEmail));
    }

    return arr.filter(o => {
      if (!o) return false;
      const ouid = String(o.userId || '').trim();
      const oemail = String(o.userEmail || '').trim().toLowerCase();
      if (uid && ouid && uid === ouid) return true;
      if (email && oemail && email === oemail) return true;
      return false;
    });
  }

  function filterSingleOrderForCurrentUser(order) {
    if (!order) return null;
    const filtered = filterOrdersForCurrentUser([order]);
    return filtered.length ? filtered[0] : null;
  }

  // ===== Firestore fetch & cache (per-user ONLY, no index needed) =====
  async function fetchAndCacheOrdersForUser(user) {
    try {
      if (!user) {
        saveOrdersLocal([]);
        return [];
      }

      const coll = collection(db, "orders");
      const q = query(coll, where("userId", "==", user.uid));
      const snap = await getDocs(q);

      let arr = snap.docs.map(d => {
        const data = d.data() || {};
        return { id: d.id, ...data };
      });

      // sort manual berdasarkan createdAt (desc)
      arr.sort((a, b) => {
        const da = toJsDate(a.createdAt, false);
        const dbd = toJsDate(b.createdAt, false);
        const ta = da ? da.getTime() : 0;
        const tb = dbd ? dbd.getTime() : 0;
        return tb - ta; // terbaru duluan
      });

      // double safety: filter lagi
      const uid = String(user.uid || '').trim();
      const email = String(user.email || '').trim().toLowerCase();
      arr = arr.filter(o => {
        const ouid = String(o.userId || '').trim();
        const oemail = String(o.userEmail || '').trim().toLowerCase();
        if (uid && ouid && uid === ouid) return true;
        if (email && oemail && email === oemail) return true;
        return false;
      });

      saveOrdersLocal(arr);
      console.log('Orders fetched for user', uid, 'count =', arr.length);
      return arr;
    } catch (err) {
      console.warn('Failed to fetch orders from Firestore, using local cache only:', err);
      // 🔥 Bedanya di sini: kita TIDAK overwrite lagi localStorage,
      // cuma pakai apa yang sudah ada.
      const cached = loadOrdersLocal() || [];
      return filterOrdersForCurrentUser(cached);
    }
  }

  // ===== Render functions =====
  function renderOrderCardSummary(order, opts) {
    const ctx = (opts && opts.context) || '';
    const isHistory = ctx === 'history';
    const first = order.items && order.items[0];
    const moreCount = Math.max(0, (order.items || []).length - 1);
    const brand = first ? guessBrand(first) : 'Products';
    const imgHtml = (first && first.image)
      ? '<img src="' + escapeHtml(first.image) + '" alt="' + escapeHtml(first.title) + '" style="width:68px;height:68px;object-fit:cover;border-radius:8px">'
      : '<div class="thumb"></div>';
    const status = order.status || 'active';
    const createdDate = toJsDate(order.createdAt);
    const created = createdDate ? createdDate.toLocaleString('id-ID') : '';

    let actionsHtml = '';
    if (isHistory && String(status).toLowerCase() === 'cancelled') {
      actionsHtml =
        '  <div class="order-actions">' +
        '    <button class="btn-outline reorder-btn" data-order-id="' + escapeHtml(order.id) + '">Reorder</button>' +
        '    <button class="btn-light view-details" data-order-id="' + escapeHtml(order.id) + '">View Details</button>' +
        '  </div>';
    } else {
      const secondLabel = isHistory ? 'Reorder' : 'View Details';
      const secondClass = isHistory ? 'reorder-btn' : 'view-details';
      actionsHtml =
        '  <div class="order-actions">' +
        '    <button class="btn-outline track-btn" data-order-id="' + escapeHtml(order.id) + '">Track Order</button>' +
        '    <button class="btn-light ' + secondClass + '" data-order-id="' + escapeHtml(order.id) + '">' + secondLabel + '</button>' +
        '  </div>';
    }

    const article = document.createElement('article');
    article.className = 'order-card';
    article.innerHTML =
      '<div class="thumb">' + imgHtml + '</div>' +
      '<div class="order-info">' +
      '  <div class="order-top">' +
      '    <h3 class="product-title">' + escapeHtml(first ? first.title : 'No title') + '</h3>' +
      '    <span class="more">' + (moreCount > 0 ? '+' + moreCount + ' More' : '') + '</span>' +
      '  </div>' +
      '  <p class="brand">' + escapeHtml(brand) + '</p>' +
      '  <div class="status-row">' +
      '    <span class="status">Status : <strong>' + escapeHtml(status) + '</strong></span>' +
      '    <span class="eta">Created : <em>' + escapeHtml(created) + '</em></span>' +
      '  </div>' +
           actionsHtml +
      '</div>';

    article.querySelectorAll('.view-details').forEach(btn => {
      btn.addEventListener('click', function () {
        renderOrderDetails(this.dataset.orderId);
      });
    });
    article.querySelectorAll('.reorder-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.dataset.orderId;
        if (!id) return;
        reorderFromHistory(id);
      });
    });
    article.querySelectorAll('.track-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.dataset.orderId;
        if (!id) return;
        window.location.href = 'ditel.html?id=' + encodeURIComponent(id);
      });
    });

    return article;
  }

  function renderActive() {
    const panel = document.getElementById('tab-active');
    if (!panel) return;
    panel.innerHTML = '';

    const ordersAll = loadOrdersLocal() || [];
    const orders = filterOrdersForCurrentUser(ordersAll);

    let activeOrders = orders.filter(o => String(o.status || '').toLowerCase() === 'active');

    if (!activeOrders.length) {
      activeOrders = orders.filter(o => !o.status);
    }

    if (!activeOrders.length) {
      panel.innerHTML = '<div style="padding:16px;color:#666">Tidak ada pesanan aktif saat ini.</div>';
      return;
    }

    activeOrders.forEach(o => panel.appendChild(renderOrderCardSummary(o, { context: 'active' })));
  }

  function renderSchedule() {
    const panel = document.getElementById('tab-schedule') || document.getElementById('tab-scheduled');
    if (!panel) return;
    panel.innerHTML = '';

    const ordersAll = loadOrdersLocal() || [];
    const orders = filterOrdersForCurrentUser(ordersAll);

    const scheduled = (orders || []).filter(o => {
      const st = String(o.status || '').toLowerCase();
      if (['delivered', 'completed', 'cancelled'].includes(st)) return false;
      return st === 'scheduled' || o.scheduledAt;
    });

    if (!scheduled.length) {
      panel.innerHTML = '<div style="padding:16px;color:#666">No scheduled orders.</div>';
      return;
    }

    scheduled.forEach(o => panel.appendChild(renderOrderCardSummary(o, { context: 'scheduled' })));
  }

  function renderHistory() {
    const panel = document.getElementById('tab-history');
    if (!panel) return;
    panel.innerHTML = '';

    const ordersAll = loadOrdersLocal() || [];
    const orders = filterOrdersForCurrentUser(ordersAll);

    const historyOrders = orders.filter(o => {
      const st = String(o.status || '').toLowerCase();
      return ['delivered', 'completed', 'cancelled'].includes(st);
    });

    if (!historyOrders.length) {
      panel.innerHTML = '<div style="padding:16px;color:#666">History kosong.</div>';
      return;
    }

    historyOrders.forEach(o => panel.appendChild(renderOrderCardSummary(o, { context: 'history' })));
  }

  function reorderFromHistory(orderId) {
    const ordersAll = loadOrdersLocal() || [];
    const orders = filterOrdersForCurrentUser(ordersAll);
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order) { alert('Order tidak ditemukan.'); return; }

    let cart = loadBag() || [];
    (order.items || []).forEach((it, idx) => {
      if (!it) return;
      const qty = Number(it.qty || 1);
      const unit = Number(it.unitPrice || it.price || 0);
      const subtotal = Number(it.subtotal || (unit * qty));
      const item = {
        id: it.id || (`reorder-${order.id}-${idx}`),
        title: it.title || '',
        unitPrice: unit,
        qty: qty,
        subtotal: subtotal,
        image: it.image || (it.images && it.images[0]) || 'assets/placeholder.png',
        addons: it.addons || [],
        source: 'reorder'
      };
      cart.push(item);
    });

    saveBag(cart);
    alert('Barang dari order ini sudah dimasukkan ke Bag ✔');
    window.location.href = 'bagfr.html';
  }

  function renderOrderDetails(orderId) {
    const ordersAll = loadOrdersLocal();
    const orders = filterOrdersForCurrentUser(ordersAll);
    let order = (orders || []).find(o => String(o.id) === String(orderId));
    order = filterSingleOrderForCurrentUser(order);

    const panelIds = ['tab-active', 'tab-schedule', 'tab-scheduled', 'tab-history'];
    let panel = null;
    for (const id of panelIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      const hiddenByDisplay = el.style.display === 'none';
      const hiddenByClass = el.classList.contains('hidden');
      if (!hiddenByDisplay && !hiddenByClass) { panel = el; break; }
    }
    if (!panel) panel = document.getElementById('tab-history') || document.getElementById('tab-active');
    if (!panel) return;
    panel.innerHTML = '';
    if (!order) { panel.innerHTML = '<div style="padding:12px;color:#c33">Order tidak ditemukan.</div>'; return; }

    const h = document.createElement('h2'); h.textContent = 'Order Details'; panel.appendChild(h);

    const list = document.createElement('div'); list.style.marginTop = '12px';
    (order.items || []).forEach(it => {
      const itEl = document.createElement('div'); itEl.style.padding = '10px 0';
      itEl.innerHTML =
        '<div style="display:flex;gap:12px;align-items:center">' +
        '  <div style="width:56px;height:56px;border-radius:8px;overflow:hidden;background:#f5f5f7;flex:0 0 56px">' +
        (it.image ? '<img src="' + escapeHtml(it.image) + '" style="width:100%;height:100%;object-fit:cover">' : '') +
        '  </div>' +
        '  <div style="flex:1">' +
        '    <div style="font-weight:700">' + escapeHtml(it.title) + '</div>' +
        (it.addons && it.addons.length ? '<div style="color:#666;margin-top:6px">' + it.addons.map(a => escapeHtml(a.label)).join(', ') + '</div>' : '') +
        '    <div style="color:#666;margin-top:6px">' + (it.qty || 0) + ' × ' + fmt(it.unitPrice) + ' = ' + fmt(it.subtotal) + '</div>' +
        '  </div>' +
        '</div>';
      list.appendChild(itEl);
    });
    panel.appendChild(list);

    if (order.isGift && order.gift) {
      const giftBox = document.createElement('div');
      giftBox.className = 'order-gift-block';
      giftBox.style.marginTop = '12px'; giftBox.style.padding = '12px'; giftBox.style.borderRadius = '10px'; giftBox.style.background = '#fff6fb';
      const revealLabel = String(order.gift.revealMode || 'reveal') === 'surprise' ? 'Keep it a surprise' : 'Reveal it now';
      let scheduleHtml = '';
      if (order.scheduledAt) {
        try {
          const dt = toJsDate(order.scheduledAt);
          scheduleHtml = '<div><strong>Schedule:</strong> ' + escapeHtml(dt.toLocaleString('id-ID')) + '</div>';
        } catch (e) {}
      }
      const messageHtml = order.gift.message ? '<div><strong>Message:</strong> ' + escapeHtml(order.gift.message) + '</div>' : '';
      const fromHtml = order.gift.fromName ? '<div><strong>From:</strong> ' + escapeHtml(order.gift.fromName) + '</div>' : '';
      const themeHtml = order.gift.theme ? '<div><strong>Card theme:</strong> ' + escapeHtml(order.gift.theme) + '</div>' : '';
      giftBox.innerHTML = '<div style="font-weight:600;margin-bottom:4px">🎁 Gift details</div>' + messageHtml + fromHtml + '<div><strong>Reveal:</strong> ' + escapeHtml(revealLabel) + '</div>' + themeHtml + scheduleHtml;
      panel.appendChild(giftBox);
    }

    const rawRecipient = order.meta && typeof order.meta.recipient === 'string' ? order.meta.recipient.trim() : '';
    if (rawRecipient) {
      const addrBlock = document.createElement('div'); addrBlock.className = 'order-address-block';
      const addrHtml = escapeHtml(rawRecipient).replace(/\n/g, '<br>');
      addrBlock.innerHTML = `<div class="order-address-head"><span class="title">Recipient</span></div><div class="order-address-body"><div class="line-address">${addrHtml}</div></div>`;
      panel.appendChild(addrBlock);
    } else {
      const savedAddrs = safeParse('savedAddresses_v1');
      let chosenAddr = null;
      if (Array.isArray(savedAddrs) && savedAddrs.length) chosenAddr = savedAddrs.find(a => a && a.isDefault) || savedAddrs[0];
      if (chosenAddr) {
        const addrBlock = document.createElement('div'); addrBlock.className = 'order-address-block';
        const label = escapeHtml(chosenAddr.label || ''); const name = escapeHtml(chosenAddr.name || ''); const phone = escapeHtml(chosenAddr.phone || ''); const addrHtml = escapeHtml(chosenAddr.address || '').replace(/\n/g, '<br>');
        const combined = `${label ? label : ''}${label && name ? ' - ' : ''}${name ? name : ''}`;
        addrBlock.innerHTML = `<div class="order-address-head"><span class="title">Address</span><a href="drafamt.html" class="edit-link small">Edit</a></div><div class="order-address-body"><div class="line-combined">${combined}</div>${phone ? `<div class="line-phone">${phone}</div>` : ''}<div class="line-address">${addrHtml}</div></div>`;
        panel.appendChild(addrBlock);
      }
    }

    const rawPaymentStatus = (order.paymentStatus || 'pending').toLowerCase();
    const rawStatus = (order.status || '').toLowerCase();
    const isPaid = rawPaymentStatus === 'paid';
    const isRejected = rawPaymentStatus === 'rejected' || rawStatus === 'cancelled';

    const note = document.createElement('div');
    let noteClass = 'pending'; let noteHtml = '';
    if (isPaid) {
      noteClass = 'paid';
      noteHtml = '<div>Status pesanan: <strong>Pesanan ' + escapeHtml(order.id || '') + ' sudah dibayar.</strong></div><div class="status">Pembayaran sudah diterima admin ✅</div><div class="track-hint">Anda dapat men-track order Anda dari halaman Orders / Active.</div>';
    } else if (isRejected) {
      noteHtml = '<div style="font-weight:600">⛔ Orderan ini dicancel oleh admin</div><div class="status">Status pembayaran: <strong style="color:#c00">Ditolak admin</strong></div><div class="track-hint" style="color:#c00">Silakan hubungi admin jika ada kesalahan.</div>';
    } else {
      noteClass = 'pending';
      noteHtml = '<div>Segera melakukan pembayaran melalui WhatsApp kepada toko agar orderan Anda dapat di-ACC.</div><div class="status">Status pembayaran: <strong>Pembayaran belum diterima admin</strong></div>';
    }
    if (!isRejected) { note.className = 'order-payment-note ' + noteClass; note.innerHTML = noteHtml; }
    panel.appendChild(note);

    const tot = document.createElement('div'); tot.style.marginTop = '12px'; tot.style.fontWeight = '700'; tot.textContent = 'Total: ' + fmt(order.total); panel.appendChild(tot);

    const back = document.createElement('div'); back.style.marginTop = '12px'; back.innerHTML = '<button class="btn-light" id="back-to-summary">Back to summary</button>'; panel.appendChild(back);
    const backBtn = back.querySelector('#back-to-summary');
    if (backBtn) backBtn.addEventListener('click', function () { renderAllLists(); });
  }

  // ===== NOTIF BADGE (optional) =====
  function updateNotifBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const notifs = safeParse('notifications_v1');
    const hasUnread = Array.isArray(notifs) && notifs.some(n => !n.isRead);
    if (hasUnread) badge.classList.add('show'); else badge.classList.remove('show');
  }

  function renderAllLists() {
    renderActive();
    renderSchedule();
    renderHistory();
  }

  function attachTabHandlers() {
    document.querySelectorAll('[data-order-tab],[data-tab]').forEach(btn => {
      btn.addEventListener('click', function () {
        const targetName = this.dataset.orderTab || this.dataset.tab;
        if (!targetName) return;
        const nameToId = { active: 'tab-active', scheduled: 'tab-scheduled', schedule: 'tab-schedule', history: 'tab-history' };
        const targetId = nameToId[targetName] || targetName;
        const panels = ['tab-active', 'tab-scheduled', 'tab-schedule', 'tab-history'];
        panels.forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          const isActive = id === targetId;
          el.style.display = isActive ? '' : 'none';
          el.classList.toggle('hidden', !isActive);
        });
        document.querySelectorAll('[data-order-tab],[data-tab]').forEach(tb => {
          const name = tb.dataset.orderTab || tb.dataset.tab;
          const isActive = name === targetName;
          tb.classList.toggle('tab-active', isActive);
          tb.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
      });
    });
  }

  onAuthStateChanged(auth, async (user) => {
    try {
      // clear dulu, nanti diisi hasil fetch
      saveOrdersLocal([]);
      renderAllLists();
      updateNotifBadge();

      if (!user) {
        console.log('No user logged in — orders cleared.');
        return;
      }

      await fetchAndCacheOrdersForUser(user);
      renderAllLists();
    } catch (e) {
      console.error('Auth-state handling error', e);
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    try {
      renderAllLists();
      attachTabHandlers();
      updateNotifBadge();
      window.addEventListener('storage', function (e) {
        if (e.key === 'notifications_v1' || e.key === 'orders') {
          renderAllLists();
          updateNotifBadge();
        }
      });
    } catch (e) {
      console.error('order init error', e);
    }
  });

  window.renderAllOrders = renderAllLists;
  window.renderOrderDetails = renderOrderDetails;
  window.updateNotifBadge = updateNotifBadge;
})();

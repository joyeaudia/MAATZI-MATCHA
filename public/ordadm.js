// ordadm.js — admin view orders + notifikasi + history
// PENTING: di HTML admin gunakan: <script type="module" src="./ordadm.js"></script>

import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

(function () {
  'use strict';

  // ===== HELPER DASAR =====
  function safeParse(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveOrders(list) {
    try {
      localStorage.setItem('orders', JSON.stringify(list || []));
    } catch (e) {
      console.error('Failed to save orders', e);
    }
  }

  function fmt(n) {
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n || 0));
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

  function loadOrders() {
    return safeParse('orders');
  }

  // ===== STATE FILTER =====
  // 'all' | 'gift' | 'history'
  let currentFilter = 'all';

  // ===== HELPER NOTIFIKASI (ADMIN ACC / REJECT) =====
  function addNotifForOrder(order, kind) {
    let notifs;
    try {
      notifs = JSON.parse(localStorage.getItem('notifications_v1') || '[]');
    } catch (e) {
      notifs = [];
    }

    const now = new Date();
    let title = '';
    let message = '';
    let emoji = '';

    if (kind === 'approved') {
      title = 'Payment Confirmed';
      emoji = '💸';
      message =
        'Order ' +
        (order.id || '') +
        ' telah dikonfirmasi dan pembayaran sudah diterima admin.';
    } else if (kind === 'rejected') {
      title = 'Order Rejected';
      emoji = '⛔';
      message =
        'Order ' +
        (order.id || '') +
        ' telah ditolak / dibatalkan oleh admin.';
    }

    const newNotif = {
      id: 'adm-' + kind + '-' + (order.id || '') + '-' + now.getTime(),
      title: title,
      message: message,
      emoji: emoji,
      time: 'Just now',
      isRead: false
    };

    notifs.unshift(newNotif);

    try {
      localStorage.setItem('notifications_v1', JSON.stringify(notifs));
    } catch (e) {
      console.error('Failed to save notifications', e);
    }
  }

  // ====== FIRESTORE SYNC (UPDATE STATUS & PAYMENT) ======
  async function syncOrderStatusToFirestore(order) {
    try {
      if (!order || !order.id) return;

      let docId = order.firestoreId || null;

      // kalau belum punya firestoreId, cari berdasarkan field "id"
      if (!docId) {
        const coll = collection(db, "orders");
        const q = query(coll, where("id", "==", order.id));
        const snap = await getDocs(q);
        if (snap.empty) {
          console.warn("Tidak menemukan dokumen Firestore untuk order", order.id);
          return;
        }
        const firstDoc = snap.docs[0];
        docId = firstDoc.id;
        // simpan supaya panggilan berikutnya tidak perlu query lagi
        order.firestoreId = docId;
      }

      const ref = doc(db, "orders", docId);
      const payload = {};

      if (typeof order.status !== 'undefined') {
        payload.status = order.status;
      }
      if (typeof order.paymentStatus !== 'undefined') {
        payload.paymentStatus = order.paymentStatus;
      }

      await updateDoc(ref, payload);
      console.log('Order updated in Firestore:', order.id, payload);
    } catch (err) {
      console.error('Gagal sync order ke Firestore:', err);
    }
  }

  // ===== LIST DI HALAMAN ADMIN =====
  function renderAdminList() {
    const container = document.getElementById('order-list');
    if (!container) return;

    container.innerHTML = '';

    let orders = loadOrders() || [];

    // jangan tampilkan yg sudah dibatalkan
    orders = orders.filter(
      o => String(o.status || '').toLowerCase() !== 'cancelled'
    );

    // pisah history vs non-history
    if (currentFilter === 'history') {
      // hanya order yang sudah selesai (completed)
      orders = orders.filter(o => {
        const st = String(o.status || '').toLowerCase();
        return st === 'completed';
      });
    } else {
      // filter utama: jangan tampilkan completed di "Semua" dan "Gift saja"
      orders = orders.filter(o => {
        const st = String(o.status || '').toLowerCase();
        return st !== 'completed';
      });

      if (currentFilter === 'gift') {
        orders = orders.filter(o => !!o.isGift && !!o.gift);
      }
    }

    if (!orders.length) {
      container.innerHTML =
        '<div style="color:#777;font-size:13px;">Belum ada order.</div>';
      return;
    }

    orders.forEach(order => {
      container.appendChild(renderAdminCard(order));
    });
  }

  // ===== SATU KARTU ADMIN (VERSI COMPACT + TOGGLE DETAIL) =====
  function renderAdminCard(order) {
    const card = document.createElement('article');
    card.className = 'admin-order-card';

    const created = new Date(order.createdAt || Date.now()).toLocaleString();
    const status = (order.status || 'active').toLowerCase();
    const paymentStatus = (order.paymentStatus || 'pending').toLowerCase();

    // coloring:
    if (status === 'completed') {
      card.classList.add('is-completed');
    } else if (paymentStatus === 'paid') {
      card.classList.add('is-paid');
    }

    // gift flag
    const isGift = !!order.isGift && !!order.gift;
    if (isGift) {
      card.classList.add('gift');
    }

    // schedule text (dipakai di gift block & summary)
    let scheduleText = '';
    if (order.scheduledAt) {
      try {
        scheduleText = new Date(order.scheduledAt).toLocaleString('id-ID');
      } catch (e) {}
    }

    // summary item: ambil item pertama
    const firstItem =
      order.items && order.items[0] ? order.items[0] : null;
    const firstItemTitle = firstItem
      ? firstItem.title || firstItem.name || ''
      : '(no items)';

    // ===== address / recipient untuk admin =====
    const rawRecipient =
      order.meta && typeof order.meta.recipient === 'string'
        ? order.meta.recipient.trim()
        : '';

    const savedAddrs = safeParse('savedAddresses_v1');
    let chosenAddr = null;
    if (Array.isArray(savedAddrs) && savedAddrs.length) {
      chosenAddr =
        savedAddrs.find(a => a && a.isDefault) || savedAddrs[0];
    }

    let addrBlock = '';

    if (rawRecipient) {
      const addrHtml = escapeHtml(rawRecipient).replace(/\n/g, '<br>');
      addrBlock = `
        <div class="admin-address">
          <div class="admin-address-title">Recipient</div>
          <div class="admin-address-main">
            <div>${addrHtml}</div>
          </div>
        </div>
      `;
    } else if (chosenAddr) {
      const label = escapeHtml(chosenAddr.label || '');
      const name = escapeHtml(chosenAddr.name || '');
      const phone = escapeHtml(chosenAddr.phone || '');
      const addrHtml = escapeHtml(chosenAddr.address || '').replace(
        /\n/g,
        '<br>'
      );
      const combined = `${label ? label : ''}${
        label && name ? ' - ' : ''
      }${name ? name : ''}`;

      addrBlock = `
        <div class="admin-address">
          <div class="admin-address-title">Address</div>
          <div class="admin-address-main">
            <div>${combined}</div>
            ${phone ? `<div>${phone}</div>` : ''}
            <div>${addrHtml}</div>
          </div>
        </div>
      `;
    }

    // ===== GIFT INFO DETAIL (di dalam detail area) =====
    let giftInfoHtml = '';

    if (isGift) {
      const revealLabel =
        String(order.gift.revealMode || 'reveal') === 'surprise'
          ? 'Keep it a surprise'
          : 'Reveal it now';

      giftInfoHtml = `
        <div class="admin-gift-block">
          <div class="admin-gift-title">🎁 Gift order</div>
          ${
            order.gift.message
              ? `<div class="admin-gift-line"><strong>Message:</strong> ${escapeHtml(
                  order.gift.message
                )}</div>`
              : ''
          }
          ${
            order.gift.fromName
              ? `<div class="admin-gift-line"><strong>From:</strong> ${escapeHtml(
                  order.gift.fromName
                )}</div>`
              : ''
          }
          <div class="admin-gift-line"><strong>Reveal:</strong> ${escapeHtml(
            revealLabel
          )}</div>
          ${
            scheduleText
              ? `<div class="admin-gift-line"><strong>Schedule:</strong> ${escapeHtml(
                  scheduleText
                )}</div>`
              : ''
          }
        </div>
      `;
    }

    // ===== ITEMS DETAIL UNTUK ADMIN =====
    let itemsHtml = '';

    (order.items || []).forEach(it => {
      if (!it) return;

      const title = escapeHtml(it.title || it.name || '');

      const addonsHtml =
        it.addons && it.addons.length
          ? '<div class="admin-item-addons">' +
            it.addons.map(a => escapeHtml(a.label || '')).join(', ') +
            '</div>'
          : '';

      const qty = Number(it.qty || 0);
      const unit = Number(it.unitPrice || it.price || 0);
      const lineTotal = Number(it.subtotal || unit * qty);
      const priceLine =
        qty + ' × ' + fmt(unit) + ' = ' + fmt(lineTotal);

      itemsHtml += `
        <div class="admin-item-row">
          <div class="admin-item-main">
            <div class="admin-item-title">${title}</div>
            ${addonsHtml}
            <div class="admin-item-price">${escapeHtml(priceLine)}</div>
          </div>
        </div>
      `;
    });

    const badgePaymentClass =
      paymentStatus === 'paid'
        ? 'badge-payment paid'
        : paymentStatus === 'rejected'
        ? 'badge-payment rejected'
        : 'badge-payment';

    // ========== MARKUP UTAMA CARD (SUMMARY + DETAIL COLLAPSIBLE) ==========
    card.innerHTML = `
      <div class="admin-order-header">
        <div>
          <div class="admin-order-id">Order ID: ${escapeHtml(
            order.id || '(no id)'
          )}</div>
          <div class="admin-order-created">${escapeHtml(created)}</div>
        </div>
        <div class="admin-order-total">
          <span class="admin-total-label">Total</span>
          <span class="admin-total-value">${fmt(order.total)}</span>
        </div>
      </div>

      <div class="admin-status-row">
        <span class="badge badge-status">${escapeHtml(status)}</span>
        <span class="badge ${badgePaymentClass}">${escapeHtml(
          paymentStatus
        )}</span>
      </div>

      <div class="admin-summary-row">
        <span class="summary-chip">${isGift ? '🎁 Gift' : 'Order'}</span>
        <span class="summary-main">${escapeHtml(firstItemTitle)}</span>
        ${
          scheduleText && isGift
            ? `<span class="summary-schedule"> · ${escapeHtml(
                scheduleText
              )}</span>`
            : ''
        }
        <button type="button" class="btn-toggle-detail" aria-expanded="false">
          Detail
        </button>
      </div>

      <div class="admin-details">
        ${giftInfoHtml}
        <div class="admin-items">
          ${itemsHtml}
        </div>
        ${addrBlock}
        <div class="admin-actions">
          <button class="btn btn-approve" data-id="${escapeHtml(
            order.id
          )}">ACC (sudah dibayar)</button>
          <button class="btn btn-reject" data-id="${escapeHtml(
            order.id
          )}">Tolak order</button>
          <button class="btn btn-delivered" data-id="${escapeHtml(
            order.id
          )}">Mark as delivered</button>
        </div>
      </div>
    `;

    const approveBtn = card.querySelector('.btn-approve');
    const rejectBtn = card.querySelector('.btn-reject');
    const deliveredBtn = card.querySelector('.btn-delivered');
    const detailsEl = card.querySelector('.admin-details');
    const toggleBtn = card.querySelector('.btn-toggle-detail');

    // default: di hp detail di-collapse, di desktop terbuka
    if (detailsEl) {
      if (window.innerWidth < 600) {
        detailsEl.classList.add('collapsed');
        if (toggleBtn) {
          toggleBtn.setAttribute('aria-expanded', 'false');
          toggleBtn.textContent = 'Detail';
        }
      } else {
        detailsEl.classList.remove('collapsed');
        if (toggleBtn) {
          toggleBtn.setAttribute('aria-expanded', 'true');
          toggleBtn.textContent = 'Sembunyikan';
        }
      }
    }

    if (toggleBtn && detailsEl) {
      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isCollapsed = detailsEl.classList.toggle('collapsed');
        this.setAttribute('aria-expanded', String(!isCollapsed));
        this.textContent = isCollapsed ? 'Detail' : 'Sembunyikan';
      });
    }

    const isFinal =
      status === 'completed' || status === 'cancelled';

    // ===== ATUR VISIBILITAS TOMBOL SESUAI STATUS & PAYMENT =====
    if (isFinal) {
      if (approveBtn) approveBtn.style.display = 'none';
      if (rejectBtn) rejectBtn.style.display = 'none';
      if (deliveredBtn) deliveredBtn.style.display = 'none';
    } else if (paymentStatus === 'paid') {
      if (approveBtn) approveBtn.style.display = 'none';
      if (rejectBtn) rejectBtn.style.display = 'none';
    } else {
      if (deliveredBtn) deliveredBtn.style.display = 'none';
    }

    // ===== EVENT BUTTON ACC =====
    if (approveBtn) {
      approveBtn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const id = this.dataset.id;
        const all = loadOrders();
        const idx = all.findIndex(o => String(o.id) === String(id));
        if (idx !== -1) {
          all[idx].paymentStatus = 'paid';
          if (!all[idx].status) all[idx].status = 'active';

          addNotifForOrder(all[idx], 'approved');

          saveOrders(all);
          renderAdminList();

          // SYNC KE FIRESTORE
          try {
            await syncOrderStatusToFirestore(all[idx]);
          } catch (err) {
            console.error('Error sync saat ACC:', err);
          }

          alert('Order di-set sebagai SUDAH DIBAYAR.');
        }
      });
    }

    // ===== EVENT BUTTON REJECT =====
    if (rejectBtn) {
      rejectBtn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const id = this.dataset.id;
        const all = loadOrders();
        const idx = all.findIndex(o => String(o.id) === String(id));
        if (idx !== -1) {
          all[idx].paymentStatus = 'rejected';
          all[idx].status = 'cancelled';

          addNotifForOrder(all[idx], 'rejected');

          saveOrders(all);
          renderAdminList();

          // SYNC KE FIRESTORE
          try {
            await syncOrderStatusToFirestore(all[idx]);
          } catch (err) {
            console.error('Error sync saat REJECT:', err);
          }

          alert('Order telah DITOLAK / dibatalkan oleh admin.');
        }
      });
    }

    // ===== EVENT BUTTON DELIVERED =====
    if (deliveredBtn) {
      deliveredBtn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const id = this.dataset.id;
        const all = loadOrders();
        const idx = all.findIndex(o => String(o.id) === String(id));
        if (idx !== -1) {
          if (
            String(all[idx].paymentStatus || '').toLowerCase() !== 'paid'
          ) {
            alert(
              'Order harus sudah dibayar sebelum ditandai sebagai delivered.'
            );
            return;
          }

          all[idx].status = 'completed'; // <-- status untuk History
          saveOrders(all);
          renderAdminList();

          // SYNC KE FIRESTORE
          try {
            await syncOrderStatusToFirestore(all[idx]);
          } catch (err) {
            console.error('Error sync saat DELIVERED:', err);
          }

          alert('Order ditandai sebagai DELIVERED dan pindah ke History.');
        }
      });
    }

    // ===== KLIK KARTU -> BUKA DETAIL ADMIN (hanya paid) =====
    card.addEventListener('click', function (e) {
      if (
        e.target.closest('.admin-actions') ||
        e.target.closest('.btn-toggle-detail')
      )
        return;

      if (paymentStatus !== 'paid') return;

      const oid = order.id || '';
      if (!oid) return;
      window.location.href =
        'diteladm.html?id=' + encodeURIComponent(oid);
    });

    return card;
  }

  // ===== INIT: FILTER BUTTON + RENDER =====
  document.addEventListener('DOMContentLoaded', function () {
    const btns = document.querySelectorAll('.admin-pill');
    if (btns.length) {
      btns.forEach(btn => {
        btn.addEventListener('click', () => {
          const filter = btn.dataset.filter || 'all';
          currentFilter = filter; // 'all' | 'gift' | 'history'

          btns.forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');

          renderAdminList();
        });
      });
    }

    renderAdminList();
  });
})();

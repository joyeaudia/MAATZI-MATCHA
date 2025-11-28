// ordadm.js — simple admin view for orders + push notifikasi ke notif page
(function(){
  'use strict';

  // ===== HELPER DASAR =====
  function safeParse(key){
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch(e){
      return [];
    }
  }

  function saveOrders(list){
    try {
      localStorage.setItem('orders', JSON.stringify(list || []));
    } catch(e){
      console.error('Failed to save orders', e);
    }
  }

  function fmt(n){
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n || 0));
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function loadOrders(){
    return safeParse('orders');
  }

  // ===== HELPER NOTIFIKASI (ADMIN ACC / REJECT) =====
  function addNotifForOrder(order, kind){
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
      message = 'Order ' + (order.id || '') +
        ' telah dikonfirmasi dan pembayaran sudah diterima admin.';
    } else if (kind === 'rejected') {
      title = 'Order Rejected';
      emoji = '⛔';
      message = 'Order ' + (order.id || '') +
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

  // ===== LIST DI HALAMAN ADMIN =====
  function renderAdminList(){
    const container = document.getElementById('admin-content');
    if (!container) return;
    container.innerHTML = '';

    let orders = loadOrders() || [];

    // jangan tampilkan yg sudah dibatalkan
    orders = orders.filter(o => String(o.status || '').toLowerCase() !== 'cancelled');

    if (!orders.length){
      container.innerHTML = '<div style="color:#777;font-size:13px;">Belum ada order.</div>';
      return;
    }

    orders.forEach(order => {
      container.appendChild(renderAdminCard(order));
    });
  }

  // ===== SATU KARTU ADMIN =====
  function renderAdminCard(order){
    const card = document.createElement('article');
    card.className = 'admin-order-card';

    const created = new Date(order.createdAt || Date.now()).toLocaleString();
    const status = (order.status || 'active').toLowerCase();
    const paymentStatus = (order.paymentStatus || 'pending').toLowerCase();

    // ===== address / recipient untuk admin =====
    const rawRecipient =
      order.meta && typeof order.meta.recipient === 'string'
        ? order.meta.recipient.trim()
        : '';

    const savedAddrs = safeParse('savedAddresses_v1');
    let chosenAddr = null;
    if (Array.isArray(savedAddrs) && savedAddrs.length){
      chosenAddr = savedAddrs.find(a => a && a.isDefault) || savedAddrs[0];
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
    } else if (chosenAddr){
      const label = escapeHtml(chosenAddr.label || '');
      const name  = escapeHtml(chosenAddr.name || '');
      const phone = escapeHtml(chosenAddr.phone || '');
      const addrHtml = escapeHtml(chosenAddr.address || '').replace(/\n/g, '<br>');
      const combined = `${label ? label : ''}${label && name ? ' - ' : ''}${name ? name : ''}`;

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

    // ===== GIFT INFO (kalau ada) =====
    const isGift = !!order.isGift && !!order.gift;
    let giftInfoHtml = '';

    if (isGift) {
      const revealLabel =
        String(order.gift.revealMode || 'reveal') === 'surprise'
          ? 'Keep it a surprise'
          : 'Reveal it now';

      let scheduleText = '';
      if (order.scheduledAt) {
        try {
          scheduleText = new Date(order.scheduledAt).toLocaleString('id-ID');
        } catch (e) {}
      }

      const recipientText =
        order.meta && order.meta.recipient
          ? escapeHtml(order.meta.recipient)
          : '';

      giftInfoHtml = `
        <div class="admin-gift-block">
          <div class="admin-gift-title">🎁 Gift order</div>
          ${order.gift.message ? `<div class="admin-gift-line"><strong>Message:</strong> ${escapeHtml(order.gift.message)}</div>` : ''}
          ${order.gift.fromName ? `<div class="admin-gift-line"><strong>From:</strong> ${escapeHtml(order.gift.fromName)}</div>` : ''}
          <div class="admin-gift-line"><strong>Reveal:</strong> ${escapeHtml(revealLabel)}</div>
          ${scheduleText ? `<div class="admin-gift-line"><strong>Schedule:</strong> ${escapeHtml(scheduleText)}</div>` : ''}
          ${recipientText ? `<div class="admin-gift-line"><strong>Recipient:</strong> ${recipientText}</div>` : ''}
        </div>
      `;
    }

    // ===== ITEMS DETAIL UNTUK ADMIN =====
    let itemsHtml = '';

    (order.items || []).forEach(it => {
      if (!it) return;

      const title = escapeHtml(it.title || '');

      const addonsHtml =
        it.addons && it.addons.length
          ? '<div class="admin-item-addons">' +
            it.addons.map(a => escapeHtml(a.label || '')).join(', ') +
            '</div>'
          : '';

      const qty = Number(it.qty || 0);
      const unit = Number(it.unitPrice || it.price || 0);
      const lineTotal = Number(it.subtotal || (unit * qty));
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
      paymentStatus === 'paid' ? 'badge-payment paid' :
      paymentStatus === 'rejected' ? 'badge-payment rejected' :
      'badge-payment';

    card.innerHTML = `
      <div class="admin-order-header">
        <div class="admin-order-id">Order ID: ${escapeHtml(order.id || '(no id)')}</div>
        <div class="admin-order-created">${escapeHtml(created)}</div>
      </div>

      <div class="admin-status-row">
        <span class="badge badge-status">Status: ${escapeHtml(status)}</span>
        <span class="badge ${badgePaymentClass}">Payment: ${escapeHtml(paymentStatus)}</span>
        <span class="badge">Total: ${fmt(order.total)}</span>
      </div>

      ${giftInfoHtml}

      <div class="admin-items">
        ${itemsHtml}
      </div>

      ${addrBlock}

      <div class="admin-actions">
        <button class="btn btn-approve" data-id="${escapeHtml(order.id)}">ACC (sudah dibayar)</button>
        <button class="btn btn-reject" data-id="${escapeHtml(order.id)}">Tolak order</button>
      </div>
    `;

    const approveBtn = card.querySelector('.btn-approve');
    const rejectBtn  = card.querySelector('.btn-reject');

    // kalau sudah paid: sembunyikan tombol ACC & Tolak
    if (paymentStatus === 'paid') {
      if (approveBtn) approveBtn.style.display = 'none';
      if (rejectBtn)  rejectBtn.style.display = 'none';
    } else {

      // ===== EVENT BUTTON ACC =====
      if (approveBtn){
        approveBtn.addEventListener('click', function(){
          const id = this.dataset.id;
          const all = loadOrders();
          const idx = all.findIndex(o => String(o.id) === String(id));
          if (idx !== -1){
            all[idx].paymentStatus = 'paid';
            if (!all[idx].status) all[idx].status = 'active';

            addNotifForOrder(all[idx], 'approved');

            saveOrders(all);
            renderAdminList();
            alert('Order di-set sebagai SUDAH DIBAYAR.');
          }
        });
      }

      // ===== EVENT BUTTON REJECT =====
      if (rejectBtn){
        rejectBtn.addEventListener('click', function(){
          const id = this.dataset.id;
          const all = loadOrders();
          const idx = all.findIndex(o => String(o.id) === String(id));
          if (idx !== -1){
            all[idx].paymentStatus = 'rejected';
            all[idx].status = 'cancelled';

            addNotifForOrder(all[idx], 'rejected');

            saveOrders(all);
            renderAdminList();
            alert('Order telah DITOLAK / dibatalkan oleh admin.');
          }
        });
      }
    }

    // ===== KLIK KARTU -> BUKA DETAIL ADMIN =====
    card.addEventListener('click', function (e) {
      // kalau yang diklik tombol di dalam .admin-actions, jangan redirect
      if (e.target.closest('.admin-actions')) return;

      // ide kamu: hanya setelah payment sudah "paid" boleh ke halaman tracking admin
      if (paymentStatus !== 'paid') {
        return;
      }

      const oid = order.id || '';
      if (!oid) return;
      window.location.href = 'diteladm.html?id=' + encodeURIComponent(oid);
    });

    return card;
  }

  document.addEventListener('DOMContentLoaded', renderAdminList);
})();

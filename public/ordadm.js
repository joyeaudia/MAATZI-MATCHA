// admin.js — simple admin view for orders
(function(){
  'use strict';

  function safeParse(key){
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch(e){ return []; }
  }
  function saveOrders(list){
    try { localStorage.setItem('orders', JSON.stringify(list || [])); }
    catch(e){ console.error('Failed to save orders', e); }
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

  function renderAdminList(){
    const container = document.getElementById('admin-content');
    if (!container) return;
    container.innerHTML = '';

    const orders = loadOrders();
    if (!orders.length){
      container.innerHTML = '<div style="color:#777;font-size:13px;">Belum ada order.</div>';
      return;
    }

    // optional: terbaru di atas
    orders.slice().reverse().forEach(order => {
      container.appendChild(renderAdminCard(order));
    });
  }

  function renderAdminCard(order){
    const card = document.createElement('article');
    card.className = 'admin-order-card';

    const created = new Date(order.createdAt || Date.now()).toLocaleString();
    const status = (order.status || 'active').toLowerCase();
    const paymentStatus = (order.paymentStatus || 'pending').toLowerCase();

    // address: pakai default savedAddresses_v1 (sama dengan user view)
    const savedAddrs = safeParse('savedAddresses_v1');
    let chosenAddr = null;
    if (Array.isArray(savedAddrs) && savedAddrs.length){
      chosenAddr = savedAddrs.find(a => a && a.isDefault) || savedAddrs[0];
    }

    let addrBlock = '';
    if (chosenAddr){
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

    // simple item summary (first item + count)
    const first = order.items && order.items[0];
    const moreCount = Math.max(0, (order.items || []).length - 1);
    const firstTitle = first ? escapeHtml(first.title) : 'No title';

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

      <div class="admin-items">
        <div>${firstTitle}${moreCount > 0 ? ' +' + moreCount + ' more' : ''}</div>
      </div>

      ${addrBlock}

      <div class="admin-actions">
        <button class="btn btn-approve" data-id="${escapeHtml(order.id)}">ACC (sudah dibayar)</button>
        <button class="btn btn-reject" data-id="${escapeHtml(order.id)}">Tolak order</button>
      </div>
    `;

    // attach events
    const approveBtn = card.querySelector('.btn-approve');
    const rejectBtn  = card.querySelector('.btn-reject');

    if (approveBtn){
      approveBtn.addEventListener('click', function(){
        const id = this.dataset.id;
        const all = loadOrders();
        const idx = all.findIndex(o => String(o.id) === String(id));
        if (idx !== -1){
          all[idx].paymentStatus = 'paid';
          if (!all[idx].status) all[idx].status = 'active';
          saveOrders(all);
          renderAdminList();
          alert('Order di-set sebagai SUDAH DIBAYAR.');
        }
      });
    }

    if (rejectBtn){
      rejectBtn.addEventListener('click', function(){
        const id = this.dataset.id;
        const all = loadOrders();
        const idx = all.findIndex(o => String(o.id) === String(id));
        if (idx !== -1){
          all[idx].paymentStatus = 'rejected';
          all[idx].status = 'cancelled';
          saveOrders(all);
          renderAdminList();
          alert('Order telah DITOLAK / dibatalkan.');
        }
      });
    }

    return card;
  }

  document.addEventListener('DOMContentLoaded', renderAdminList);
})();

// diteladm.js — Admin Delivery Tracking untuk satu order
(function () {
  'use strict';

  function safeParse(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      return [];
    }
  }

  function loadOrders() {
    return safeParse('orders');
  }

  function saveOrders(list) {
    localStorage.setItem('orders', JSON.stringify(list || []));
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

  function getOrderIdFromURL() {
    const sp = new URLSearchParams(window.location.search);
    return sp.get('id');
  }

  function fillSummary(order) {
    const idEl = document.getElementById('adm-order-id');
    const dateEl = document.getElementById('adm-order-date');
    const statusText = document.getElementById('adm-status-text');
    const paymentBadge = document.getElementById('adm-payment-badge');
    const totalBadge = document.getElementById('adm-total-badge');
    const itemsEl = document.getElementById('adm-items');
    const addrBlock = document.getElementById('adm-address-block');

    if (idEl) idEl.textContent = order.id || '(no id)';

    if (dateEl) {
      const d = order.createdAt ? new Date(order.createdAt) : new Date();
      dateEl.textContent = d.toLocaleString();
    }

    const st = (order.status || 'active').toLowerCase();
    if (statusText) statusText.textContent = st;

    const paySt = (order.paymentStatus || 'pending').toLowerCase();
    if (paymentBadge) {
      paymentBadge.textContent = 'Payment: ' + paySt;
      paymentBadge.classList.remove('paid', 'rejected');
      if (paySt === 'paid') paymentBadge.classList.add('paid');
      if (paySt === 'rejected') paymentBadge.classList.add('rejected');
    }

    if (totalBadge) {
      totalBadge.textContent = 'Total: ' + fmt(order.total || 0);
    }

    if (itemsEl) {
      const first = order.items && order.items[0];
      const moreCount = Math.max(0, (order.items || []).length - 1);
      itemsEl.innerHTML = first
        ? `<div>${escapeHtml(first.title || 'No title')}${moreCount > 0 ? ' +' + moreCount + ' more' : ''}</div>`
        : '<div>No items</div>';
    }

    // address (optional: sama seperti di ordadm.js)
    const savedAddrs = safeParse('savedAddresses_v1');
    let chosenAddr = null;
    if (Array.isArray(savedAddrs) && savedAddrs.length) {
      chosenAddr = savedAddrs.find(a => a && a.isDefault) || savedAddrs[0];
    }
    if (addrBlock && chosenAddr) {
      const label = escapeHtml(chosenAddr.label || '');
      const name  = escapeHtml(chosenAddr.name || '');
      const phone = escapeHtml(chosenAddr.phone || '');
      const addrHtml = escapeHtml(chosenAddr.address || '').replace(/\n/g, '<br>');
      const combined = `${label ? label : ''}${label && name ? ' - ' : ''}${name ? name : ''}`;

      addrBlock.innerHTML = `
        <div class="admin-address-title">Address</div>
        <div class="admin-address-main">
          <div>${combined}</div>
          ${phone ? `<div>${phone}</div>` : ''}
          <div>${addrHtml}</div>
        </div>
      `;
    }
  }

  function initForm(order) {
    const scheduledInput = document.getElementById('adm-scheduled');
    const shipFeeInput = document.getElementById('adm-ship-fee');

    const tPlaced = document.getElementById('t-placed');
    const tPayment = document.getElementById('t-payment');
    const tWait = document.getElementById('t-wait');
    const tPrep = document.getElementById('t-prep');
    const tOutActive = document.getElementById('t-out-active');
    const tOutInfo = document.getElementById('t-out-info');

    const tr = order.tracking || {};
    const paySt = (order.paymentStatus || 'pending').toLowerCase();

    // scheduled delivery
    if (scheduledInput) {
      if (order.scheduledDelivery) {
        // kalau string format YYYY-MM-DD, langsung pakai
        scheduledInput.value = order.scheduledDelivery;
      } else if (order.scheduledAt) {
        try {
          const d = new Date(order.scheduledAt);
          scheduledInput.value = d.toISOString().slice(0, 10);
        } catch (e) {}
      }
    }

    // shipping fee
    if (shipFeeInput) {
      shipFeeInput.value = order.shippingFee != null ? order.shippingFee : '';
    }

    // toggles
    if (tPlaced) tPlaced.checked = tr.placed != null ? !!tr.placed : true;
    if (tPayment) tPayment.checked = tr.paymentConfirmed != null ? !!tr.paymentConfirmed : (paySt === 'paid');
    if (tWait) tWait.checked = !!tr.waitingForSchedule;
    if (tPrep) tPrep.checked = !!tr.preparingOrder;

    const out = tr.outForDelivery || {};
    if (tOutActive) tOutActive.checked = !!out.active;
    if (tOutInfo) tOutInfo.value = out.info || '';
  }

  function bindActions(order, allOrders) {
    const scheduledInput = document.getElementById('adm-scheduled');
    const shipFeeInput = document.getElementById('adm-ship-fee');

    const tPlaced = document.getElementById('t-placed');
    const tPayment = document.getElementById('t-payment');
    const tWait = document.getElementById('t-wait');
    const tPrep = document.getElementById('t-prep');
    const tOutActive = document.getElementById('t-out-active');
    const tOutInfo = document.getElementById('t-out-info');

    const btnSave = document.getElementById('btn-save-tracking');
    const btnDelivered = document.getElementById('btn-mark-delivered');
    const btnBack = document.getElementById('btn-back-list');

    if (btnSave) {
      btnSave.addEventListener('click', function () {
        // update basic fields
        if (scheduledInput && scheduledInput.value) {
          order.scheduledDelivery = scheduledInput.value;
        } else {
          delete order.scheduledDelivery;
        }

        if (shipFeeInput) {
          const fee = Number(shipFeeInput.value || 0);
          if (!isNaN(fee)) {
            order.shippingFee = fee;
            // kalau punya subtotal, update total
            if (typeof order.subtotal === 'number') {
              order.total = order.subtotal + fee;
            }
          }
        }

        // update tracking object
        order.tracking = {
          placed: tPlaced ? !!tPlaced.checked : true,
          paymentConfirmed: tPayment ? !!tPayment.checked : false,
          waitingForSchedule: tWait ? !!tWait.checked : false,
          preparingOrder: tPrep ? !!tPrep.checked : false,
          outForDelivery: {
            active: tOutActive ? !!tOutActive.checked : false,
            info: tOutInfo ? tOutInfo.value.trim() : ''
          },
          // kalau sebelumnya sudah delivered, jangan dihapus di sini
          delivered: order.tracking && order.tracking.delivered ? true : false
        };

        // simpan
        const idx = allOrders.findIndex(o => String(o.id) === String(order.id));
        if (idx !== -1) {
          allOrders[idx] = order;
          saveOrders(allOrders);
        }
        alert('Perubahan tracking & delivery berhasil disimpan.');
      });
    }

    if (btnDelivered) {
      btnDelivered.addEventListener('click', function () {
        const ok = confirm('Tandai order ini sebagai DELIVERED dan pindahkan ke History user?');
        if (!ok) return;

        order.status = 'delivered';
        order.tracking = Object.assign({}, order.tracking || {}, {
          delivered: true,
          deliveredAt: Date.now()
        });

        const idx = allOrders.findIndex(o => String(o.id) === String(order.id));
        if (idx !== -1) {
          allOrders[idx] = order;
          saveOrders(allOrders);
        }

        alert('Order telah ditandai sebagai DELIVERED.');
        window.location.href = 'ordadm.html';
      });
    }

    if (btnBack) {
      btnBack.addEventListener('click', function () {
        window.location.href = 'ordadm.html';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const id = getOrderIdFromURL();
    const all = loadOrders();
    const order = (all || []).find(o => String(o.id) === String(id));

    if (!order) {
      alert('Order tidak ditemukan.');
      window.location.href = 'ordadm.html';
      return;
    }

    fillSummary(order);
    initForm(order);
    bindActions(order, all);
  });

})();

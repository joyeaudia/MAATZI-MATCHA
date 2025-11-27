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

    // load & save orders
  function loadOrders() {
    return safeParse('orders');
  }
  function saveOrders(list) {
    try {
      localStorage.setItem('orders', JSON.stringify(list || []));
    } catch (e) {
      console.error('Failed to save orders', e);
    }
  }

  // ===== BAG (keranjang) =====
// ===== BAG (keranjang) =====
function loadBag() {
  try {
    return JSON.parse(localStorage.getItem('cart') || '[]');  // SAMA seperti loadCart di bagfr.js
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



  // load & save orders
  function loadOrders() {
    return safeParse('orders');
  }
  function saveOrders(list) {
    try {
      localStorage.setItem('orders', JSON.stringify(list || []));
    } catch (e) {
      console.error('Failed to save orders', e);
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

  // ===== card summary renderer (dipakai di semua tab) =====
  // ===== card summary renderer (dipakai di semua tab) =====
  function renderOrderCardSummary(order, opts) {
    const ctx = (opts && opts.context) || '';   // 'active' / 'scheduled' / 'history'
    const isHistory = ctx === 'history';

    const first = order.items && order.items[0];
    const moreCount = Math.max(0, (order.items || []).length - 1);
    const brand = first ? guessBrand(first) : 'Products';
    const imgHtml = (first && first.image)
      ? '<img src="' + escapeHtml(first.image) + '" alt="' + escapeHtml(first.title) + '" style="width:68px;height:68px;object-fit:cover;border-radius:8px">'
      : '<div class="thumb"></div>';
    const status = order.status || 'active';
    const created = new Date(order.createdAt || Date.now()).toLocaleString();

    // label & class tombol kedua
    const secondLabel = isHistory ? 'Reorder' : 'View Details';
    const secondClass = isHistory ? 'reorder-btn' : 'view-details';

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
      '  <div class="order-actions">' +
      '    <button class="btn-outline" data-order-id="' + escapeHtml(order.id) + '">Track Order</button>' +
      '    <button class="btn-light ' + secondClass + '" data-order-id="' + escapeHtml(order.id) + '">' + secondLabel + '</button>' +
      '  </div>' +
      '</div>';

    // tombol View Details (Active/Scheduled)
    if (!isHistory) {
      article.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', function () {
          renderOrderDetails(this.dataset.orderId);
        });
      });
    }

    // tombol REORDER (History)
    if (isHistory) {
      article.querySelectorAll('.reorder-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          const id = this.dataset.orderId;
          if (!id) return;
          reorderFromHistory(id);
        });
      });
    }

    // tombol Track Order -> pindah ke halaman detail (ditel.html?id=...)
    article.querySelectorAll('.btn-outline').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.dataset.orderId;
        if (!id) return;
        window.location.href = 'ditel.html?id=' + encodeURIComponent(id);
      });
    });

    return article;
  }


  // ===== ACTIVE tab =====
  function renderActive() {
    const panel = document.getElementById('tab-active');
    if (!panel) return;
    panel.innerHTML = '';

    const orders = loadOrders() || [];
    if (!orders.length) {
      panel.innerHTML = '<div style="padding:16px;color:#666">Belum ada pesanan.</div>';
      return;
    }

    let activeOrders = orders.filter(o =>
      String(o.status || '').toLowerCase() === 'active'
    );

    // kalau belum ada status sama sekali, anggap active
    if (!activeOrders.length) {
      activeOrders = orders.filter(o => !o.status);
    }

    if (!activeOrders.length) {
      panel.innerHTML = '<div style="padding:16px;color:#666">Tidak ada pesanan aktif saat ini.</div>';
      return;
    }

  activeOrders.forEach(o => {
    panel.appendChild(renderOrderCardSummary(o, { context: 'active' }));
  });
}

  // ===== SCHEDULED tab =====
  function renderSchedule() {
    const panel =
      document.getElementById('tab-schedule') ||
      document.getElementById('tab-scheduled');
    if (!panel) return;
    panel.innerHTML = '';

    const orders = loadOrders();
    const scheduled = (orders || []).filter(
      o =>
        (o.status && String(o.status).toLowerCase() === 'scheduled') ||
        o.scheduledAt
    );

    if (!scheduled.length) {
      panel.innerHTML = '<div style="padding:16px;color:#666">No scheduled orders.</div>';
      return;
    }
  scheduled.forEach(o => {
    panel.appendChild(renderOrderCardSummary(o, { context: 'scheduled' }));
  });
}




  // ===== HISTORY tab =====
// ===== HISTORY tab =====
function renderHistory() {
  const panel = document.getElementById('tab-history');
  if (!panel) return;
  panel.innerHTML = '';

  const orders = loadOrders() || [];

  // hanya order yang sudah selesai / batal
  const historyOrders = orders.filter(o => {
    const st = String(o.status || '').toLowerCase();
    return ['delivered', 'completed', 'cancelled'].includes(st);
  });

  if (!historyOrders.length) {
    panel.innerHTML = '<div style="padding:16px;color:#666">History kosong.</div>';
    return;
  }

  historyOrders.forEach(o => {
    panel.appendChild(renderOrderCardSummary(o, { context: 'history' }));
  });
}

function reorderFromHistory(orderId) {
  const orders = loadOrders() || [];
  const order = orders.find(o => String(o.id) === String(orderId));
  if (!order) {
    alert('Order tidak ditemukan.');
    return;
  }

  let cart = loadBag() || [];

  (order.items || []).forEach((it, idx) => {
    if (!it) return;

    const qty = Number(it.qty || 1);
    const unit = Number(it.unitPrice || it.price || 0);
    const subtotal = Number(it.subtotal || (unit * qty));

    const item = {
      id: it.id || (`reorder-${order.id}-${idx}`),  // kalau ga ada id, bikin dummy
      title: it.title || '',
      unitPrice: unit,
      qty: qty,
      subtotal: subtotal,
      image: it.image || (it.images && it.images[0]) || 'assets/placeholder.png',
      addons: it.addons || [],
      source: 'reorder'  // optional, cuma penanda
    };

    cart.push(item);
  });

  saveBag(cart);

  alert('Barang dari order ini sudah dimasukkan ke Bag ✔');
  window.location.href = 'bagfr.html';
}

  

  // ===== DETAIL VIEW =====
  function renderOrderDetails(orderId) {
    const orders = loadOrders();
    const order = (orders || []).find(o => String(o.id) === String(orderId));
    const panelIds = ['tab-active', 'tab-schedule', 'tab-scheduled', 'tab-history'];

    let panel = null;
    for (const id of panelIds) {
      const el = document.getElementById(id);
      if (el) { panel = el; break; }
    }
    if (!panel) return;

    panel.innerHTML = '';

    if (!order) {
      panel.innerHTML = '<div style="padding:12px;color:#c33">Order tidak ditemukan.</div>';
      return;
    }

    const h = document.createElement('h2');
    h.textContent = 'Order Details';
    panel.appendChild(h);

    const list = document.createElement('div');
    list.style.marginTop = '12px';

    (order.items || []).forEach(it => {
      const itEl = document.createElement('div');
      itEl.style.padding = '10px 0';
      itEl.innerHTML =
        '<div style="display:flex;gap:12px;align-items:center">' +
        '  <div style="width:56px;height:56px;border-radius:8px;overflow:hidden;background:#f5f5f7;flex:0 0 56px">' +
        (it.image
          ? '<img src="' + escapeHtml(it.image) + '" style="width:100%;height:100%;object-fit:cover">'
          : '') +
        '  </div>' +
        '  <div style="flex:1">' +
        '    <div style="font-weight:700">' + escapeHtml(it.title) + '</div>' +
        (it.addons && it.addons.length
          ? '<div style="color:#666;margin-top:6px">' +
          it.addons.map(a => escapeHtml(a.label)).join(', ') +
          '</div>'
          : '') +
        '    <div style="color:#666;margin-top:6px">' +
        (it.qty || 0) + ' × ' + fmt(it.unitPrice) +
        ' = ' + fmt(it.subtotal) +
        '</div>' +
        '  </div>' +
        '</div>';

      list.appendChild(itEl);
    });

    panel.appendChild(list);

    // ===== address block =====
    const savedAddrs = safeParse('savedAddresses_v1');
    let chosenAddr = null;
    if (Array.isArray(savedAddrs) && savedAddrs.length) {
      chosenAddr = savedAddrs.find(a => a && a.isDefault) || savedAddrs[0];
    }

    if (chosenAddr) {
      const addrBlock = document.createElement('div');
      addrBlock.className = 'order-address-block';

      const label = escapeHtml(chosenAddr.label || '');
      const name = escapeHtml(chosenAddr.name || '');
      const phone = escapeHtml(chosenAddr.phone || '');
      const addrHtml = escapeHtml(chosenAddr.address || '').replace(/\n/g, '<br>');

      const combined = `${label ? label : ''}${label && name ? ' - ' : ''}${name ? name : ''}`;

      addrBlock.innerHTML = `
        <div class="order-address-head">
          <span class="title">Address</span>
          <a href="drafamt.html" class="edit-link small">Edit</a>
        </div>
        <div class="order-address-body">
          <div class="line-combined">${combined}</div>
          ${phone ? `<div class="line-phone">${phone}</div>` : ''}
          <div class="line-address">${addrHtml}</div>
        </div>
      `;
      panel.appendChild(addrBlock);
    }

    // ===== NOTE PEMBAYARAN (DINAMIS) =====
    const rawPaymentStatus = (order.paymentStatus || 'pending').toLowerCase();
    const rawStatus = (order.status || '').toLowerCase();
    const isPaid = rawPaymentStatus === 'paid';
    const isRejected = rawPaymentStatus === 'rejected' || rawStatus === 'cancelled';

    const note = document.createElement('div');
    let noteClass = 'pending';
    let noteHtml = '';

    if (isPaid) {
      noteClass = 'paid';
      noteHtml =
        '<div>Status pesanan: <strong>Pesanan ' + escapeHtml(order.id || '') + ' sudah dibayar.</strong></div>' +
        '<div class="status">Pembayaran sudah diterima admin ✅</div>' +
        '<div class="track-hint">Anda dapat men-track order Anda dari halaman Orders / Active.</div>';
    } else if (isRejected) {
      note.innerHTML =
        '<div style="font-weight:600">⛔ Orderan ini dicancel oleh admin</div>' +
        '<div class="status">Status pembayaran: <strong style="color:#c00">Ditolak admin</strong></div>' +
        '<div class="track-hint" style="color:#c00">Silakan hubungi admin jika ada kesalahan.</div>';
    } else {
      noteClass = 'pending';
      noteHtml =
        '<div>Segera melakukan pembayaran melalui WhatsApp kepada toko agar orderan Anda dapat di-ACC.</div>' +
        '<div class="status">Status pembayaran: <strong>Pembayaran belum diterima admin</strong></div>';
    }

    if (!isRejected) {
      note.className = 'order-payment-note ' + noteClass;
      note.innerHTML = noteHtml;
    }
    panel.appendChild(note);

    // total
    const tot = document.createElement('div');
    tot.style.marginTop = '12px';
    tot.style.fontWeight = '700';
    tot.textContent = 'Total: ' + fmt(order.total);
    panel.appendChild(tot);

    // tombol back + cancel
    const back = document.createElement('div');
    back.style.marginTop = '12px';
    back.innerHTML =
      '<button class="btn-light" id="back-to-summary">Back to summary</button>' +
      ' ' +
      '<button class="btn-outline btn-cancel-order" data-order-id="' +
      escapeHtml(order.id) + '">Cancel Order</button>';
    panel.appendChild(back);

    const backBtn = back.querySelector('#back-to-summary');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        renderAllLists();
      });
    }

    const cancelBtn = back.querySelector('.btn-cancel-order');
    if (cancelBtn) {
      // kalau sudah cancelled ATAU sudah dibayar, jangan tampilkan tombol cancel lagi
      if (isRejected || isPaid) {
        cancelBtn.remove();
      } else {
        cancelBtn.addEventListener('click', function () {
          const ok = confirm('Yakin ingin membatalkan order ini?');
          if (!ok) return;

          const all = loadOrders() || [];
          const idx = all.findIndex(o => String(o.id) === String(orderId));
          if (idx !== -1) {
            all[idx].status = 'cancelled';
            all[idx].paymentStatus = 'rejected';
            saveOrders(all);
          }
          renderAllLists();
          alert('Order telah dibatalkan. Status: cancelled');
        });
      }
    }

  }

  // ===== BADGE NOTIF DI LONCENG =====
  // ===== BADGE NOTIF DI LONCENG =====
  function updateNotifBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;

    const notifs = safeParse('notifications_v1'); // sama key dengan notif.js

    // cuma hitung notif yang belum dibaca
    const hasUnread = Array.isArray(notifs) && notifs.some(n => !n.isRead);

    if (hasUnread) {
      badge.classList.add('show');    // 🔴 munculin titik merah
    } else {
      badge.classList.remove('show'); // sembunyiin kalau semua sudah dibaca / kosong
    }
  }


  // ===== RENDER SEMUA TAB =====
  function renderAllLists() {
    renderActive();
    renderSchedule();
    renderHistory();
  }

  // ===== TAB SWITCHING =====
function attachTabHandlers() {
  document.querySelectorAll('[data-order-tab],[data-tab]').forEach(btn => {
    btn.addEventListener('click', function () {
      const targetName = this.dataset.orderTab || this.dataset.tab;
      if (!targetName) return;

      const nameToId = {
        active: 'tab-active',
        scheduled: 'tab-scheduled',
        schedule: 'tab-schedule',
        history: 'tab-history'
      };
      const targetId = nameToId[targetName] || targetName;

      const panels = ['tab-active', 'tab-scheduled', 'tab-schedule', 'tab-history'];
      panels.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        const isActive = id === targetId;

        // atur display
        el.style.display = isActive ? '' : 'none';

        // ⬅️ FIX PENTING: kontrol class .hidden juga
        el.classList.toggle('hidden', !isActive);
      });

      // toggle state tombol tab
      document.querySelectorAll('[data-order-tab],[data-tab]').forEach(tb => {
        const name = tb.dataset.orderTab || tb.dataset.tab;
        const isActive = name === targetName;
        tb.classList.toggle('tab-active', isActive);
        tb.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    });
  });
}


  // ===== init =====
  document.addEventListener('DOMContentLoaded', function () {
    try {
      renderAllLists();
      attachTabHandlers();

      // cek notif sekali waktu page load
      updateNotifBadge();

      // kalau localStorage notif berubah dari tab lain, update juga
      window.addEventListener('storage', function (e) {
        if (e.key === 'notifications_v1') {
          updateNotifBadge();
        }
      });
    } catch (e) {
      console.error('order render error', e);
    }
  });

  // expose for debugging
  window.renderAllOrders = renderAllLists;
  window.renderOrderDetails = renderOrderDetails;
  window.updateNotifBadge = updateNotifBadge;
})();

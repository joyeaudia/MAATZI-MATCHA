// order.js — cleaned and robust order renderer
(function(){
  'use strict';

  // helpers
  function fmt(n){ return 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n||0)); }
  function safeParse(key){ try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch(e){ return []; } }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }

  // load orders array
  function loadOrders(){ return safeParse('orders'); }

  // Render single "active" card (first item + +N More)
  function renderOrdersList() {
    const orders = loadOrders();
    const activePanel = document.getElementById('tab-active');
    if (!activePanel) return;
    activePanel.innerHTML = '';

    if (!orders || !orders.length) {
      activePanel.innerHTML = '<div style="padding:16px;color:#666">Belum ada pesanan.</div>';
      return;
    }

    const order = orders[0]; // newest first
    if (!order || !Array.isArray(order.items) || !order.items.length) {
      activePanel.innerHTML = '<div style="padding:16px;color:#666">Order data tidak lengkap.</div>';
      return;
    }

    const first = order.items[0];
    const moreCount = Math.max(0, order.items.length - 1);

    // heuristic: decide brand/category from item id
    let brand = 'Products';
    const idLower = String(first.id || '').toLowerCase();
    if (idLower.startsWith('dsri') || idLower.startsWith('dessert') || idLower.includes('dessert')) brand = 'Desserts';
    else if (idLower.startsWith('drsi') || idLower.startsWith('drink') || idLower.includes('drink')) brand = 'Drinks';

    const imgHtml = first.image ? `<img src="${escapeHtml(first.image)}" alt="${escapeHtml(first.title)}" style="width:68px;height:68px;object-fit:cover;border-radius:8px">` : `<div class="thumb"></div>`;

    const article = document.createElement('article');
    article.className = 'order-card';
    article.innerHTML = `
      <div class="thumb">${imgHtml}</div>
      <div class="order-info">
        <div class="order-top">
          <h3 class="product-title">${escapeHtml(first.title)}</h3>
          <span class="more">${moreCount > 0 ? '+' + moreCount + ' More' : ''}</span>
        </div>
        <p class="brand">${escapeHtml(brand)}</p>
        <div class="status-row">
          <span class="status">Status : <strong>${escapeHtml(order.status || 'active')}</strong></span>
          <span class="eta">Created : <em>${new Date(order.createdAt || Date.now()).toLocaleString()}</em></span>
        </div>
        <div class="order-actions">
          <button class="btn-outline" data-order-id="${escapeHtml(order.id)}">Track Order</button>
          <button class="btn-light view-details" data-order-id="${escapeHtml(order.id)}">View Details</button>
        </div>
      </div>
    `;
    activePanel.appendChild(article);

    // attach detail handler
    activePanel.querySelectorAll('.view-details').forEach(b => {
      b.addEventListener('click', function(){
        const id = this.dataset.orderId;
        if (!id) return;
        renderOrderDetails(id);
      });
    });
  }

  // Show full order details inside #tab-active (simple view)
  function renderOrderDetails(orderId) {
    const orders = loadOrders();
    const order = orders.find(o => String(o.id) === String(orderId));
    const panel = document.getElementById('tab-active');
    if (!panel) return;
    if (!order) {
      panel.innerHTML = '<div style="padding:12px;color:#c33">Order tidak ditemukan.</div>';
      return;
    }

    panel.innerHTML = ''; // clear
    const title = document.createElement('h2');
    title.textContent = 'Order Details';
    panel.appendChild(title);

    const list = document.createElement('div');
    list.style.marginTop = '12px';

    order.items.forEach(it => {
      const itEl = document.createElement('div');
      itEl.className = 'order-item';
      itEl.style.padding = '10px 0';
      itEl.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:56px;height:56px;border-radius:8px;overflow:hidden;background:#f5f5f7;flex:0 0 56px">
            ${it.image ? `<img src="${escapeHtml(it.image)}" style="width:100%;height:100%;object-fit:cover">` : ''}
          </div>
          <div style="flex:1">
            <div style="font-weight:700">${escapeHtml(it.title)}</div>
            ${it.addons && it.addons.length ? `<div style="color:#666;margin-top:6px">${it.addons.map(a => escapeHtml(a.label)).join(', ')}</div>` : ''}
            <div style="color:#666;margin-top:6px">${it.qty} × ${fmt(it.unitPrice)} = ${fmt(it.subtotal)}</div>
          </div>
        </div>
      `;
      list.appendChild(itEl);
    });

    const tot = document.createElement('div');
    tot.style.marginTop = '14px';
    tot.style.fontWeight = '700';
    tot.textContent = 'Total: ' + fmt(order.total);

    panel.appendChild(list);
    panel.appendChild(tot);

    // Back button to show summary again
    const back = document.createElement('div');
    back.style.marginTop = '12px';
    back.innerHTML = `<button class="btn-light" id="back-to-summary">Back</button>`;
    panel.appendChild(back);
    back.querySelector('#back-to-summary').addEventListener('click', function(){ renderOrdersList(); });
  }

  // initial render on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function(){ 
    try { renderOrdersList(); } catch(e) { console.error('renderOrdersList error', e); }
  });

  // expose for debugging
  window.renderOrdersList = renderOrdersList;
  window.renderOrderDetails = renderOrderDetails;
})();

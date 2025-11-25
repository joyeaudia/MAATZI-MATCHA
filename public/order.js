(function(){
  'use strict';

  // helpers
  function fmt(n){ return 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n||0)); }
  function safeParse(key){ try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch(e){ return []; } }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }

  // load orders array
  function loadOrders(){ return safeParse('orders'); }

  // decide brand/category from item id/title heuristic
  function guessBrand(item) {
    const idLower = String(item?.id || '').toLowerCase();
    const titleLower = String(item?.title || '').toLowerCase();
    if (idLower.startsWith('dsri') || idLower.startsWith('dessert') || titleLower.includes('dessert')) return 'Desserts';
    if (idLower.startsWith('drsi') || idLower.startsWith('drink') || titleLower.includes('latte') || titleLower.includes('drink')) return 'Drinks';
    return 'Products';
  }

  // small renderer for a single order summary card (used by Active/Schedule/History)
  function renderOrderCardSummary(order) {
    const first = order.items && order.items[0];
    const moreCount = Math.max(0, (order.items || []).length - 1);
    const brand = first ? guessBrand(first) : 'Products';
    const imgHtml = first && first.image ? '<img src="' + escapeHtml(first.image) + '" alt="' + escapeHtml(first.title) + '" style="width:68px;height:68px;object-fit:cover;border-radius:8px">' : '<div class="thumb"></div>';
    const status = order.status || 'active';
    const created = new Date(order.createdAt || Date.now()).toLocaleString();

    const article = document.createElement('article');
    article.className = 'order-card';
    article.innerHTML = '\
      <div class="thumb">' + imgHtml + '</div>\
      <div class="order-info">\
        <div class="order-top">\
          <h3 class="product-title">' + escapeHtml(first ? first.title : 'No title') + '</h3>\
          <span class="more">' + (moreCount > 0 ? '+' + moreCount + ' More' : '') + '</span>\
        </div>\
        <p class="brand">' + escapeHtml(brand) + '</p>\
        <div class="status-row">\
          <span class="status">Status : <strong>' + escapeHtml(status) + '</strong></span>\
          <span class="eta">Created : <em>' + escapeHtml(created) + '</em></span>\
        </div>\
        <div class="order-actions">\
          <button class="btn-outline" data-order-id="' + escapeHtml(order.id) + '">Track Order</button>\
          <button class="btn-light view-details" data-order-id="' + escapeHtml(order.id) + '">View Details</button>\
        </div>\
      </div>';

    // attach view-details here for convenience
    article.querySelectorAll('.view-details').forEach(b=>{
      b.addEventListener('click', function(){
        renderOrderDetails(this.dataset.orderId);
      });
    });
    return article;
  }

  // Active: prefer orders with status 'active' (do not blindly show orders[0])
  function renderActive() {
    const panel = document.getElementById('tab-active');
    if (!panel) return;
    panel.innerHTML = '';
    const orders = loadOrders();
    if (!orders || !orders.length) {
      panel.innerHTML = '<div style="padding:16px;color:#666">Belum ada pesanan.</div>';
      return;
    }
    // prefer orders explicitly marked 'active'
    const activeOrder = (orders || []).find(o => String(o.status || '').toLowerCase() === 'active');
    if (activeOrder) {
      panel.appendChild(renderOrderCardSummary(activeOrder));
      return;
    }
    // fallback: don't show scheduled as active — show friendly message
    panel.innerHTML = '<div style="padding:16px;color:#666">Tidak ada pesanan aktif saat ini.</div>';
  }

  // Schedule: orders with status 'scheduled' OR that have scheduledAt field
  // support both possible panel ids 'tab-schedule' and 'tab-scheduled'
  function renderSchedule() {
    const panel = document.getElementById('tab-schedule') || document.getElementById('tab-scheduled');
    if (!panel) return;
    panel.innerHTML = '';
    const orders = loadOrders();
    const scheduled = (orders || []).filter(o => (o.status && String(o.status).toLowerCase() === 'scheduled') || o.scheduledAt);
    if (!scheduled.length) {
      panel.innerHTML = '<div style="padding:16px;color:#666">No scheduled orders.</div>';
      return;
    }
    scheduled.forEach(o => panel.appendChild(renderOrderCardSummary(o)));
  }

  // History: orders that are not active or scheduled (delivered, shipped, completed, cancelled)
  function renderHistory() {
    const panel = document.getElementById('tab-history');
    if (!panel) return;
    panel.innerHTML = '';
    const orders = loadOrders();
    const hist = (orders || []).filter(o => {
      const st = String(o.status || '').toLowerCase();
      if (st === 'active' || st === 'scheduled' || st === '') return false;
      return true;
    });
    // fallback: if nothing matched by status, treat older orders (createdAt older than now - 1 day) as history
    if (!hist.length) {
      const fallback = (orders || []).filter(o => {
        try {
          return (Date.now() - Number(o.createdAt || 0)) > (24 * 60 * 60 * 1000); // older than 24h
        } catch(e){ return false; }
      });
      if (fallback.length) {
        fallback.forEach(o => panel.appendChild(renderOrderCardSummary(o)));
        return;
      }
      panel.innerHTML = '<div style="padding:16px;color:#666">History kosong.</div>';
      return;
    }
    hist.forEach(o => panel.appendChild(renderOrderCardSummary(o)));
  }

  // Details page: replace panel content with full item list for that order id
  function renderOrderDetails(orderId) {
    const orders = loadOrders();
    const order = (orders || []).find(o => String(o.id) === String(orderId));
    const panelIds = ['tab-active','tab-schedule','tab-scheduled','tab-history'];
    // find first available panel to render details into
    let panel = null;
    for (const id of panelIds) { const el = document.getElementById(id); if (el) { panel = el; break; } }
    if (!panel) return;
    panel.innerHTML = '';
    if (!order) {
      panel.innerHTML = '<div style="padding:12px;color:#c33">Order tidak ditemukan.</div>';
      return;
    }
    const h = document.createElement('h2'); h.textContent = 'Order Details'; panel.appendChild(h);

    const list = document.createElement('div'); list.style.marginTop = '12px';
    (order.items || []).forEach(it => {
      const itEl = document.createElement('div');
      itEl.style.padding = '10px 0';
      itEl.innerHTML = '\
        <div style="display:flex;gap:12px;align-items:center">\
          <div style="width:56px;height:56px;border-radius:8px;overflow:hidden;background:#f5f5f7;flex:0 0 56px">\
            ' + (it.image ? '<img src="' + escapeHtml(it.image) + '" style="width:100%;height:100%;object-fit:cover">' : '') + '\
          </div>\
          <div style="flex:1">\
            <div style="font-weight:700">' + escapeHtml(it.title) + '</div>\
            ' + ((it.addons && it.addons.length) ? '<div style="color:#666;margin-top:6px">' + it.addons.map(a => escapeHtml(a.label)).join(', ') + '</div>' : '') + '\
            <div style="color:#666;margin-top:6px">' + (it.qty || 0) + ' × ' + fmt(it.unitPrice) + ' = ' + fmt(it.subtotal) + '</div>\
          </div>\
        </div>';

      list.appendChild(itEl);
    });
    panel.appendChild(list);
    const tot = document.createElement('div'); tot.style.marginTop='12px'; tot.style.fontWeight='700'; tot.textContent = 'Total: ' + fmt(order.total);
    panel.appendChild(tot);

    const back = document.createElement('div'); back.style.marginTop = '12px';
    back.innerHTML = '<button class="btn-light" id="back-to-summary">Back to summary</button>';
    panel.appendChild(back);
    back.querySelector('#back-to-summary').addEventListener('click', function(){
      renderAllLists();
    });
  }

  // Render all panels
  function renderAllLists(){
    renderActive();
    renderSchedule();
    renderHistory();
  }

  // Tab switching: support both data-order-tab and data-tab attributes and map logical names
  function attachTabHandlers(){
    document.querySelectorAll('[data-order-tab],[data-tab]').forEach(btn => {
      btn.addEventListener('click', function(e){
        // prefer dataset.orderTab, fall back to dataset.tab
        const targetName = this.dataset.orderTab || this.dataset.tab;
        if (!targetName) return;
        // map logical name -> panel id used in DOM
        const nameToId = {
          active: 'tab-active',
          scheduled: 'tab-scheduled',
          schedule: 'tab-schedule',
          history: 'tab-history'
        };
        const targetId = nameToId[targetName] || targetName;
        // hide/show panels (support both possible schedule ids)
        const panels = ['tab-active','tab-scheduled','tab-schedule','tab-history'];
        panels.forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          el.style.display = (id === targetId) ? '' : 'none';
        });
        // update tab aria/visual state
        document.querySelectorAll('[data-order-tab],[data-tab]').forEach(tb => {
          const name = tb.dataset.orderTab || tb.dataset.tab;
          const isActive = name === targetName;
          tb.classList.toggle('tab-active', isActive);
          tb.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
      });
    });
  }

  // initial render
  document.addEventListener('DOMContentLoaded', function(){
    try {
      renderAllLists();
      attachTabHandlers();
    } catch(e){
      console.error('order render error', e);
    }
  });

  // expose for debugging
  window.renderAllOrders = renderAllLists;
  window.renderOrderDetails = renderOrderDetails;

})();
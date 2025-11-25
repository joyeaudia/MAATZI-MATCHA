// js/app.js
document.addEventListener('DOMContentLoaded', function () {
  const tabButtons = Array.from(document.querySelectorAll('.tabs .tab'));
  const panels = {
    active: document.getElementById('tab-active'),
    scheduled: document.getElementById('tab-scheduled'),
    history: document.getElementById('tab-history')
  };

  // Ensure every tab button has a data-tab attribute (fallback to text)
  tabButtons.forEach(btn => {
    if (!btn.dataset.tab) {
      btn.dataset.tab = btn.textContent.trim().toLowerCase();
    }
  });

  // --- Sliding pill setup (creates .tab-pill and syncing) ---
  (function enableSlidingTabPill() {
    const tabsEl = document.querySelector('.tabs');
    if (!tabsEl) return;

    // create pill element if not present
    let pill = tabsEl.querySelector('.tab-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'tab-pill';
      tabsEl.insertBefore(pill, tabsEl.firstChild);
    }

    // function to position pill relative to a button
    function positionPillFor(button) {
      if (!button) return hidePill();
      const tabsRect = tabsEl.getBoundingClientRect();
      const btnRect = button.getBoundingClientRect();

      // calculate left relative to tabs container with a tiny padding
      const left = Math.round(btnRect.left - tabsRect.left + 4);
      const width = Math.round(Math.max(48, btnRect.width - 8));

      // apply styles (use transform for smoother animation if desired)
      pill.style.left = `${left}px`;
      pill.style.width = `${width}px`;
      pill.style.opacity = '1';
    }

    function hidePill() {
      pill.style.opacity = '0';
    }

    function syncPillToActive() {
      // find active button (aria-selected="true") or .tab-active
      const activeBtn = tabsEl.querySelector('.tab[aria-selected="true"]') || tabsEl.querySelector('.tab.tab-active');
      if (activeBtn) positionPillFor(activeBtn);
      else hidePill();
    }

    // debounce resize handling
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncPillToActive, 110);
    });

    window.addEventListener('orientationchange', () => {
      // small delay to allow layout to stabilize on orientation change
      setTimeout(syncPillToActive, 80);
    });

    // expose refresh function globally so other code can call it
    window.__refreshTabPill = syncPillToActive;

    // initial sync after a short delay to let DOM/CSS settle
    setTimeout(syncPillToActive, 40);
  })();
  // --- end sliding pill setup ---

  // activateTab updates button states and panels, and refreshes the pill
  function activateTab(tabName) {
    // update buttons
    tabButtons.forEach(btn => {
      const isTarget = btn.dataset.tab === tabName;
      btn.classList.toggle('tab-active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    // show/hide panels with simple class toggle
    Object.keys(panels).forEach(key => {
      const panel = panels[key];
      if (!panel) return;
      if (key === tabName) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    });

    // refresh pill position if available
    if (typeof window.__refreshTabPill === 'function') {
      // use rAF to ensure DOM updates applied before measuring
      window.requestAnimationFrame(() => {
        window.__refreshTabPill();
      });
    }

    // OPTIONAL: update URL query param so tab can be shared/bookmarked
    // history.replaceState(null, '', '?tab=' + tabName);
  }

  // attach click listeners to tabs
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      if (tabName) activateTab(tabName);
    });

    // keyboard support: Enter/Space to activate
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        const tabName = btn.dataset.tab;
        if (tabName) activateTab(tabName);
      }
    });
  });

  // initial: read ?tab= from URL if present, otherwise default to 'active'
  (function initFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t && panels[t]) activateTab(t);
    else {
      // if any tab already marked aria-selected=true use it, otherwise default 'active'
      const preselected = tabButtons.find(b => b.getAttribute('aria-selected') === 'true');
      if (preselected && panels[preselected.dataset.tab]) {
        activateTab(preselected.dataset.tab);
      } else {
        activateTab('active');
      }
    }
  })();
  // order-list rendering for order.html
(function(){
  function fmt(n){ return 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n||0)); }
  function loadOrders(){ try { return JSON.parse(localStorage.getItem('orders')||'[]'); } catch(e){ return []; } }

  function renderOrdersList() {
    const orders = loadOrders();
    const activePanel = document.getElementById('tab-active');
    if (!activePanel) return;

    activePanel.innerHTML = ''; // clear sample static markup

    if (!orders.length) {
      activePanel.innerHTML = '<div style="padding:16px;color:#666">Belum ada pesanan.</div>';
      return;
    }

    // we render newest order at top (orders[0])
    const order = orders[0];
    // prepare first item display + "+N more"
    const first = order.items[0];
    const moreCount = Math.max(0, order.items.length - 1);

    const article = document.createElement('article');
    article.className = 'order-card';

    const imgHtml = first.image ? `<img src="${first.image}" alt="${escapeHtml(first.title)}" style="width:68px;height:68px;object-fit:cover;border-radius:8px">` :
                   `<div class="thumb"></div>`;

    article.innerHTML = `
      <div class="thumb">${imgHtml}</div>
      <div class="order-info">
        <div class="order-top">
          <h3 class="product-title">${escapeHtml(first.title)}</h3>
          <span class="more">${moreCount > 0 ? '+'+moreCount + ' More' : ''}</span>
        </div>
        <p class="brand">Order ID: ${escapeHtml(order.id)}</p>
        <div class="status-row">
          <span class="status">Status : <strong>${escapeHtml(order.status)}</strong></span>
          <span class="eta">Created : <em>${new Date(order.createdAt).toLocaleString()}</em></span>
        </div>
        <div class="order-actions">
          <button class="btn-outline" data-order-id="${escapeHtml(order.id)}">Track Order</button>
          <button class="btn-light" data-order-id="${escapeHtml(order.id)}">View Details</button>
        </div>
      </div>
    `;
    activePanel.appendChild(article);

    // OPTION: if user clicks "View Details" we can open a details panel showing all items.
    activePanel.addEventListener('click', function(e){
      const btn = e.target.closest('[data-order-id]');
      if (!btn) return;
      const id = btn.dataset.orderId;
      if (!id) return;
      // open details: for simplicity, go to same page with ?order=id and show details
      // you can implement modal or navigate to order-detail.html
      renderOrderDetails(id);
    });
  }

  function renderOrderDetails(orderId) {
    const orders = loadOrders();
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order) { alert('Order tidak ditemukan'); return; }

    // Simple details view: replace content with full list (you can make prettier)
    const panel = document.getElementById('tab-active');
    panel.innerHTML = '<h2>Order Details</h2>';
    const list = document.createElement('div');
    order.items.forEach(it => {
      const itEl = document.createElement('div');
      itEl.className = 'order-item';
      itEl.style.padding = '8px 0';
      itEl.innerHTML = `
        <div style="display:flex;gap:10px;align-items:center">
          <div style="width:56px;height:56px;background:#f2f2f4;border-radius:8px;overflow:hidden">
            ${it.image ? `<img src="${it.image}" style="width:100%;height:100%;object-fit:cover">` : ''}
          </div>
          <div>
            <div style="font-weight:700">${escapeHtml(it.title)} ${it.addons && it.addons.length ? '<small style="display:block;color:#666;font-weight:500;margin-top:6px">'+it.addons.map(a=>escapeHtml(a.label)).join(', ')+'</small>' : ''}</div>
            <div style="color:#666;margin-top:6px">${it.qty} × ${fmt(it.unitPrice)} = ${fmt(it.subtotal)}</div>
          </div>
        </div>
      `;
      list.appendChild(itEl);
    });
    const tot = document.createElement('div');
    tot.style.marginTop = '12px';
    tot.innerHTML = `<strong>Total: ${fmt(order.total)}</strong>`;
    panel.appendChild(list);
    panel.appendChild(tot);
  }

  // helper escapeHtml (same as bagfr.js)
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }

  // initial render
  document.addEventListener('DOMContentLoaded', function(){ renderOrdersList(); });

  // expose for debugging
  window.renderOrdersList = renderOrdersList;
})();
// order-list rendering for order.html
(function(){
  function fmt(n){ return 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n||0)); }
  function loadOrders(){ try { return JSON.parse(localStorage.getItem('orders')||'[]'); } catch(e){ return []; } }

  function renderOrdersList() {
    const orders = loadOrders();
    const activePanel = document.getElementById('tab-active');
    if (!activePanel) return;

    activePanel.innerHTML = ''; // clear sample static markup

    if (!orders.length) {
      activePanel.innerHTML = '<div style="padding:16px;color:#666">Belum ada pesanan.</div>';
      return;
    }

    // we render newest order at top (orders[0])
    const order = orders[0];
    // prepare first item display + "+N more"
    const first = order.items[0];
    const moreCount = Math.max(0, order.items.length - 1);

    const article = document.createElement('article');
    article.className = 'order-card';

    const imgHtml = first.image ? `<img src="${first.image}" alt="${escapeHtml(first.title)}" style="width:68px;height:68px;object-fit:cover;border-radius:8px">` :
                   `<div class="thumb"></div>`;

    article.innerHTML = `
      <div class="thumb">${imgHtml}</div>
      <div class="order-info">
        <div class="order-top">
          <h3 class="product-title">${escapeHtml(first.title)}</h3>
          <span class="more">${moreCount > 0 ? '+'+moreCount + ' More' : ''}</span>
        </div>
        <p class="brand">Order ID: ${escapeHtml(order.id)}</p>
        <div class="status-row">
          <span class="status">Status : <strong>${escapeHtml(order.status)}</strong></span>
          <span class="eta">Created : <em>${new Date(order.createdAt).toLocaleString()}</em></span>
        </div>
        <div class="order-actions">
          <button class="btn-outline" data-order-id="${escapeHtml(order.id)}">Track Order</button>
          <button class="btn-light" data-order-id="${escapeHtml(order.id)}">View Details</button>
        </div>
      </div>
    `;
    activePanel.appendChild(article);

    // OPTION: if user clicks "View Details" we can open a details panel showing all items.
    activePanel.addEventListener('click', function(e){
      const btn = e.target.closest('[data-order-id]');
      if (!btn) return;
      const id = btn.dataset.orderId;
      if (!id) return;
      // open details: for simplicity, go to same page with ?order=id and show details
      // you can implement modal or navigate to order-detail.html
      renderOrderDetails(id);
    });
  }

  function renderOrderDetails(orderId) {
    const orders = loadOrders();
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order) { alert('Order tidak ditemukan'); return; }

    // Simple details view: replace content with full list (you can make prettier)
    const panel = document.getElementById('tab-active');
    panel.innerHTML = '<h2>Order Details</h2>';
    const list = document.createElement('div');
    order.items.forEach(it => {
      const itEl = document.createElement('div');
      itEl.className = 'order-item';
      itEl.style.padding = '8px 0';
      itEl.innerHTML = `
        <div style="display:flex;gap:10px;align-items:center">
          <div style="width:56px;height:56px;background:#f2f2f4;border-radius:8px;overflow:hidden">
            ${it.image ? `<img src="${it.image}" style="width:100%;height:100%;object-fit:cover">` : ''}
          </div>
          <div>
            <div style="font-weight:700">${escapeHtml(it.title)} ${it.addons && it.addons.length ? '<small style="display:block;color:#666;font-weight:500;margin-top:6px">'+it.addons.map(a=>escapeHtml(a.label)).join(', ')+'</small>' : ''}</div>
            <div style="color:#666;margin-top:6px">${it.qty} × ${fmt(it.unitPrice)} = ${fmt(it.subtotal)}</div>
          </div>
        </div>
      `;
      list.appendChild(itEl);
    });
    const tot = document.createElement('div');
    tot.style.marginTop = '12px';
    tot.innerHTML = `<strong>Total: ${fmt(order.total)}</strong>`;
    panel.appendChild(list);
    panel.appendChild(tot);
  }

  // helper escapeHtml (same as bagfr.js)
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }

  // initial render
  document.addEventListener('DOMContentLoaded', function(){ renderOrdersList(); });

  // expose for debugging
  window.renderOrdersList = renderOrdersList;
})();


});

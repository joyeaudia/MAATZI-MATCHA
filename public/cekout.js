// cekout.js — dynamic checkout: load cart -> product summary, qty sync, place scheduled order
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // ---- helpers ----
  const formatRp = (n) => {
    const num = Math.round(Number(n) || 0);
    const s = Math.abs(num).toString();
    const parts = [];
    for (let i = s.length - 1, cnt = 0; i >= 0; i--, cnt++) {
      parts.push(s[i]);
      if (cnt % 3 === 2 && i !== 0) parts.push('.');
    }
    const sign = num < 0 ? '-' : '';
    return sign + 'Rp ' + parts.reverse().join('') + ',00';
  };

  // Safe localStorage JSON helpers
  function safeParse(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch (e) { return []; }
  }
  function saveJSON(key, v) { localStorage.setItem(key, JSON.stringify(v || [])); }
  function loadCart() { return safeParse('cart'); }
  function saveCart(cart) { saveJSON('cart', cart); }
  function loadOrders() { return safeParse('orders'); }
  function saveOrders(arr) { saveJSON('orders', arr); }
  function genOrderId() {
    return 'ORD-' + new Date().toISOString().slice(0, 10) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  // ---- safe html escape ----
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // --- populate Schedule selects (Date / Month / Year) ---
  function populateScheduleSelectors({ yearsAhead = 5 } = {}) {
    const dateSel = document.querySelector('select[aria-label="Date"]');
    const monthSel = document.querySelector('select[aria-label="Month"]');
    const yearSel = document.querySelector('select[aria-label="Year"]');
    if (!dateSel || !monthSel || !yearSel) return;

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // clear
    dateSel.innerHTML = '';
    monthSel.innerHTML = '';
    yearSel.innerHTML = '';

    function opt(val, text) {
      const o = document.createElement('option');
      o.value = String(val);
      o.textContent = String(text);
      return o;
    }

    // months
    monthSel.appendChild(opt('', 'Month'));
    months.forEach((m, i) => monthSel.appendChild(opt(i + 1, m)));

    // years
    const now = new Date();
    const curYear = now.getFullYear();
    yearSel.appendChild(opt('', 'Year'));
    for (let y = curYear; y <= curYear + (Number(yearsAhead) || 5); y++) {
      yearSel.appendChild(opt(y, y));
    }

    function daysInMonth(y, mIndex) {
      return new Date(y, mIndex + 1, 0).getDate();
    }

    function refillDates() {
      const selMonth = Number(monthSel.value) || (now.getMonth() + 1);
      const selYear = Number(yearSel.value) || curYear;
      const mIndex = selMonth - 1;
      const days = daysInMonth(selYear, mIndex);
      const prevValue = Number(dateSel.value) || now.getDate();

      dateSel.innerHTML = '';
      dateSel.appendChild(opt('', 'Date'));
      for (let d = 1; d <= days; d++) dateSel.appendChild(opt(d, d));

      // keep previous if valid, else choose today if same month/year, else 1
      if (prevValue >= 1 && prevValue <= days) {
        dateSel.value = String(prevValue);
      } else if (selYear === curYear && selMonth === (now.getMonth() + 1)) {
        dateSel.value = String(now.getDate());
      } else {
        dateSel.value = '1';
      }
    }

    // default: current month/year and refill dates
    monthSel.value = String(now.getMonth() + 1);
    yearSel.value = String(curYear);
    refillDates();

    monthSel.addEventListener('change', refillDates);
    yearSel.addEventListener('change', refillDates);
  }

  // ---- DOM refs ----
  const productList = document.querySelector('.product-list');
  const subtotalEl = document.getElementById('subtotalRp');
  const shippingEl = document.getElementById('shippingFee');
  const totalEl = document.getElementById('totalRp');
  const deliveryBtns = Array.from(document.querySelectorAll('.delivery-item'));
  const deliveryRow = document.getElementById('deliveryRow');

  if (!productList || !subtotalEl || !shippingEl || !totalEl) {
    console.warn('cekout: required elements not found');
    return;
  }

  // ---- render product summary from cart ----
  function renderProductsFromCart() {
    const cart = loadCart();
    productList.innerHTML = '';

    if (!cart || !cart.length) {
      const li = document.createElement('li');
      li.className = 'product-item';
      li.innerHTML = `<div class="product-info"><div class="product-title">Keranjang kosong</div><div class="product-meta muted">Tambahkan produk dari keranjang</div></div>`;
      productList.appendChild(li);
      // reset totals
      calcSubtotal();
      return;
    }

    cart.forEach((it, index) => {
      const unit = Number(it.unitPrice || it.price || 0);
      const qty = Math.max(0, Number(it.qty || 1));
      const subtotal = Number(it.subtotal || (unit * qty) || (unit * qty));

      const li = document.createElement('li');
      li.className = 'product-item';
      li.dataset.cartIdx = index;

      const source = it.source ? `${it.source} • ` : '';
      const metaPrice = formatRp(unit);

      li.innerHTML = `
        <div class="product-info">
          <div class="product-title">${escapeHtml(it.title || 'Untitled')}</div>
          <div class="product-meta">${escapeHtml(source)}${metaPrice}</div>
        </div>
        <div class="qty-control" data-price="${unit}">
          <button class="qty-btn dec" aria-label="Decrease">−</button>
          <input class="qty-input" type="text" inputmode="numeric" value="${qty}" aria-label="Quantity">
          <button class="qty-btn inc" aria-label="Increase">+</button>
        </div>
      `;
      productList.appendChild(li);

      // handlers
      const dec = li.querySelector('.dec');
      const inc = li.querySelector('.inc');
      const input = li.querySelector('.qty-input');

      dec.addEventListener('click', () => {
        let v = Number(input.value) || 0;
        v = Math.max(0, v - 1);
        input.value = String(v);
        updateCartQtyFromUI(index, v);
      });

      inc.addEventListener('click', () => {
        let v = Number(input.value) || 0;
        v = v + 1;
        input.value = String(v);
        updateCartQtyFromUI(index, v);
      });

      input.addEventListener('input', () => {
        input.value = input.value.replace(/[^\d]/g, '');
        if (input.value === '') input.value = '0';
        const v = Number(input.value);
        updateCartQtyFromUI(index, v);
      });
    });
  }

  // update cart model when qty changed from UI
  function updateCartQtyFromUI(idx, qty) {
    const cart = loadCart();
    if (!cart || !cart[idx]) {
      // if index invalid, just recalc totals
      calcSubtotal();
      return;
    }
    cart[idx].qty = Number(qty || 0);
    cart[idx].subtotal = Number(Number(cart[idx].unitPrice || cart[idx].price || 0) * Number(cart[idx].qty || 0));

    // remove items with qty 0
    if (cart[idx].qty <= 0) {
      cart.splice(idx, 1);
    }

    saveCart(cart);
    // re-render list because indices may have shifted
    renderProductsFromCart();
    calcSubtotal();
  }

  // ---- delivery selection handlers ----
  deliveryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      deliveryBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      if (typeof btn.scrollIntoView === 'function') btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      calcSubtotal();
    });
  });

  // ---- subtotal / shipping / total calculation ----
  function calcSubtotal() {
    const cart = loadCart();
    let totalItems = 0;
    let totalPrice = 0;

    if (Array.isArray(cart)) {
      cart.forEach(it => {
        const price = Number(it.unitPrice || it.price || 0);
        const qty = Math.max(0, Number(it.qty || 0));
        totalPrice += price * qty;
        totalItems += qty;
      });
    }

    const activeMethod = document.querySelector('.delivery-item.active')?.dataset.method || 'regular';
    let baseOngkir = 15000;
    switch (activeMethod) {
      case 'regular': baseOngkir = 15000; break;
      case 'nextday': baseOngkir = 20000; break;
      case 'sameday': baseOngkir = 30000; break;
      case 'instant': baseOngkir = 50000; break;
      case 'self': baseOngkir = 5000; break;
      default: baseOngkir = 15000; break;
    }

    const kelipatan = totalItems > 0 ? Math.max(1, Math.ceil(totalItems / 5)) : 1;
    const shippingFee = baseOngkir * kelipatan;
    const grandTotal = totalPrice + shippingFee;

    if (subtotalEl) subtotalEl.textContent = formatRp(totalPrice);
    if (shippingEl) shippingEl.textContent = formatRp(shippingFee);
    if (totalEl) totalEl.textContent = formatRp(grandTotal);
  }

  // ---- Place Order: create scheduled order and redirect ----
  const placeOrderBtn = document.getElementById('placeOrder');
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', function () {
      const cart = loadCart();
      if (!cart || !cart.length) {
        alert('Keranjang kosong — tidak ada yang dipesan.');
        return;
      }

      // read schedule selects -> build ISO date if valid
      let scheduledAt = null;
      try {
        const dateSel = document.querySelector('select[aria-label="Date"]');
        const monthSel = document.querySelector('select[aria-label="Month"]');
        const yearSel = document.querySelector('select[aria-label="Year"]');
        const dateVal = dateSel?.value || '';
        const monthVal = monthSel?.value || '';
        const yearVal = yearSel?.value || '';

        const d = Number(dateVal);
        const y = Number(yearVal);

        if (!isNaN(d) && !isNaN(y) && monthVal) {
          // monthVal can be numeric or month name; try mapping
          const monthMap = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
          let mIndex = Number(monthVal);
          if (isNaN(mIndex)) {
            const mm = String(monthVal).trim().slice(0,3).toLowerCase();
            mIndex = monthMap[mm] || NaN;
          }
          if (!isNaN(mIndex)) {
            // create local date at 09:00 (local timezone)
            const isoDate = new Date(y, mIndex - 1, d, 9, 0, 0);
            if (!isNaN(isoDate.getTime())) scheduledAt = isoDate.toISOString();
          }
        }
      } catch (e) {
        // ignore schedule parsing errors
      }

      const notes = document.getElementById('notes')?.value?.trim() || '';
      const recipient = document.getElementById('recipient')?.value?.trim() || '';

      // compute totals again (source of truth: cart array)
      let totalPrice = 0;
      cart.forEach(it => {
        totalPrice += Number(
          it.subtotal ||
          (Number(it.unitPrice || it.price || 0) * Number(it.qty || 0)) ||
          0
        );
      });

      const selectedDelivery = document.querySelector('.delivery-item.active')?.dataset.method || 'regular';
      let baseOngkir = 15000;
      switch (selectedDelivery) {
        case 'regular': baseOngkir = 15000; break;
        case 'nextday': baseOngkir = 20000; break;
        case 'sameday': baseOngkir = 30000; break;
        case 'instant': baseOngkir = 50000; break;
        case 'self': baseOngkir = 5000; break;
        default: baseOngkir = 15000; break;
      }
      const totalItems = cart.reduce((s, it) => s + (Number(it.qty || 0)), 0);
      const kelipatan = Math.max(1, Math.ceil(totalItems / 5));
      const shippingFee = baseOngkir * kelipatan;
      const grandTotal = Number(totalPrice) + Number(shippingFee);

      // ---- cek apakah ini GIFT order (data dari gif.html) ----
      let giftConfig = null;
      try {
        giftConfig = JSON.parse(localStorage.getItem('giftConfig_v1') || 'null');
      } catch (e) {
        giftConfig = null;
      }
      const isGift = !!(giftConfig && giftConfig.type === 'gift');

      // prepare order object
      const order = {
        id: genOrderId(),
        createdAt: Date.now(),
        status: 'scheduled',
        scheduledAt: scheduledAt,
        total: grandTotal,
        shippingFee: shippingFee,
        items: cart.map(it => ({
          id: it.id,
          title: it.title,
          qty: Number(it.qty || 1),
          unitPrice: Number(it.unitPrice || it.price || 0),
          subtotal: Number(
            it.subtotal ||
            (Number(it.unitPrice || it.price || 0) * Number(it.qty || 1))
          ),
          addons: it.addons || [],
          image: it.image || (it.images && it.images[0]) || ''
        })),
        meta: {
          notes: notes,
          recipient: recipient,
          deliveryMethod: selectedDelivery
        },
        paymentStatus: 'pending' // biar konsisten dengan order dari bagfr.js
      };

      // kalau ini dari flow GIFT, tambahkan flag & detail gift
      if (isGift) {
        order.isGift = true;
        order.gift = {
          message: giftConfig.message || '',
          fromName: giftConfig.fromName || '',
          revealMode: giftConfig.revealMode || 'reveal',
          theme: giftConfig.theme || null
        };
      }

      // save orders (most recent first)
      const orders = loadOrders();
      orders.unshift(order);
      saveOrders(orders);

      // clear cart & gift config
      try { localStorage.removeItem('cart'); } catch (e) { /* ignore */ }
      try { localStorage.removeItem('giftConfig_v1'); } catch (e) { /* ignore */ }

      // WhatsApp ke admin (mirip flow dari bagfr.js)
      try {
        const waNumber = '628118281416';
        let waText = '';

        if (isGift) {
          const tgl = scheduledAt
            ? new Date(scheduledAt).toLocaleString('id-ID')
            : '(tanpa jadwal)';
          waText =
            `Halo mimin Mazi, ini pesanan GIFT terjadwal dengan ID ${order.id}. ` +
            `Mohon dibantu proses untuk jadwal ${tgl}.`;
        } else {
          waText =
            `Halo mimin Mazi, tolong proses pesanan terjadwal saya dengan ID ${order.id}.`;
        }

        const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;
        window.open(waUrl, '_blank');
      } catch (e) {
        console.warn('Failed to open WhatsApp', e);
      }

      // redirect to order.html with order id
      window.location.href = './order.html?order=' + encodeURIComponent(order.id);
    });
  }

  // ---- initial render ----
  populateScheduleSelectors({ yearsAhead: 5 });
  renderProductsFromCart();
  calcSubtotal();
});

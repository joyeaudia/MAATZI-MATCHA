/* bag-cart.js - clean, standalone cart renderer + handlers */
(function () {
  'use strict';

  // ----- helpers -----
  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));

  function formatRupiah(num){
    num = Math.round(Number(num) || 0);
    return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }

  // ----- storage -----
  function loadCart(){
    try { return JSON.parse(localStorage.getItem('cart')||'[]'); }
    catch(e){ return []; }
  }
  function saveCart(cart){
    localStorage.setItem('cart', JSON.stringify(cart||[]));
  }

  // ----- render -----
  function renderCart(){
    const items = loadCart();
    const container = document.getElementById('bag-items') || document.querySelector('.cart-list') || document.querySelector('.bag-items');
    if (!container) return;
    container.innerHTML = '';

    if (!items.length){
      container.innerHTML = '<p class="empty" style="text-align:center;color:#666;padding:18px 0">Keranjang kosong.</p>';
      updateSummaryTotal();
      return;
    }

    let total = 0;
    items.forEach((it, idx) => {
      // safe fields & fallbacks
      const unit = Number(it.unitPrice || it.price || 0);
      const qty = Number(it.qty || 1);
      const subtotal = Number(it.subtotal || (unit * qty) || 0);
      total += subtotal;

      const addonsHtml = (it.addons && it.addons.length)
        ? it.addons.map(a => `<div class="addon">${escapeHtml(a.label || '')} ${a.price ? `(+${formatRupiah(a.price)})` : ''}</div>`).join('')
        : '';

      // choose image: prefer it.image, then it.images[0], then placeholder
      const imgSrc = escapeHtml(it.image || (it.images && it.images[0]) || 'assets/placeholder.png');

      const html = `
        <article class="cart-item" data-idx="${idx}" data-price="${unit}">
          <div class="thumb"><img src="${imgSrc}" alt="${escapeHtml(it.title||'Product')}" onerror="this.onerror=null;this.src='assets/placeholder.png'"></div>
          <div class="item-body">
            <div class="item-head">
              <div>
                <div class="item-title">${escapeHtml(it.title||'Untitled')}</div>
                <div class="item-meta">${addonsHtml}</div>
              </div>
              <button class="remove" title="Hapus item" aria-label="Hapus item" data-idx="${idx}">
                <img src="acs/smph.png" alt="Hapus">
              </button>
            </div>

            <div class="item-controls">
              <div class="qty-control">
                <button class="qty-btn qty-decr" aria-label="Kurangi">-</button>
                <span class="qty">${qty}</span>
                <button class="qty-btn qty-incr" aria-label="Tambah">+</button>
              </div>

              <div class="right-col">
                <div class="item-sub-value">${formatRupiah(subtotal)}</div>
              </div>
            </div>
          </div>
        </article>
      `;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html.trim();
      container.appendChild(wrapper.firstElementChild);
    });

    updateSummaryTotal(total);
  }

  // ----- update totals -----
  function updateSummaryTotal(precalculated){
    // if precalculated passed, use it, else compute
    let total = Number(precalculated || 0);
    if (!precalculated){
      const items = loadCart();
      total = items.reduce((s,it) => s + (Number(it.subtotal) || (Number(it.unitPrice||it.price||0) * Number(it.qty||1)) ), 0);
    }
    const summaryEl = document.querySelector('.summary-value') || document.getElementById('bag-total') || document.querySelector('.bag-total');
    if (summaryEl) summaryEl.textContent = formatRupiah(total);
  }

  // ----- event delegation: qty, remove -----
  document.addEventListener('click', function(e){
    // find cart-item ancestor
    const itemEl = e.target.closest('.cart-item');
    // if click happened outside any cart item, ignore (some handlers may be global)
    if (!itemEl) return;

    const idx = Number(itemEl.dataset.idx);
    let cart = loadCart();

    // qty increase
    if (e.target.closest('.qty-incr')) {
      cart[idx].qty = (Number(cart[idx].qty || 1) + 1);
      cart[idx].subtotal = Number(cart[idx].unitPrice || cart[idx].price || 0) * cart[idx].qty;
      saveCart(cart);
      renderCart();
      return;
    }

    // qty decrease
    if (e.target.closest('.qty-decr')) {
      cart[idx].qty = Math.max(1, Number(cart[idx].qty || 1) - 1);
      cart[idx].subtotal = Number(cart[idx].unitPrice || cart[idx].price || 0) * cart[idx].qty;
      saveCart(cart);
      renderCart();
      return;
    }

    // remove (accept button or inner img)
    if (e.target.closest('.remove')) {
      if (!confirm('Hapus item dari keranjang?')) return;
      cart.splice(idx, 1);
      saveCart(cart);
      renderCart();
      return;
    }
  });

  // ----- public helper to add item to cart (call this from product page) -----
  // expected productObj example:
  // { id: 'drink-001', title:'Matcha', unitPrice:55000, qty:1, image:'Dsr/dr4.png', addons:[], subtotal: 55000 }
  function addToBag(productObj){
    if (!productObj || !productObj.id) throw new Error('productObj.id required');
    const cart = loadCart();
    // check if item with same id + identical addons exists => increase qty
    const sameIdx = cart.findIndex(i => i.id === productObj.id && JSON.stringify(i.addons||[]) === JSON.stringify(productObj.addons||[]));
    if (sameIdx >= 0){
      cart[sameIdx].qty = Number(cart[sameIdx].qty || 1) + (Number(productObj.qty) || 1);
      cart[sameIdx].subtotal = Number(cart[sameIdx].unitPrice || cart[sameIdx].price || 0) * cart[sameIdx].qty;
    } else {
      const qty = Number(productObj.qty||1);
      const unit = Number(productObj.unitPrice || productObj.price || 0);
      const item = {
        id: productObj.id,
        title: productObj.title || '',
        unitPrice: unit,
        qty: qty,
        subtotal: Number(productObj.subtotal || (unit * qty)),
        image: productObj.image || (productObj.images && productObj.images[0]) || 'assets/placeholder.png',
        addons: productObj.addons || []
      };
      cart.push(item);
    }
    saveCart(cart);
    // re-render cart UI (if on bag page)
    renderCart();
  }

  // expose addToBag globally so product pages can call it
  window.addToBag = addToBag;
  window.renderCart = renderCart;

  // initial render on DOM ready
  document.addEventListener('DOMContentLoaded', renderCart);
})();

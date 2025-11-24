// app.js
(function () {
  'use strict';

  // format number to Rupiah string "Rp 150.000"
  function formatRupiah(num) {
    num = Math.round(Number(num) || 0);
    return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // update subtotal for one cart-item element
  function updateItemSubtotal(itemEl) {
    const price = parseInt(itemEl.dataset.price, 10) || 0;
    const qty = parseInt(itemEl.querySelector('.qty').textContent, 10) || 0;
    const subtotal = price * qty;
    const displayEl = itemEl.querySelector('.item-sub-value');
    if (displayEl) displayEl.textContent = formatRupiah(subtotal);

    // keep unit price in item-meta consistent
    const meta = itemEl.querySelector('.item-meta');
    if (meta) {
      meta.textContent = meta.textContent.replace(/Rp\s?[\d\.]+/, formatRupiah(price));
    }
  }

  // recalculate total for summary
  function updateSummaryTotal() {
    const items = document.querySelectorAll('.cart-item');
    let total = 0;
    items.forEach(it => {
      const price = parseInt(it.dataset.price, 10) || 0;
      const qty = parseInt(it.querySelector('.qty').textContent, 10) || 0;
      total += price * qty;
    });
    const summaryEl = document.querySelector('.summary-value');
    if (summaryEl) summaryEl.textContent = formatRupiah(total);
  }

  // attach handlers to a single cart item
  function initCartItem(itemEl) {
    const inc = itemEl.querySelector('.qty-increase');
    const dec = itemEl.querySelector('.qty-decrease');
    const qtyEl = itemEl.querySelector('.qty');

    // ensure qty exists
    if (!qtyEl) return;

    // ensure initial subtotal displays correctly
    updateItemSubtotal(itemEl);

    if (inc) {
      inc.addEventListener('click', () => {
        let q = parseInt(qtyEl.textContent, 10) || 0;
        q = q + 1;
        qtyEl.textContent = q;
        updateItemSubtotal(itemEl);
        updateSummaryTotal();
      });
    }

    if (dec) {
      dec.addEventListener('click', () => {
        let q = parseInt(qtyEl.textContent, 10) || 0;
        if (q > 1) {
          q = q - 1;
          qtyEl.textContent = q;
          updateItemSubtotal(itemEl);
          updateSummaryTotal();
        }
      });
    }

    const rm = itemEl.querySelector('.remove');
    if (rm) {
      rm.addEventListener('click', () => {
        if (confirm('Hapus item dari keranjang?')) {
          itemEl.remove();
          updateSummaryTotal();
        }
      });
    }
  }

  // init like-heart toggles
  function initLikeHearts() {
    document.querySelectorAll('.like-heart').forEach(btn => {
      if (!btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', 'false');

      btn.addEventListener('click', () => {
        const pressed = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!pressed));

        btn.animate([
          { transform: 'scale(1)' },
          { transform: 'scale(1.12)' },
          { transform: 'scale(1)' }
        ], {
          duration: 220,
          easing: 'cubic-bezier(.2,.8,.2,1)'
        });
      });

      btn.addEventListener('keydown', (ev) => {
        if (ev.key === ' ' || ev.key === 'Enter') {
          ev.preventDefault();
          btn.click();
        }
      });
    });
  }

  // gift toggle small handler
  function initGiftToggle() {
    const g = document.querySelector('.gift-toggle');
    if (!g) return;
    if (!g.hasAttribute('aria-pressed')) g.setAttribute('aria-pressed', 'false');

    g.addEventListener('click', () => {
      const pressed = g.getAttribute('aria-pressed') === 'true';
      g.setAttribute('aria-pressed', String(!pressed));
    });
  }

  // on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    // initialize cart items
    document.querySelectorAll('.cart-item').forEach(initCartItem);

    // initial total
    updateSummaryTotal();

    // like hearts
    initLikeHearts();

    // gift toggle
    initGiftToggle();
  });
  // === RENDER CART (paste into bagfr.js) ===
(function(){
  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));
  const fmt = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n||0));
  function loadCart(){ try{return JSON.parse(localStorage.getItem('cart')||'[]')}catch(e){return []} }

  function renderCart() {
    const items = loadCart();
    const container = document.getElementById('bag-items') || document.querySelector('.bag-items') || q('.cart-list');
    if (!container) return;
    container.innerHTML = '';
    if (!items.length) {
      container.innerHTML = '<p class="empty">Your bag is empty.</p>';
      const totalEl = q('#bag-total') || q('.bag-total');
      if (totalEl) totalEl.textContent = fmt(0);
      return;
    }
    let total = 0;
    items.forEach((it, idx) => {
      total += Number(it.subtotal || 0);
      const addonText = (it.addons||[]).map(a=>`${a.label} (+${fmt(a.price)})`).join('<br>');
      const itemHtml = `
        <div class="cart-item" data-idx="${idx}">
          <img src="${it.image||''}" alt="${it.title||''}" class="cart-thumb" style="width:72px;height:72px;object-fit:cover;border-radius:8px;margin-right:12px;">
          <div class="cart-meta" style="flex:1">
            <div class="cart-title" style="font-weight:600">${it.title}</div>
            <div class="cart-addons" style="font-size:13px;color:#666">${addonText}</div>
            <div class="cart-qty" style="margin-top:6px;">
              <button class="qty-decr">-</button>
              <span class="qty-val" style="margin:0 8px">${it.qty}</span>
              <button class="qty-incr">+</button>
            </div>
          </div>
          <div class="cart-price" style="min-width:96px;text-align:right">${fmt(it.subtotal)}</div>
          <!-- remove icon placed visually above price -->
<img src="acs/smph.png"
     alt="Remove"
     class="remove-icon"
     title="Remove item"
     style="width:24px;height:24px;cursor:pointer;margin-left:8px" />
        </div>
      `;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = itemHtml;
      const el = wrapper.firstElementChild;
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      container.appendChild(el);
    });
    const totalEl = q('#bag-total') || q('.bag-total');
    if (totalEl) totalEl.textContent = fmt(total);
  }

  // qty + remove handlers
  document.addEventListener('click', function(e){
    const itemEl = e.target.closest('.cart-item');
    if (!itemEl) return;
    const idx = Number(itemEl.dataset.idx);
    let cart = loadCart();
    if (e.target.matches('.qty-incr')) {
      cart[idx].qty = Number(cart[idx].qty||1) + 1;
      cart[idx].subtotal = Number(cart[idx].unitPrice||0) * cart[idx].qty;
      localStorage.setItem('cart', JSON.stringify(cart)); renderCart(); return;
    }
    if (e.target.matches('.qty-decr')) {
      cart[idx].qty = Math.max(1, Number(cart[idx].qty||1) - 1);
      cart[idx].subtotal = Number(cart[idx].unitPrice||0) * cart[idx].qty;
      localStorage.setItem('cart', JSON.stringify(cart)); renderCart(); return;
    }
   if (e.target.matches('.remove-item') || e.target.closest('.remove-icon')) {
  cart.splice(idx,1);
  localStorage.setItem('cart', JSON.stringify(cart));
  renderCart();
  return;
}

  });

  // initial render
  document.addEventListener('DOMContentLoaded', renderCart);
  window.renderCart = renderCart;
})();
})();

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
})();

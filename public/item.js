// item.js - robust price parsing & update (fixes double display bug and ensures correct math)
(function(){
  'use strict';

  // format number to Indonesian currency without fraction (e.g. 28000 -> "Rp 28.000")
  function formatPrice(n){
    n = Number(n) || 0;
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(n);
  }

  // safe integer parse helper
  function intVal(v){ return Number(String(v).replace(/[^\d-]/g,'')) || 0; }

  document.addEventListener('DOMContentLoaded', function(){

    const priceEl = document.getElementById('product-price');
    const oldEl = document.getElementById('old-price');

    if (!priceEl) {
      console.error('item.js: #product-price element not found');
      return;
    }

    // read numeric base & old values from data attributes (preferred) or fallback
    const base = intVal(priceEl.getAttribute('data-base') || priceEl.dataset.base || priceEl.textContent);
    const oldPrice = oldEl ? intVal(oldEl.getAttribute('data-old') || oldEl.dataset.old || oldEl.textContent) : 0;

    // initialize display (format both)
    priceEl.textContent = formatPrice(base);
    if (oldEl) {
      if (oldPrice > 0 && oldPrice !== base) {
        oldEl.textContent = formatPrice(oldPrice);
        oldEl.style.display = ''; // ensure visible
      } else {
        // hide old price if not meaningful
        oldEl.style.display = 'none';
      }
    }

    let currentTotal = base;

    function initOptionButtons(){
      document.querySelectorAll('.option-group').forEach(group => {
        const key = group.dataset.key;
        const isAddon = key === 'addons';
        const buttons = Array.from(group.querySelectorAll('button'));

        buttons.forEach(btn => {
          // normalize data attributes
          if (btn.hasAttribute('data-price-delta') && !btn.dataset.priceDelta) {
            btn.dataset.priceDelta = btn.getAttribute('data-price-delta');
          }
          if (btn.hasAttribute('data-price') && !btn.dataset.price) {
            btn.dataset.price = btn.getAttribute('data-price');
          }

          btn.addEventListener('click', (ev) => {
            if (isAddon) {
              const pressed = btn.getAttribute('aria-pressed') === 'true';
              btn.setAttribute('aria-pressed', (!pressed).toString());
            } else {
              // single-select logic
              buttons.forEach(b => b.setAttribute('aria-pressed', 'false'));
              btn.setAttribute('aria-pressed', 'true');
            }
            updatePriceFromUI();
          });

          btn.addEventListener('keydown', (ev) => {
            if (ev.key === ' ' || ev.key === 'Spacebar' || ev.key === 'Enter') {
              ev.preventDefault();
              btn.click();
            }
          });
        });
      });
    }

    function updatePriceFromUI(){
      let total = base;

      // milk selection price delta (data-price-delta)
      const milkSel = document.querySelector('.option-group[data-key="milk"] button[aria-pressed="true"]');
      if (milkSel) {
        total += intVal(milkSel.dataset.priceDelta || 0);
      }

      // add-ons (sum of data-price)
      document.querySelectorAll('.option-group[data-key="addons"] button[aria-pressed="true"]').forEach(b => {
        total += intVal(b.dataset.price || 0);
      });

      currentTotal = total;
      priceEl.textContent = formatPrice(total);
    }

    function getSelectedOptions(){
      const out = {};
      document.querySelectorAll('.option-group').forEach(g => {
        const key = g.dataset.key;
        if (key === 'addons') {
          out[key] = Array.from(g.querySelectorAll('button[aria-pressed="true"]')).map(x => x.dataset.id);
        } else {
          const sel = g.querySelector('button[aria-pressed="true"]');
          out[key] = sel ? sel.dataset.value : null;
        }
      });
      out.notes = document.getElementById('notes') ? document.getElementById('notes').value.trim() : '';
      return out;
    }

    // cart helpers
    const CART_KEY = 'verent_cart_v1';
    function getCart(){ try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e){ return []; } }
    function saveCart(c){ localStorage.setItem(CART_KEY, JSON.stringify(c)); }

    // add to cart handler
    const addBtn = document.getElementById('add-to-cart');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const selected = getSelectedOptions();
        const item = {
          id: (document.querySelector('.product-name') && document.querySelector('.product-name').dataset.id) || 'unknown',
          title: document.querySelector('.product-name') ? document.querySelector('.product-name').textContent.trim() : 'Product',
          price_base: base,
          total: currentTotal,
          selected,
          old_price: oldPrice || null
        };
        const cart = getCart();
        cart.push(item);
        saveCart(cart);
        addBtn.textContent = 'Added ✓';
        setTimeout(()=> addBtn.textContent = 'Add to Bag', 900);
      });
    }

    initOptionButtons();
    updatePriceFromUI();

    // heart toggle
    const heart = document.querySelector('.heart');
    if (heart) {
      heart.addEventListener('click', () => {
        const is = heart.classList.toggle('active');
        heart.setAttribute('aria-pressed', is ? 'true' : 'false');
      });
    }
  });
})();
